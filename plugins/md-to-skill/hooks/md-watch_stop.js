#!/usr/bin/env node
/**
 * md-to-skill Stop Hook - Detect High-Confidence Skill Candidates
 *
 * Monitors session for new/changed markdown files and scores them as skill candidates
 * using a multi-signal confidence system. Only suggests files that score above threshold.
 *
 * Scoring signals (weighted 0-1):
 *   - Content depth: word count scaled 200-2000
 *   - Structure: heading depth (h1/h2/h3+)
 *   - Code blocks: presence of fenced code examples
 *   - Lists: bullet/numbered lists (procedural content)
 *   - Sections: distinct heading-delimited sections
 *   - Instructional: how-to/procedural language markers
 *
 * Decision Logic:
 * 1. Read stdin for hook input (cwd, transcript_path)
 * 2. Guard: if stop_hook_active -> exit (prevent infinite loop)
 * 3. Load session state (.claude/md-to-skill-state/{hash}.json)
 * 4. Parse transcript for Write tool operations on .md files (incremental)
 * 5. Filter out known non-skill files and plugin directories
 * 6. Score each candidate with multi-signal confidence
 * 7. Suggest files scoring >= threshold, ranked by confidence
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { findGitRoot, loadHookInputSync } = require('./hook_utils');

// Confidence threshold for suggesting a file as a skill candidate
const CONFIDENCE_THRESHOLD = 0.4;

// Excluded file basenames
const EXCLUDE_PATTERNS = ['README.md', 'CHANGELOG.md', 'LICENSE.md', 'CLAUDE.md', 'CONTRIBUTING.md', 'MEMORY.md'];

// Instructional language markers (case-insensitive)
const INSTRUCTIONAL_PATTERNS = [
  /\bhow to\b/i,
  /\bstep[s]?\s*\d/i,
  /\bexample[s]?\b/i,
  /\bpattern[s]?\b/i,
  /\bbest practice[s]?\b/i,
  /\bwhen to use\b/i,
  /\buse case[s]?\b/i,
  /\bguideline[s]?\b/i,
  /\bworkflow[s]?\b/i,
  /\btrigger[s]?\b/i,
  /\btemplate[s]?\b/i,
  /\breference[s]?\b/i,
  /\bprocedure[s]?\b/i,
  /\bconfigur(e|ation|ing)\b/i,
  /\btroubleshoot/i,
];


function getSessionStatePath(cwd, transcriptPath) {
  const transcriptHash = crypto.createHash('md5').update(transcriptPath).digest('hex').slice(0, 12);
  const stateDir = path.join(cwd, '.claude', 'md-to-skill-state');
  const newPath = path.join(stateDir, `${transcriptHash}.json`);

  // Auto-migrate from old flat layout
  const oldPath = path.join(cwd, '.claude', `md-to-skill-state-${transcriptHash}.json`);
  if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
    fs.mkdirSync(stateDir, { recursive: true });
    try { fs.renameSync(oldPath, newPath); } catch (e) { /* ignore */ }
  }

  return newPath;
}


function loadSessionState(statePath) {
  const defaultState = {
    last_processed_line: 0,
    suggested_files: [],
    last_run_time: null
  };

  if (!fs.existsSync(statePath)) return defaultState;

  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    for (const [key, val] of Object.entries(defaultState)) {
      if (!(key in state)) state[key] = val;
    }
    return state;
  } catch (e) {
    return defaultState;
  }
}


function saveSessionState(statePath, state) {
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    state.last_run_time = new Date().toISOString();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) { /* ignore */ }
}


