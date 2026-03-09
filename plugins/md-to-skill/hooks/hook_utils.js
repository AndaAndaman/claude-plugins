/**
 * md-to-skill Hook Utilities - Shared functions for hooks.
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

module.exports = {
  findGitRoot,
  loadHookInputSync,
};
