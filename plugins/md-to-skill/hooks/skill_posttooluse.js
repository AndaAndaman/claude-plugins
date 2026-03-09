#!/usr/bin/env node
/**
 * md-to-skill PostToolUse Hook - Consolidated Skill Dispatcher (JS port)
 *
 * Combines three previously separate Skill hooks into one:
 * 1. Usage tracking - logs every skill invocation
 * 2. Quick-wins bridge - writes observations for quick-wins skills
 * 3. Clarification bridge - writes observations for ask-before-code skills
 *
 * Each handler runs independently with its own error isolation.
 * This hook never blocks execution.
 */

const fs = require('fs');
const path = require('path');

const { findGitRoot, isSecretFile, getObservationsPath, parseFrontmatter, updateFrontmatterField, loadHookInputSync } = require('./hook_utils');

// Config is not available in JS (Python-only config_loader)
const CONFIG_AVAILABLE = false;

// Skill name patterns for ask-before-code bridge
const ABC_PATTERNS = ['clarify', 'ask-before-code', 'request-clarification'];

// Timeout guard: early exit at 4000ms to stay within 5000ms hook timeout
const START_TIME = Date.now();
const TIMEOUT_MS = 4000;

function checkTimeout() {
  return (Date.now() - START_TIME) >= TIMEOUT_MS;
}

// ---- Usage tracking helpers ----

