#!/usr/bin/env node
/**
 * md-to-skill PreToolUse Hook - Instinct Suggestion
 *
 * Proactively suggests actions based on auto-approved instincts when tool use
 * matches instinct triggers. Never blocks execution.
 *
 * Hooks on: Write|Edit|Bash|Read
 */

const fs = require('fs');
const path = require('path');

const { parseFrontmatter, loadHookInputSync, findGitRoot, matchGlob } = require('./hook_utils');

let CONFIG_AVAILABLE = false;
let loadConfig, getInstinctConfig;
try {
  const pluginRoot = path.dirname(__dirname);
  const configLoader = require(pluginRoot + '/config/config_loader');
  loadConfig = configLoader.load_config || configLoader.loadConfig;
  getInstinctConfig = configLoader.get_instinct_config || configLoader.getInstinctConfig;
  CONFIG_AVAILABLE = true;
} catch { CONFIG_AVAILABLE = false; }


/**
 * Extract the Action section from an instinct file.
 * @param {string} content
 * @returns {string}
 */
function extractAction(content) {
  const match = content.match(/## Action\s*\n(.+?)(?:\n##|\s*$)/s);
  if (match) {
    return match[1].trim();
  }
  return '';
}


/**
 * Extract match_patterns from instinct frontmatter content.
 *
 * match_patterns is a YAML list of dicts, e.g.:
 * match_patterns:
 *   - tool: Write
 *     file_glob: "*.ts"
 *     path_contains: src/
 *   - tool: Bash
 *     command_prefix: npm
 *
 * @param {string} content
 * @returns {Array<object>}
 */
function parseMatchPatterns(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return [];

  const fmText = match[1];
  const patterns = [];
  let currentPattern = null;
  let inMatchPatterns = false;

  for (const line of fmText.split('\n')) {
    const stripped = line.trim();

    if (stripped.startsWith('match_patterns:')) {
      inMatchPatterns = true;
      continue;
    }

    if (inMatchPatterns) {
      // Check if we've left the match_patterns block (new top-level key)
      if (!line.startsWith(' ') && !line.startsWith('\t') && stripped.includes(':') && !stripped.startsWith('-')) {
        break;
      }

      if (stripped.startsWith('- ')) {
        // New pattern entry
        if (currentPattern) {
          patterns.push(currentPattern);
        }
        currentPattern = {};
        // Parse inline key-value from "- tool: Write"
        const rest = stripped.slice(2).trim();
        if (rest.includes(':')) {
          const colonIdx = rest.indexOf(':');
          const k = rest.substring(0, colonIdx).trim();
          const v = rest.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
          currentPattern[k] = v;
        }
      } else if (stripped.includes(':') && currentPattern !== null) {
        // Continuation key-value
        const colonIdx = stripped.indexOf(':');
        const k = stripped.substring(0, colonIdx).trim();
        const v = stripped.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
        currentPattern[k] = v;
      }
    }
  }

  if (currentPattern) {
    patterns.push(currentPattern);
  }

  return patterns;
}


/**
 * Load all auto-approved instincts from the instincts directory.
 * Skips rejected instincts (M3).
 * @param {string} cwd
 * @returns {Array<object>}
 */
function loadAutoApprovedInstincts(cwd) {
  const instinctsDir = path.join(cwd, '.claude', 'md-to-skill-instincts');
  const instincts = [];

  if (!fs.existsSync(instinctsDir)) {
    return instincts;
  }

  try {
    let stat;
    try { stat = fs.statSync(instinctsDir); } catch { return instincts; }
    if (!stat.isDirectory()) return instincts;

    const files = fs.readdirSync(instinctsDir);
    for (const filename of files) {
      if (!filename.endsWith('.md')) continue;

      const filepath = path.join(instinctsDir, filename);
      try {
        const content = fs.readFileSync(filepath, 'utf8');
        const fm = parseFrontmatter(content);

        // M3: Skip rejected instincts
        if (fm.rejected) continue;

        if (!fm.auto_approved) continue;

        const action = extractAction(content);

        // M4: Extract match_patterns if present
        const matchPatterns = parseMatchPatterns(content);

        instincts.push({
          id: fm.id || filename.replace('.md', ''),
          trigger: fm.trigger || '',
          domain: fm.domain || '',
          confidence: fm.confidence || 0,
          action: action,
          filepath: filepath,
          suggestions_shown: fm.suggestions_shown || 0,
          match_patterns: matchPatterns,
        });
      } catch {
        continue;
      }
    }
  } catch {
    // ignore
  }

  return instincts;
}


/**
 * M4: Check if tool use matches explicit match_patterns.
 *
 * match_patterns is a list of dicts:
 *   - {tool: "Write|Edit", file_glob: "*.ts", path_contains: "src/"}
 *   - {tool: "Bash", command_prefix: "npm"}
 *   - {tool: "Read", file_glob: "*.config.*"}
 *
 * Returns true if any pattern matches.
 * @param {Array<object>} matchPatterns
 * @param {string} toolName
 * @param {object} toolInput
 * @returns {boolean}
 */
function matchByPatterns(matchPatterns, toolName, toolInput) {
  for (const pattern of matchPatterns) {
    const patternTool = pattern.tool || '';

    // Check if tool name matches (supports pipe-separated values)
    const toolOptions = patternTool.split('|').map(t => t.trim());
    if (!toolOptions.includes(toolName)) continue;

    // For Write/Edit/Read — check file path
    if (['Write', 'Edit', 'Read'].includes(toolName)) {
      const filePath = (toolInput.file_path || '').replace(/\\/g, '/');
      if (!filePath) continue;

      const fileGlob = pattern.file_glob || '';
      const pathContains = pattern.path_contains || '';

      let globMatch = true;
      if (fileGlob) {
        const basename = path.basename(filePath);
        globMatch = matchGlob(basename, fileGlob) || matchGlob(filePath, fileGlob);
      }

      let pathMatch = true;
      if (pathContains) {
        pathMatch = filePath.toLowerCase().includes(pathContains.toLowerCase());
      }

      if (globMatch && pathMatch) return true;

    // For Bash — check command prefix
    } else if (toolName === 'Bash') {
      const command = toolInput.command || '';
      const commandPrefix = pattern.command_prefix || '';

      if (commandPrefix && command.trim().toLowerCase().startsWith(commandPrefix.toLowerCase())) {
        return true;
      } else if (!commandPrefix) {
        // Pattern matched tool but no further constraint
        return true;
      }
    }
  }

  return false;
}


/**
 * Check if an instinct trigger matches a Write/Edit tool context.
 * @param {object} instinct
 * @param {object} toolInput
 * @returns {boolean}
 */
function matchWriteEdit(instinct, toolInput) {
  const trigger = (instinct.trigger || '').toLowerCase();
  const filePath = (toolInput.file_path || '').replace(/\\/g, '/');
  if (!filePath) return false;

  const fileLower = filePath.toLowerCase();
  const basename = path.basename(fileLower);
  const ext = path.extname(basename);

  // Match file extensions mentioned in trigger
  const extPatterns = trigger.match(/\.(ts|js|py|tsx|jsx|css|scss|html|json|md|cs|yaml|yml)/g);
  if (extPatterns) {
    for (const ep of extPatterns) {
      if (ext === ep) return true;
    }
  }

  // Match path segments mentioned in trigger
  const pathKeywords = [...trigger.matchAll(/(?:in|under|within|to)\s+(\S+)/g)];
  for (const m of pathKeywords) {
    const kw = m[1];
    if (fileLower.includes(kw.replace(/\//g, '').toLowerCase())) {
      return true;
    }
  }

  // Match file type descriptions
  const typeMappings = {
    'typescript': ['.ts', '.tsx'],
    'javascript': ['.js', '.jsx'],
    'python': ['.py'],
    'style': ['.css', '.scss', '.less'],
    'template': ['.html', '.hbs'],
    'test': ['.test.', '.spec.'],
    'component': ['.component.'],
    'service': ['.service.'],
    'module': ['.module.'],
  };
  for (const [keyword, extensions] of Object.entries(typeMappings)) {
    if (trigger.includes(keyword)) {
      for (const e of extensions) {
        if (fileLower.includes(e)) return true;
      }
    }
  }

  // Match domain-based triggers
  const domain = instinct.domain || '';
  if (domain === 'naming' && (trigger.includes('writing') || trigger.includes('creating'))) {
    return true;
  }
  if (domain === 'code-style' && (trigger.includes('writing') || trigger.includes('editing'))) {
    return true;
  }

  return false;
}


/**
 * Check if an instinct trigger matches a Bash tool context.
 * @param {object} instinct
 * @param {object} toolInput
 * @returns {boolean}
 */
function matchBash(instinct, toolInput) {
  const trigger = (instinct.trigger || '').toLowerCase();
  const command = toolInput.command || '';
  if (!command) return false;

  const cmdLower = command.toLowerCase();
  const parts = cmdLower.trim().split(/\s+/);
  const firstToken = parts.length > 0 ? parts[0] : '';

  // Match command names in trigger
  const cmdPatterns = [...trigger.matchAll(/(?:running|using|executing|after)\s+(\S+)/g)];
  for (const m of cmdPatterns) {
    if (m[1].toLowerCase() === firstToken) return true;
  }

  // Match common command keywords
  const cmdKeywords = ['npm', 'git', 'python', 'node', 'bun', 'pnpm', 'yarn',
                       'dotnet', 'test', 'build', 'lint', 'deploy'];
  for (const kw of cmdKeywords) {
    if (trigger.includes(kw) && cmdLower.includes(kw)) return true;
  }

  // Match workflow triggers
  if (trigger.includes('test') && (cmdLower.includes('test') || cmdLower.includes('jest') || cmdLower.includes('vitest'))) {
    return true;
  }
  if (trigger.includes('build') && cmdLower.includes('build')) {
    return true;
  }

  return false;
}


/**
 * H4: Check if an instinct trigger matches a Read tool context.
 * Only matches if match_patterns explicitly includes Read tool.
 * @param {object} instinct
 * @param {object} toolInput
 * @returns {boolean}
 */
function matchRead(instinct, toolInput) {
  // Read matching only works via match_patterns (M4).
  // We don't do fuzzy trigger matching for Read to avoid noisy suggestions.
  return false;
}


/**
 * Increment the suggestions_shown counter in instinct frontmatter.
 * @param {string} filepath
 * @param {number} currentCount
 */
function incrementSuggestionsShown(filepath, currentCount) {
  try {
    let content = fs.readFileSync(filepath, 'utf8');
    const newCount = currentCount + 1;

    if (content.includes('suggestions_shown:')) {
      content = content.replace(
        /suggestions_shown:\s*\d+/,
        `suggestions_shown: ${newCount}`
      );
    } else {
      // Add before the closing ---
      content = content.replace(
        /\n---\n/,
        `\nsuggestions_shown: ${newCount}\n---\n`
      );
    }

    fs.writeFileSync(filepath, content, 'utf8');
  } catch {
    // ignore
  }
}


/**
 * Main entry point for the instinct suggestion hook.
 */
function main() {
  try {
    // Load hook input
    const inputData = loadHookInputSync();

    let cwd = inputData.cwd || '.';
    cwd = findGitRoot(cwd) || cwd;
    const toolName = inputData.tool_name || '';
    let toolInput = inputData.tool_input || {};

    if (typeof toolInput === 'string') {
      try {
        toolInput = JSON.parse(toolInput);
      } catch {
        toolInput = {};
      }
    }

    if (!toolName) {
      process.stdout.write(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    // Load auto-approved instincts (M3: rejected instincts filtered out)
    const instincts = loadAutoApprovedInstincts(cwd);

    if (instincts.length === 0) {
      process.stdout.write(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    // Find matching instincts
    const matches = [];
    for (const instinct of instincts) {
      const matchPatterns = instinct.match_patterns || [];

      let matched;
      // M4: If match_patterns present, use them exclusively
      if (matchPatterns.length > 0) {
        matched = matchByPatterns(matchPatterns, toolName, toolInput);
      } else {
        // Fall through to existing trigger-based matching (backward compat)
        matched = false;
        if (toolName === 'Write' || toolName === 'Edit') {
          matched = matchWriteEdit(instinct, toolInput);
        } else if (toolName === 'Bash') {
          matched = matchBash(instinct, toolInput);
        }
        // H4: Read only matches via match_patterns, not trigger fallback
      }

      if (matched) {
        matches.push(instinct);
      }
    }

    if (matches.length === 0) {
      process.stdout.write(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    // Build suggestion message from matched instincts
    const suggestions = [];
    for (const m of matches) {
      const action = m.action || '';
      if (action) {
        suggestions.push(
          `[instinct:${m.id}] (${m.domain}, confidence:${m.confidence}) ${action}`
        );
        // Increment counter
        incrementSuggestionsShown(m.filepath, m.suggestions_shown || 0);
      }
    }

    if (suggestions.length > 0) {
      const message = 'Instinct suggestions for this action:\n' + suggestions.join('\n');
      process.stdout.write(JSON.stringify({ ok: true, systemMessage: message }));
    } else {
      process.stdout.write(JSON.stringify({ ok: true }));
    }

    process.exit(0);

  } catch {
    // Never block on errors
    process.stdout.write(JSON.stringify({ ok: true }));
    process.exit(0);
  }
}

main();
