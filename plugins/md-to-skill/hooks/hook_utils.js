/**
 * md-to-skill Hook Utilities - Shared functions for all hooks.
 *
 * Provides common utilities extracted from individual hook scripts to reduce
 * duplication and ensure consistent behavior across the hook pipeline.
 *
 * Importable without side effects. All functions use defensive try/catch.
 */

const fs = require('fs');
const path = require('path');

/**
 * Walk up from start to find the nearest .git directory (repo root).
 * @param {string} start
 * @returns {string|null}
 */
function findGitRoot(start) {
  let current = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(current, '.git')) &&
        fs.statSync(path.join(current, '.git')).isDirectory()) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Get cwd from hook input, resolved to the git repo root.
 * @param {object} inputData
 * @returns {string}
 */
function resolveCwd(inputData) {
  const cwd = inputData.cwd || '.';
  return findGitRoot(cwd) || cwd;
}

/**
 * Get the plugin root path (parent of hooks directory).
 * @returns {string}
 */
function getPluginRoot() {
  return path.dirname(__dirname);
}

/**
 * Load and parse hook input from stdin.
 * Returns parsed object with tool_input deserialized if it was a string.
 * @returns {Promise<object>}
 */
function loadHookInput() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        const inputData = JSON.parse(data);
        let toolInput = inputData.tool_input || {};
        if (typeof toolInput === 'string') {
          try {
            inputData.tool_input = JSON.parse(toolInput);
          } catch (e) {
            inputData.tool_input = {};
          }
        }
        resolve(inputData);
      } catch (e) {
        reject(e);
      }
    });
    process.stdin.on('error', reject);
  });
}

/**
 * Load hook input synchronously from stdin.
 * @returns {object}
 */
function loadHookInputSync() {
  let data = '';
  const buf = Buffer.alloc(65536);
  let bytesRead;
  try {
    while (true) {
      bytesRead = fs.readSync(0, buf, 0, buf.length);
      if (bytesRead === 0) break;
      data += buf.toString('utf8', 0, bytesRead);
    }
  } catch (e) {
    // EAGAIN or EOF
  }
  const inputData = JSON.parse(data);
  let toolInput = inputData.tool_input || {};
  if (typeof toolInput === 'string') {
    try {
      inputData.tool_input = JSON.parse(toolInput);
    } catch (e) {
      inputData.tool_input = {};
    }
  }
  return inputData;
}

/**
 * Check if file path matches any secret file pattern.
 * @param {string} filePath
 * @param {string[]} secretPatterns
 * @returns {boolean}
 */
function isSecretFile(filePath, secretPatterns) {
  if (!filePath || !secretPatterns || secretPatterns.length === 0) return false;
  const basename = path.basename(filePath);
  for (const pattern of secretPatterns) {
    if (matchGlob(basename, pattern)) return true;
  }
  return false;
}

/**
 * Simple glob matching (supports * and ? wildcards).
 * @param {string} str
 * @param {string} pattern
 * @returns {boolean}
 */
function matchGlob(str, pattern) {
  // Convert glob pattern to regex
  let regexStr = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      regexStr += '.*';
    } else if (c === '?') {
      regexStr += '.';
    } else if (c === '.') {
      regexStr += '\\.';
    } else {
      regexStr += c.replace(/[\\{}()+^$|]/g, '\\$&');
    }
  }
  regexStr += '$';
  try {
    return new RegExp(regexStr, 'i').test(str);
  } catch (e) {
    return str === pattern;
  }
}

/**
 * Get path to observations JSONL file.
 * @param {string} cwd
 * @returns {string}
 */
function getObservationsPath(cwd) {
  return path.join(cwd, '.claude', 'md-to-skill-observations.jsonl');
}

/**
 * Get path to md-to-skill cache directory.
 * @param {string} cwd
 * @returns {string}
 */
function getCacheDir(cwd) {
  return path.join(cwd, '.claude', 'md-to-skill-cache');
}