function extractMdFilePaths(transcriptPath, cwd, startLine) {
  startLine = startLine || 0;
  const mdPaths = [];
  const seenPaths = new Set();
  let lastLine = startLine;

  try {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      if (lineNum < startLine) continue;
      lastLine = lineNum + 1;

      const line = lines[lineNum].trim();
      if (!line) continue;

      let entry;
      try { entry = JSON.parse(line); } catch (e) { continue; }

      // Extract content array from two known transcript structures
      let contentArr = null;
      if (entry.data && entry.data.message && entry.data.message.message && entry.data.message.message.content) {
        contentArr = entry.data.message.message.content;
      }
      if (!contentArr && entry.message && entry.message.content) {
        contentArr = entry.message.content;
      }
      if (!contentArr || !Array.isArray(contentArr)) continue;

      for (const item of contentArr) {
        if (!item || item.type !== 'tool_use' || item.name !== 'Write') continue;
        const filePath = (item.input && item.input.file_path) || '';
        if (!filePath || !filePath.toLowerCase().endsWith('.md')) continue;

        // Normalize to relative path
        const normalized = filePath.replace(/\\/g, '/');
        const normalizedCwd = cwd.replace(/\\/g, '/');
        const relPath = normalized.startsWith(normalizedCwd)
          ? normalized.slice(normalizedCwd.length).replace(/^\/+/, '')
          : normalized;

        if (!seenPaths.has(relPath)) {
          seenPaths.add(relPath);
          mdPaths.push(relPath);
        }
      }
    }
  } catch (e) { /* ignore */ }

  return [mdPaths, lastLine];
}


function isExcludedFile(filePath) {
  const basename = path.basename(filePath);
  for (const pattern of EXCLUDE_PATTERNS) {
    if (basename === pattern || filePath.endsWith(pattern)) return true;
  }
  return false;
}


function isInsidePluginDirectory(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (path.basename(filePath) === 'SKILL.md') return true;
  if (filePath.endsWith('.local.md')) return true;

  const pluginDirs = new Set(['skills', 'agents', 'commands', 'hooks', '.claude-plugin']);
  const parts = normalized.split('/');
  for (let i = 0; i < parts.length; i++) {
    if (pluginDirs.has(parts[i]) && i < parts.length - 1) return true;
  }
  return false;
}


/**
 * Score a markdown file as a skill candidate.
 * Returns { confidence, signals, reason } where confidence is 0-1.
 */
