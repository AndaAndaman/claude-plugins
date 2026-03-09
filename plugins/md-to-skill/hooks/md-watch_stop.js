#!/usr/bin/env node
/**
 * md-to-skill Stop Hook - Watch for Markdown Changes (Node.js port)
 *
 * Monitors the session for new/changed markdown files that look like skill candidates.
 * When the session appears complete, suggests /convert-to-skill for qualifying files.
 *
 * Decision Logic:
 * 1. Read stdin for hook input (cwd, transcript_path)
 * 2. Guard: if stop_hook_active -> exit (prevent infinite loop)
 * 3. Load config (fallback defaults only, CONFIG_AVAILABLE = false)
 * 4. Load session state (.claude/md-to-skill-state/{hash}.json)
 * 5. Parse transcript for Write tool operations on .md files (incremental)
 * 6. Filter out known non-skill files (README.md, CHANGELOG.md, etc.)
 * 7. Filter out files inside skill directories
 * 8. Filter out files already suggested this session
 * 9. Lightweight checks: file exists, >minWords words, has headings
 * 10. If candidates found -> block stop with suggestion
 * 11. Save session state
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { findGitRoot, parseFrontmatter, loadHookInputSync } = require('./hook_utils');

// Config loader not available in JS port
const CONFIG_AVAILABLE = false;

// Global debug state
let DEBUG_ENABLED = false;
let DEBUG_LOG_PATH = null;


function debugLog(message) {
  if (!DEBUG_ENABLED || !DEBUG_LOG_PATH) return;
  try {
    const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
    fs.appendFileSync(DEBUG_LOG_PATH, `[${timestamp}] ${message}\n`, 'utf8');
  } catch (e) {
    // ignore
  }
}


function initDebug(cwd, debugFlag) {
  if ((process.env.MD_TO_SKILL_DEBUG || '').toLowerCase().match(/^(1|true|yes)$/)) {
    DEBUG_ENABLED = true;
  }
  if (debugFlag) {
    DEBUG_ENABLED = true;
  }
  if (DEBUG_ENABLED) {
    DEBUG_LOG_PATH = path.join(cwd, '.claude', 'md-to-skill-debug.log');
    fs.mkdirSync(path.dirname(DEBUG_LOG_PATH), { recursive: true });
    debugLog('='.repeat(60));
    debugLog('md-watch stop hook triggered');
    debugLog(`CWD: ${cwd}`);
  }
}


function getSessionStatePath(cwd, transcriptPath) {
  const transcriptHash = crypto.createHash('md5').update(transcriptPath).digest('hex').slice(0, 12);
  const stateDir = path.join(cwd, '.claude', 'md-to-skill-state');
  const newPath = path.join(stateDir, `${transcriptHash}.json`);

  // Auto-migrate from old flat layout
  const oldPath = path.join(cwd, '.claude', `md-to-skill-state-${transcriptHash}.json`);
  if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
    fs.mkdirSync(stateDir, { recursive: true });
    try {
      fs.renameSync(oldPath, newPath);
    } catch (e) {
      // ignore
    }
  }

  return newPath;
}


function loadSessionState(statePath) {
  const defaultState = {
    last_processed_line: 0,
    suggested_files: [],
    last_run_time: null
  };

  if (!fs.existsSync(statePath)) {
    return defaultState;
  }

  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    for (const [key, defaultVal] of Object.entries(defaultState)) {
      if (!(key in state)) {
        state[key] = defaultVal;
      }
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
  } catch (e) {
    debugLog(`Failed to save session state: ${e}`);
  }
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
      try {
        entry = JSON.parse(line);
      } catch (e) {
        continue;
      }

      let contentArr = null;

      // Structure 1: data.message.message.content
      if (entry.data) {
        const data = entry.data;
        if (data.message && typeof data.message === 'object') {
          const msg = data.message;
          if (msg.message && typeof msg.message === 'object') {
            const innerMsg = msg.message;
            if (innerMsg.content) {
              contentArr = innerMsg.content;
            }
          }
        }
      }

      // Structure 2: message.content
      if (contentArr === null && entry.message && typeof entry.message === 'object') {
        if (entry.message.content) {
          contentArr = entry.message.content;
        }
      }

      if (!contentArr || !Array.isArray(contentArr)) continue;

      for (const item of contentArr) {
        if (!item || typeof item !== 'object') continue;
        if (item.type !== 'tool_use') continue;

        const toolName = item.name || '';
        if (toolName !== 'Write') continue;

        const toolInput = item.input;
        if (!toolInput || typeof toolInput !== 'object') continue;

        let filePath = toolInput.file_path || '';
        if (!filePath) continue;

        // Only care about .md files
        if (!filePath.toLowerCase().endsWith('.md')) continue;

        // Normalize path
        filePath = filePath.replace(/\\/g, '/');
        const normalizedCwd = cwd.replace(/\\/g, '/');

        if (filePath.startsWith(normalizedCwd)) {
          filePath = filePath.slice(normalizedCwd.length).replace(/^\/+/, '');
        }

        if (!seenPaths.has(filePath)) {
          seenPaths.add(filePath);
          mdPaths.push(filePath);
        }
      }
    }
  } catch (e) {
    debugLog(`Error extracting paths: ${e}`);
  }

  return [mdPaths, lastLine];
}


function isExcludedFile(filePath, excludePatterns) {
  const basename = path.basename(filePath);

  for (const pattern of excludePatterns) {
    if (basename === pattern) return true;
    // Check if pattern matches as suffix (e.g., .local.md)
    if (filePath.endsWith(pattern)) return true;
  }

  return false;
}


function isInsidePluginDirectory(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');

  // Check for SKILL.md (indicates it IS a skill file)
  if (path.basename(filePath) === 'SKILL.md') return true;

  // Directories that contain plugin components, not skill candidates
  const pluginDirs = new Set(['skills', 'agents', 'commands', 'hooks', '.claude-plugin']);
  for (let i = 0; i < parts.length; i++) {
    if (pluginDirs.has(parts[i]) && i < parts.length - 1) return true;
  }

  // Check for .local.md files
  if (filePath.endsWith('.local.md')) return true;

  return false;
}


function checkFileQuality(filePath, cwd, minWords) {
  const result = {
    passes: false,
    word_count: 0,
    has_headings: false,
    reason: ''
  };

  // Build absolute path
  let absPath;
  if (path.isAbsolute(filePath)) {
    absPath = filePath;
  } else {
    absPath = path.join(cwd, filePath);
  }
  absPath = path.normalize(absPath);

  // Check file exists
  if (!fs.existsSync(absPath)) {
    result.reason = 'File no longer exists';
    return result;
  }

  let content;
  try {
    content = fs.readFileSync(absPath, 'utf8');
  } catch (e) {
    result.reason = `Cannot read file: ${e}`;
    return result;
  }

  // Word count
  const words = content.split(/\s+/).filter(w => w.length > 0);
  result.word_count = words.length;

  if (result.word_count < minWords) {
    result.reason = `Only ${result.word_count} words (need ${minWords})`;
    return result;
  }

  // Check for headings
  const headingPattern = /^#{1,6}\s+\S/m;
  result.has_headings = headingPattern.test(content);

  if (!result.has_headings) {
    result.reason = 'No markdown headings found';
    return result;
  }

  result.passes = true;
  return result;
}


function _getObsCountCachePath(cwd) {
  const cacheDir = path.join(cwd, '.claude', 'md-to-skill-cache');
  const newPath = path.join(cacheDir, 'obs-count-cache.json');

  // Auto-migrate from old flat layout
  const oldPath = path.join(cwd, '.claude', 'md-to-skill-obs-count-cache.json');
  if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    try {
      fs.renameSync(oldPath, newPath);
    } catch (e) {
      // ignore
    }
  }

  return newPath;
}


function _loadObsCountCache(cwd) {
  const cachePath = _getObsCountCachePath(cwd);
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
  } catch (e) {
    // ignore
  }
  return {};
}


function _saveObsCountCache(cwd, count, fileSize, fileMtime) {
  const cachePath = _getObsCountCachePath(cwd);
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify({
      count: count,
      file_size: fileSize,
      file_mtime: fileMtime
    }, null, 2), 'utf8');
  } catch (e) {
    // ignore
  }
}


function countObservationsSinceLastAnalysis(cwd) {
  const obsPath = path.join(cwd, '.claude', 'md-to-skill-observations.jsonl');
  if (!fs.existsSync(obsPath)) return 0;

  // Check cache validity: file_size and file_mtime must match
  let currentSize = -1;
  let currentMtime = '';
  try {
    const stat = fs.statSync(obsPath);
    currentSize = stat.size;
    currentMtime = new Date(stat.mtimeMs).toISOString();
  } catch (e) {
    currentSize = -1;
    currentMtime = '';
  }

  const cache = _loadObsCountCache(cwd);
  if (cache.file_size === currentSize &&
      cache.file_mtime === currentMtime &&
      'count' in cache) {
    debugLog(`Obs count cache hit: ${cache.count}`);
    return cache.count;
  }

  // Cache miss - do full count
  debugLog('Obs count cache miss, recounting');

  // Read last analyzed timestamp from state file
  let lastTs = null;
  const cacheDir = path.join(cwd, '.claude', 'md-to-skill-cache');
  const statePath = path.join(cacheDir, 'observe-state.json');

  // Auto-migrate from old flat layout
  const oldStatePath = path.join(cwd, '.claude', 'md-to-skill-observe-state.json');
  if (fs.existsSync(oldStatePath) && !fs.existsSync(statePath)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    try {
      fs.renameSync(oldStatePath, statePath);
    } catch (e) {
      // ignore
    }
  }

  try {
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      lastTs = state.last_analyzed_timestamp || null;
    }
  } catch (e) {
    // ignore
  }

  try {
    let count = 0;
    const content = fs.readFileSync(obsPath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (lastTs) {
        try {
          const entry = JSON.parse(trimmed);
          if ((entry.timestamp || '') <= lastTs) continue;
        } catch (e) {
          // ignore parse errors, count the line
        }
      }
      count++;
    }

    // Save to cache
    _saveObsCountCache(cwd, count, currentSize, currentMtime);
    return count;
  } catch (e) {
    return 0;
  }
}


function countAutoApprovedInstincts(cwd, threshold) {
  const instinctsDir = path.join(cwd, '.claude', 'md-to-skill-instincts');

  try {
    if (!fs.existsSync(instinctsDir) || !fs.statSync(instinctsDir).isDirectory()) {
      return 0;
    }
  } catch (e) {
    return 0;
  }

  try {
    let count = 0;
    const filenames = fs.readdirSync(instinctsDir);

    for (const filename of filenames) {
      if (!filename.endsWith('.md')) continue;
      const filepath = path.join(instinctsDir, filename);

      try {
        // Only need frontmatter, read first 2000 bytes
        const fd = fs.openSync(filepath, 'r');
        const buf = Buffer.alloc(2000);
        const bytesRead = fs.readSync(fd, buf, 0, 2000, 0);
        fs.closeSync(fd);
        const content = buf.toString('utf8', 0, bytesRead);

        const fm = parseFrontmatter(content);
        if (fm.auto_approved === true) {
          count++;
        }
      } catch (e) {
        continue;
      }
    }
    return count;
  } catch (e) {
    return 0;
  }
}


function _buildObserveHint(obsCount, autoCount) {
  let autoHint = '';
  if (autoCount > 0) {
    autoHint = ` (${autoCount} instincts above auto-approve threshold)`;
  }
  return autoHint;
}


function cleanupStaleFiles(cwd, maxAgeHours) {
  if (maxAgeHours === undefined) maxAgeHours = 48;
  const claudeDir = path.join(cwd, '.claude');
  const maxAgeSecs = maxAgeHours * 3600;
  const now = Date.now() / 1000;

  // Clean new subdirectory
  const stateDir = path.join(claudeDir, 'md-to-skill-state');
  if (fs.existsSync(stateDir)) {
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
    } catch (e) {
      // ignore
    }
  }

  // Clean leftover old flat files
  try {
    const entries = fs.readdirSync(claudeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith('md-to-skill-state-')) {
        const entryPath = path.join(claudeDir, entry.name);
        const stat = fs.statSync(entryPath);
        if (now - stat.mtimeMs / 1000 > maxAgeSecs) {
          fs.unlinkSync(entryPath);
        }
      }
    }
  } catch (e) {
    // ignore
  }
}


function main() {
  try {
    const inputData = loadHookInputSync();

    // Infinite loop guard
    if (inputData.stop_hook_active) {
      process.exit(0);
    }

    let cwd = inputData.cwd || '.';
    // Resolve to git repo root to avoid using a subdirectory as project root
    cwd = findGitRoot(cwd) || cwd;
    const transcriptPath = inputData.transcript_path || '';

    if (!transcriptPath) {
      process.exit(0);
    }

    // Load config (fallback only, CONFIG_AVAILABLE = false)
    let watchCfg, observerCfg, instinctCfg, debugFlag;

    if (CONFIG_AVAILABLE) {
      // This branch is unreachable in the JS port
      watchCfg = {};
      observerCfg = {};
      instinctCfg = {};
      debugFlag = false;
    } else {
      watchCfg = {
        enabled: true,
        minWords: 200,
        excludePatterns: ['README.md', 'CHANGELOG.md', 'LICENSE.md', 'CLAUDE.md'],
        observeSuggestionThreshold: 500
      };
      observerCfg = { enabled: true };
      instinctCfg = { autoApproveThreshold: 0.7 };
      debugFlag = false;
    }

    // Initialize debug mode
    initDebug(cwd, debugFlag);
    debugLog(`Config: watchEnabled=${watchCfg.enabled}, minWords=${watchCfg.minWords}`);

    // Clean up stale state files
    cleanupStaleFiles(cwd);

    if (!watchCfg.enabled) {
      debugLog('EXIT: watchEnabled=False (disabled)');
      process.exit(0);
    }

    // Pre-compute auto_approved count ONCE for the entire run
    const autoThreshold = instinctCfg.autoApproveThreshold || 0.7;
    const autoCount = countAutoApprovedInstincts(cwd, autoThreshold);

    // Load session state
    const statePath = getSessionStatePath(cwd, transcriptPath);
    const sessionState = loadSessionState(statePath);
    debugLog(`Session state: last_line=${sessionState.last_processed_line}, suggested=${JSON.stringify(sessionState.suggested_files)}`);

    // Extract .md file paths from transcript (incremental)
    const [mdPaths, lastLine] = extractMdFilePaths(
      transcriptPath, cwd, sessionState.last_processed_line
    );
    debugLog(`Found ${mdPaths.length} new .md file writes (lines ${sessionState.last_processed_line}-${lastLine})`);

    if (mdPaths.length === 0) {
      debugLog('EXIT: No new .md file writes found');
      sessionState.last_processed_line = lastLine;
      saveSessionState(statePath, sessionState);

      // Still check for observation accumulation even without .md candidates
      const observeEnabled = observerCfg.enabled !== false;
      if (observeEnabled) {
        const obsThreshold = watchCfg.observeSuggestionThreshold || 500;
        const obsCount = countObservationsSinceLastAnalysis(cwd);
        if (obsCount > obsThreshold) {
          const autoHint = _buildObserveHint(obsCount, autoCount);

          debugLog(`TRIGGER: Blocking stop for instinct suggestion (${obsCount} observations${autoHint})`);
          const result = {
            decision: 'block',
            reason: `${obsCount} tool use observations have accumulated${autoHint}.\nRun /observe to analyze patterns and extract instincts.`
          };
          process.stdout.write(JSON.stringify(result));
        }
      }
      process.exit(0);
    }

    // Filter candidates
    const excludePatterns = watchCfg.excludePatterns || ['README.md', 'CHANGELOG.md', 'LICENSE.md', 'CLAUDE.md'];
    const minWords = watchCfg.minWords || 200;

    const candidates = [];
    for (const filePath of mdPaths) {
      debugLog(`Checking: ${filePath}`);

      // Skip excluded files
      if (isExcludedFile(filePath, excludePatterns)) {
        debugLog(`  SKIP (excluded pattern): ${filePath}`);
        continue;
      }

      // Skip files inside plugin component directories (skills, agents, commands, hooks)
      if (isInsidePluginDirectory(filePath)) {
        debugLog(`  SKIP (plugin component): ${filePath}`);
        continue;
      }

      // Skip already suggested files
      if (sessionState.suggested_files.indexOf(filePath) !== -1) {
        debugLog(`  SKIP (already suggested): ${filePath}`);
        continue;
      }

      // Quality check
      const quality = checkFileQuality(filePath, cwd, minWords);
      if (!quality.passes) {
        debugLog(`  SKIP (quality): ${filePath} - ${quality.reason}`);
        continue;
      }

      candidates.push({
        path: filePath,
        word_count: quality.word_count
      });
      debugLog(`  CANDIDATE: ${filePath} (${quality.word_count} words)`);
    }

    // Update session state
    sessionState.last_processed_line = lastLine;

    // Check for accumulated observations (instinct suggestion)
    const observeEnabled = observerCfg.enabled !== false;
    let obsCount = 0;
    let instinctSuggestion = '';

    if (observeEnabled) {
      const obsThreshold = watchCfg.observeSuggestionThreshold || 500;
      obsCount = countObservationsSinceLastAnalysis(cwd);
      debugLog(`Observation count: ${obsCount} (threshold: ${obsThreshold})`);

      if (obsCount > obsThreshold) {
        const autoHint = _buildObserveHint(obsCount, autoCount);

        instinctSuggestion = `\n\n---\n\nAlso: ${obsCount} tool use observations have accumulated${autoHint}.\nRun /observe to analyze patterns and extract instincts.`;
      }
    }

    if (candidates.length === 0) {
      debugLog('EXIT: No qualifying candidates after filtering');
      saveSessionState(statePath, sessionState);

      // Even without .md candidates, suggest /observe if observations accumulated
      if (instinctSuggestion) {
        debugLog('TRIGGER: Blocking stop for instinct suggestion only');
        const autoHint = _buildObserveHint(obsCount, autoCount);

        const result = {
          decision: 'block',
          reason: `${obsCount} tool use observations have accumulated${autoHint}.\nRun /observe to analyze patterns and extract instincts.`
        };
        process.stdout.write(JSON.stringify(result));
      }
      process.exit(0);
    }

    // Track suggested files
    for (const c of candidates) {
      sessionState.suggested_files.push(c.path);
    }
    saveSessionState(statePath, sessionState);

    // Build suggestion message
    const fileList = candidates.map(
      c => `  - ${c.path} (${c.word_count} words)`
    ).join('\n');

    const reason = `Detected ${candidates.length} new markdown file(s) that look like skill candidates:\n\n${fileList}\n\nThese files have substantial content with headings - they could become useful Claude skills!\n\nTo convert, run:\n  /convert-to-skill <file-path>\n\nOr scan all candidates:\n  /learn-skill${instinctSuggestion}`;

    debugLog(`TRIGGER: Blocking stop with ${candidates.length} candidates`);

    const result = {
      decision: 'block',
      reason: reason
    };
    process.stdout.write(JSON.stringify(result));
    process.exit(0);

  } catch (e) {
    debugLog(`EXIT: Exception - ${e}`);
    process.exit(0);
  }
}

main();