/**
 * Migrate a singleton cache file from flat layout to cache subdirectory.
 * Returns the new path (in md-to-skill-cache/).
 * @param {string} cwd
 * @param {string} oldName
 * @param {string} newName
 * @returns {string}
 */
function migrateCacheFile(cwd, oldName, newName) {
  const cacheDir = getCacheDir(cwd);
  const newPath = path.join(cacheDir, newName);
  const oldPath = path.join(cwd, '.claude', oldName);

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

/**
 * Get path to structural observations JSONL file.
 * @param {string} cwd
 * @returns {string}
 */
function getStructuralObservationsPath(cwd) {
  return path.join(cwd, '.claude', 'md-to-skill-structural.jsonl');
}

/**
 * Get path to structural cache file (with migration from flat layout).
 * @param {string} cwd
 * @returns {string}
 */
function getStructuralCachePath(cwd) {
  return migrateCacheFile(cwd, 'md-to-skill-structural-cache.json', 'structural-cache.json');
}

/**
 * Get path to lightweight session cache for tracking recent writes.
 * @param {string} cwd
 * @returns {string}
 */
function getSessionCachePath(cwd) {
  return migrateCacheFile(cwd, 'md-to-skill-session-cache.json', 'session-cache.json');
}

/**
 * Parse YAML frontmatter from markdown content (simple key-value parser).
 * @param {string} content
 * @returns {object}
 */
function parseFrontmatter(content) {
  const fm = {};
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return fm;

  const lines = match[1].split('\n');
  for (let line of lines) {
    line = line.trim();
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.substring(0, colonIdx).trim();
    let value = line.substring(colonIdx + 1).trim();
    // Strip quotes
    value = value.replace(/^["']|["']$/g, '');

    // Handle boolean/numeric values
    if (value.toLowerCase() === 'true') {
      fm[key] = true;
    } else if (value.toLowerCase() === 'false') {
      fm[key] = false;
    } else if (value.includes('.') && /^\d+\.\d+$/.test(value)) {
      fm[key] = parseFloat(value);
    } else if (/^\d+$/.test(value)) {
      fm[key] = parseInt(value, 10);
    } else {
      fm[key] = value;
    }
  }
  return fm;
}

/**
 * Update a single field in YAML frontmatter, or add it if not present.
 * @param {string} content
 * @param {string} key
 * @param {*} newValue
 * @returns {string}
 */
function updateFrontmatterField(content, key, newValue) {
  const match = content.match(/^(---\s*\n)([\s\S]*?)(\n---)/);
  if (!match) return content;

  const prefix = match[1];
  let fmBody = match[2];
  const suffix = match[3];
  const rest = content.substring(match.index + match[0].length);

  // Format the value
  let valStr;
  if (typeof newValue === 'boolean') {
    valStr = newValue ? 'true' : 'false';
  } else if (typeof newValue === 'number') {
    valStr = String(newValue);
  } else {
    valStr = `"${newValue}"`;
  }

  // Try to replace existing field
  const pattern = new RegExp(`^(${escapeRegExp(key)}\\s*:\\s*)(.*)$`, 'm');
  if (pattern.test(fmBody)) {
    fmBody = fmBody.replace(pattern, `$1${valStr}`);
  } else {
    fmBody = fmBody.trimEnd() + '\n' + key + ': ' + valStr;
  }

  return prefix + fmBody + suffix + rest;
}

/**
 * Escape a string for use in a RegExp.
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  findGitRoot,
  resolveCwd,
  getPluginRoot,
  loadHookInput,
  loadHookInputSync,
  isSecretFile,
  matchGlob,
  getObservationsPath,
  getCacheDir,
  migrateCacheFile,
  getStructuralObservationsPath,
  getStructuralCachePath,
  getSessionCachePath,
  parseFrontmatter,
  updateFrontmatterField,
  escapeRegExp,
};