function scoreCandidate(filePath, cwd) {
  let absPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  absPath = path.normalize(absPath);

  if (!fs.existsSync(absPath)) {
    return { confidence: 0, signals: {}, reason: 'File no longer exists' };
  }

  let content;
  try { content = fs.readFileSync(absPath, 'utf8'); } catch (e) {
    return { confidence: 0, signals: {}, reason: `Cannot read: ${e.message}` };
  }

  const signals = {};

  // --- Signal 1: Content depth (word count) ---
  // 200 words = 0.0, 2000+ words = 1.0, linear scale
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  if (wordCount < 150) {
    return { confidence: 0, signals: {}, reason: `Only ${wordCount} words (need 150+)` };
  }
  signals.contentDepth = Math.min(1.0, Math.max(0, (wordCount - 200) / 1800));

  // --- Signal 2: Heading structure ---
  // Score based on heading depth variety
  const h1 = (content.match(/^# [^\n]+/gm) || []).length;
  const h2 = (content.match(/^## [^\n]+/gm) || []).length;
  const h3 = (content.match(/^### [^\n]+/gm) || []).length;
  const totalHeadings = h1 + h2 + h3;

  if (totalHeadings === 0) {
    return { confidence: 0, signals: {}, reason: 'No markdown headings found' };
  }

  const depthLevels = (h1 > 0 ? 1 : 0) + (h2 > 0 ? 1 : 0) + (h3 > 0 ? 1 : 0);
  // 1 level = 0.3, 2 levels = 0.7, 3 levels = 1.0
  signals.headingStructure = depthLevels === 1 ? 0.3 : depthLevels === 2 ? 0.7 : 1.0;

  // --- Signal 3: Code blocks ---
  const codeBlocks = (content.match(/^```/gm) || []).length / 2; // pairs
  signals.codeBlocks = codeBlocks === 0 ? 0 : codeBlocks === 1 ? 0.5 : 1.0;

  // --- Signal 4: Lists (bullet or numbered) ---
  const listItems = (content.match(/^[\s]*[-*+]\s|^\s*\d+\.\s/gm) || []).length;
  signals.lists = listItems === 0 ? 0 : listItems < 3 ? 0.3 : listItems < 8 ? 0.7 : 1.0;

  // --- Signal 5: Section count ---
  // Number of h2+ sections (distinct content blocks)
  const sections = h2 + h3;
  signals.sections = sections < 2 ? 0 : sections < 4 ? 0.5 : sections < 7 ? 0.8 : 1.0;

  // --- Signal 6: Instructional language ---
  let instructionalHits = 0;
  for (const pattern of INSTRUCTIONAL_PATTERNS) {
    if (pattern.test(content)) instructionalHits++;
  }
  signals.instructional = instructionalHits === 0 ? 0
    : instructionalHits < 3 ? 0.3
    : instructionalHits < 6 ? 0.7 : 1.0;

  // --- Weighted confidence score ---
  const weights = {
    contentDepth: 0.15,
    headingStructure: 0.20,
    codeBlocks: 0.15,
    lists: 0.10,
    sections: 0.15,
    instructional: 0.25,
  };

  let confidence = 0;
  for (const [key, weight] of Object.entries(weights)) {
    confidence += (signals[key] || 0) * weight;
  }
  confidence = Math.round(confidence * 100) / 100;

  return { confidence, signals, wordCount };
}


function cleanupStaleFiles(cwd, maxAgeHours) {
  if (maxAgeHours === undefined) maxAgeHours = 48;
  const maxAgeSecs = maxAgeHours * 3600;
  const now = Date.now() / 1000;

  const stateDir = path.join(cwd, '.claude', 'md-to-skill-state');
  if (!fs.existsSync(stateDir)) return;

  try {
    const entries = fs.readdirSync(stateDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const entryPath = path.join(stateDir, entry.name);
        const stat = fs.statSync(entryPath);
        if (now - stat.mtimeMs / 1000 > maxAgeSecs) {
          fs.unlinkSync(entryPath);
        }
      }
    }
  } catch (e) { /* ignore */ }
}


function main() {
  try {
    const inputData = loadHookInputSync();

    // Infinite loop guard
    if (inputData.stop_hook_active) {
      process.exit(0);
    }

    let cwd = inputData.cwd || '.';
    cwd = findGitRoot(cwd) || cwd;
    const transcriptPath = inputData.transcript_path || '';

    if (!transcriptPath) {
      process.exit(0);
    }

    // Clean up stale state files
    cleanupStaleFiles(cwd);

    // Load session state
    const statePath = getSessionStatePath(cwd, transcriptPath);
    const sessionState = loadSessionState(statePath);

    // Extract .md file paths from transcript (incremental)
    const [mdPaths, lastLine] = extractMdFilePaths(
      transcriptPath, cwd, sessionState.last_processed_line
    );

    if (mdPaths.length === 0) {
      sessionState.last_processed_line = lastLine;
      saveSessionState(statePath, sessionState);
      process.exit(0);
    }

    // Score candidates
    const candidates = [];
    for (const filePath of mdPaths) {
      if (isExcludedFile(filePath)) continue;
      if (isInsidePluginDirectory(filePath)) continue;
      if (sessionState.suggested_files.includes(filePath)) continue;

      const score = scoreCandidate(filePath, cwd);
      if (score.confidence >= CONFIDENCE_THRESHOLD) {
        candidates.push({ path: filePath, ...score });
      }
    }

    // Update session state
    sessionState.last_processed_line = lastLine;

    if (candidates.length === 0) {
      saveSessionState(statePath, sessionState);
      process.exit(0);
    }

    // Sort by confidence descending
    candidates.sort((a, b) => b.confidence - a.confidence);

    // Track suggested files
    for (const c of candidates) {
      sessionState.suggested_files.push(c.path);
    }
    saveSessionState(statePath, sessionState);

    // Build suggestion with confidence scores
    const fileList = candidates.map(c => {
      const pct = Math.round(c.confidence * 100);
      const topSignals = Object.entries(c.signals || {})
        .filter(([, v]) => v >= 0.7)
        .map(([k]) => k)
        .slice(0, 3);
      const signalHint = topSignals.length > 0 ? ` [${topSignals.join(', ')}]` : '';
      return `  - ${c.path} (${pct}% confidence, ${c.wordCount} words)${signalHint}`;
    }).join('\n');

    const reason = `Detected ${candidates.length} high-confidence skill candidate(s):\n\n${fileList}\n\nTo convert, run:\n  /convert-to-skill <file-path>\n\nOr scan all candidates:\n  /learn-skill`;

    const result = { decision: 'block', reason };
    process.stdout.write(JSON.stringify(result));
    process.exit(0);

  } catch (e) {
    process.exit(0);
  }
}

main();