function getCachePath(cwd, filename, oldFilename) {
  const cacheDir = path.join(cwd, '.claude', 'md-to-skill-cache');
  const newPath = path.join(cacheDir, filename);
  const oldPath = path.join(cwd, '.claude', oldFilename);

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

function loadTrackingFile(cwd) {
  const trackingPath = getCachePath(cwd, 'usage.json', 'md-to-skill-usage.json');
  const defaultData = { skills: {}, total_invocations: 0 };
  if (!fs.existsSync(trackingPath)) {
    return defaultData;
  }
  try {
    const data = JSON.parse(fs.readFileSync(trackingPath, 'utf8'));
    if (!data.skills) data.skills = {};
    if (!data.total_invocations) data.total_invocations = 0;
    return data;
  } catch (e) {
    return defaultData;
  }
}

function saveTrackingFile(cwd, data) {
  const trackingPath = getCachePath(cwd, 'usage.json', 'md-to-skill-usage.json');
  try {
    fs.mkdirSync(path.dirname(trackingPath), { recursive: true });
    fs.writeFileSync(trackingPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // ignore
  }
}

function loadDedup(cwd) {
  const dedupPath = getCachePath(cwd, 'reinforcement-dedup.json', 'md-to-skill-reinforcement-dedup.json');
  if (!fs.existsSync(dedupPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(dedupPath, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveDedup(cwd, data) {
  const dedupPath = getCachePath(cwd, 'reinforcement-dedup.json', 'md-to-skill-reinforcement-dedup.json');
  try {
    fs.mkdirSync(path.dirname(dedupPath), { recursive: true });
    fs.writeFileSync(dedupPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // ignore
  }
}

function reinforceSourceInstincts(cwd, skillName, maxConfidence) {
  const instinctDir = path.join(cwd, '.claude', 'md-to-skill-instincts');
  try {
    if (!fs.existsSync(instinctDir) || !fs.statSync(instinctDir).isDirectory()) {
      return;
    }
  } catch (e) {
    return;
  }

  const dedup = loadDedup(cwd);
  const alreadyReinforced = dedup[skillName] || [];

  const instinctFiles = fs.readdirSync(instinctDir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(instinctDir, f));

  for (const fpath of instinctFiles) {
    if (checkTimeout()) break;
    try {
      let content = fs.readFileSync(fpath, 'utf8');
      const fm = parseFrontmatter(content);
      const evolvedTo = fm.evolved_to || '';
      const instinctId = fm.id || '';

      if (evolvedTo !== skillName) continue;
      if (alreadyReinforced.includes(instinctId)) continue;

      const currentConf = fm.confidence;
      if (typeof currentConf !== 'number') continue;

      const newConf = Math.round(Math.min(currentConf + 0.02, maxConfidence) * 100) / 100;

      content = updateFrontmatterField(content, 'confidence', newConf);
      content = updateFrontmatterField(content, 'usage_reinforced', true);

      let currentCount = fm.usage_reinforcement_count;
      if (typeof currentCount !== 'number' || !Number.isInteger(currentCount)) {
        currentCount = 0;
      }
      content = updateFrontmatterField(content, 'usage_reinforcement_count', currentCount + 1);

      fs.writeFileSync(fpath, content, 'utf8');
      alreadyReinforced.push(instinctId);
    } catch (e) {
      continue;
    }
  }

  if (alreadyReinforced.length > 0) {
    dedup[skillName] = alreadyReinforced;
    saveDedup(cwd, dedup);
  }
}

// ---- Handler 1: Usage Tracking ----

function handleUsageTracking(inputData, cwd, config, skillName, toolInput) {
  try {
    // Privacy check: skip if skill args reference a secret file
    let secretPatterns = [];
    if (CONFIG_AVAILABLE) {
      // Would load from config, but config not available in JS
    }

    const skillArgs = toolInput.args || '';
    if (skillArgs && secretPatterns.length > 0) {
      const tokens = String(skillArgs).split(/\s+/);
      for (const token of tokens) {
        if (isSecretFile(token, secretPatterns)) {
          return;
        }
      }
    }

    // Load and update tracking data
    const tracking = loadTrackingFile(cwd);
    const now = new Date().toISOString();

    if (tracking.skills[skillName]) {
      tracking.skills[skillName].trigger_count += 1;
      tracking.skills[skillName].last_triggered = now;
    } else {
      tracking.skills[skillName] = {
        trigger_count: 1,
        first_seen: now,
        last_triggered: now
      };
    }

    tracking.total_invocations += 1;
    saveTrackingFile(cwd, tracking);

    // Reinforce source instincts (feedback loop)
    const maxConfidence = 0.95;
    reinforceSourceInstincts(cwd, skillName, maxConfidence);
  } catch (e) {
    // Never propagate
  }
}

// ---- Handler 2: Quick-Wins Bridge ----

function handleQuickwinsBridge(inputData, cwd, config, skillName) {
  try {
    // Config checks skipped (CONFIG_AVAILABLE = false), use defaults (enabled)

    // Only process quick-wins related skills
    if (!skillName.startsWith('quick-wins')) {
      return;
    }

    // Build observation entry
    const nowIso = new Date().toISOString();
    const observation = {
      timestamp: nowIso,
      tool: 'QuickWinsScan',
      input_summary: {
        skill: skillName,
        source: 'quick-wins-plugin'
      },
      output_summary: { success: true },
      session_id: inputData.session_id || '',
      patterns: {
        integration: {
          source_plugin: 'quick-wins',
          type: 'code-quality-scan'
        }
      }
    };

    const obsPath = getObservationsPath(cwd);
    fs.mkdirSync(path.dirname(obsPath), { recursive: true });
    fs.appendFileSync(obsPath, JSON.stringify(observation) + '\n', 'utf8');
  } catch (e) {
    // Never propagate
  }
}

// ---- Handler 3: Clarification Bridge ----

function handleClarificationBridge(inputData, cwd, config, skillName) {
  try {
    // Config checks skipped (CONFIG_AVAILABLE = false), use defaults (enabled)

    // Only process ask-before-code related skills
    if (!ABC_PATTERNS.some(p => skillName.includes(p))) {
      return;
    }

    // Build observation entry
    const nowIso = new Date().toISOString();
    const observation = {
      timestamp: nowIso,
      tool: 'ClarificationComplete',
      input_summary: {
        skill: skillName,
        source: 'ask-before-code-plugin'
      },
      output_summary: { success: true },
      session_id: inputData.session_id || '',
      patterns: {
        integration: {
          source_plugin: 'ask-before-code',
          type: 'requirement-clarification'
        }
      }
    };

    const obsPath = getObservationsPath(cwd);
    fs.mkdirSync(path.dirname(obsPath), { recursive: true });
    fs.appendFileSync(obsPath, JSON.stringify(observation) + '\n', 'utf8');
  } catch (e) {
    // Never propagate
  }
}

// ---- Main ----

function main() {
  try {
    const input = loadHookInputSync();
    let cwd = input.cwd || '.';
    cwd = findGitRoot(cwd) || cwd;

    // Load config (not available in JS, use empty)
    const config = {};

    // Extract skill name from tool input
    const toolInput = input.tool_input || {};
    const skillName = toolInput.skill || '';

    if (!skillName) {
      console.log(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    // Handler 1: Usage tracking (always runs)
    handleUsageTracking(input, cwd, config, skillName, toolInput);

    // Handler 2: Quick-wins bridge (conditional)
    if (!checkTimeout()) {
      handleQuickwinsBridge(input, cwd, config, skillName);
    }

    // Handler 3: Clarification bridge (conditional)
    if (!checkTimeout()) {
      handleClarificationBridge(input, cwd, config, skillName);
    }

    // Never block
    console.log(JSON.stringify({ ok: true }));
    process.exit(0);
  } catch (e) {
    console.log(JSON.stringify({ ok: true }));
    process.exit(0);
  }
}

main();
