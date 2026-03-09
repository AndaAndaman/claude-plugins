#!/usr/bin/env node
/**
 * md-to-skill PostToolUse Hook - Structural Code Pattern Capture
 *
 * Extracts structural elements (imports, function signatures, class names,
 * decorators, exports) from Write/Edit/Bash tool_input content. Writes to
 * a separate .claude/md-to-skill-structural.jsonl file.
 *
 * Privacy: captures only structural signatures and names, never function
 * bodies, variable values, or business logic. Bash commands are sanitized
 * to remove secrets.
 *
 * Hooks on: Write|Edit|Bash
 * Never blocks execution.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  findGitRoot,
  isSecretFile,
  getStructuralObservationsPath,
  getSessionCachePath,
  loadHookInputSync,
} = require('./hook_utils');

const CONFIG_AVAILABLE = false;

// --- Constants ---

const MAX_CONTENT_BYTES = 51200; // 50KB fallback
const MAX_COMMAND_LENGTH = 2000;
const FALLBACK_SECRET_PATTERNS = [
  /--token=\S+/g,
  /--password=\S+/g,
  /API_KEY=\S+/g,
  /Bearer\s+\S+/g,
  /--secret=\S+/g,
];
// String versions for sanitize_command (rebuilt each call with 'g' flag)
const FALLBACK_SECRET_PATTERN_STRINGS = [
  '--token=\\S+',
  '--password=\\S+',
  'API_KEY=\\S+',
  'Bearer\\s+\\S+',
  '--secret=\\S+',
];

// --- Language family detection ---

const LANG_EXTENSIONS = {
  '.ts': 'ts', '.tsx': 'ts', '.js': 'ts', '.jsx': 'ts', '.mjs': 'ts',
  '.py': 'py',
  '.cs': 'cs',
};

/**
 * Map file extension to language family. Returns null for non-code files.
 */
function getLanguageFamily(filePath, langConfig) {
  if (!filePath) return null;
  const ext = path.extname(filePath).toLowerCase();

  // Use config-driven mapping if available
  if (langConfig && Object.keys(langConfig).length > 0) {
    for (const [family, extensions] of Object.entries(langConfig)) {
      if (Array.isArray(extensions) && extensions.includes(ext)) {
        return family;
      }
    }
    return null;
  }

  // Fallback to built-in mapping
  return LANG_EXTENSIONS[ext] || null;
}

// --- Compiled regex patterns per language family ---

// TypeScript/JavaScript patterns
const TS_IMPORT_RE = new RegExp(
  '^import\\s+' +
  '(?:' +
  '(?:type\\s+)?' +
  '(?:\\{([^}]+)\\}|(\\w+))' +
  '(?:\\s*,\\s*(?:\\{([^}]+)\\}|(\\w+)))?' +
  '\\s+from\\s+' +
  '[\'"]([^\'"]+)[\'"]' +
  '|' +
  '[\'"]([^\'"]+)[\'"]' + // side-effect import
  ')',
  'gm'
);
const TS_FUNCTION_RE = new RegExp(
  '(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)' +
  '\\s*(?:<[^>]+>)?\\s*' +
  '\\(([^)]*)\\)' +
  '(?:\\s*:\\s*([^\\s{]+))?',
  'gm'
);
const TS_ARROW_RE = new RegExp(
  '(?:export\\s+)?(?:const|let|var)\\s+(\\w+)' +
  '(?:\\s*:\\s*[^=]+?)?\\s*=\\s*' +
  '(?:async\\s+)?' +
  '(?:\\([^)]*\\)|(\\w+))\\s*' +
  '(?::\\s*([^\\s=>{]+))?\\s*=>',
  'gm'
);
const TS_CLASS_RE = new RegExp(
  '(?:export\\s+)?(?:abstract\\s+)?class\\s+(\\w+)' +
  '(?:\\s+extends\\s+(\\w+))?' +
  '(?:\\s+implements\\s+([\\w,\\s]+))?',
  'gm'
);
const TS_INTERFACE_RE = new RegExp(
  '(?:export\\s+)?interface\\s+(\\w+)' +
  '(?:\\s+extends\\s+([\\w,\\s]+))?',
  'gm'
);
const TS_DECORATOR_RE = new RegExp(
  '@(\\w+)\\s*(?:\\([^)]*\\))?\\s*\\n\\s*(?:export\\s+)?(?:class|function)\\s+(\\w+)',
  'gm'
);
const TS_EXPORT_RE = new RegExp(
  '^export\\s+(?:default\\s+)?(?:class|function|const|let|var|interface|type|enum|abstract)\\s+(\\w+)',
  'gm'
);

// Python patterns
const PY_IMPORT_RE = new RegExp(
  '^(?:from\\s+([\\w.]+)\\s+import\\s+([^#\\n]+)|import\\s+([\\w]+(?:\\s*,\\s*[\\w]+)*))\\s*$',
  'gm'
);
const PY_FUNCTION_RE = new RegExp(
  '^(\\s*)(?:async\\s+)?def\\s+(\\w+)\\s*\\(([^)]*)\\)' +
  '(?:\\s*->\\s*([^\\s:]+))?',
  'gm'
);
const PY_CLASS_RE = new RegExp(
  '^class\\s+(\\w+)\\s*(?:\\(([^)]*)\\))?',
  'gm'
);
const PY_DECORATOR_RE = new RegExp(
  '@(\\w[\\w.]*)\\s*(?:\\([^)]*\\))?\\s*\\n\\s*(?:class|(?:async\\s+)?def)\\s+(\\w+)',
  'gm'
);

// C# patterns
const CS_USING_RE = new RegExp(
  '^using\\s+([\\w.]+)\\s*;',
  'gm'
);
const CS_NAMESPACE_RE = new RegExp(
  'namespace\\s+([\\w.]+)',
  'gm'
);
const CS_CLASS_RE = new RegExp(
  '(?:public|private|internal|protected)?\\s*(?:static\\s+)?' +
  '(?:abstract\\s+|sealed\\s+)?class\\s+(\\w+)' +
  '(?:\\s*<[^>]+>)?' +
  '(?:\\s*:\\s*([\\w,\\s.<>]+))?',
  'gm'
);
const CS_METHOD_RE = new RegExp(
  '(?:public|private|internal|protected)\\s+' +
  '(?:static\\s+)?(?:async\\s+)?(?:virtual\\s+|override\\s+|abstract\\s+)?' +
  '([\\w<>\\[\\]?]+)\\s+(\\w+)\\s*' +
  '(?:<[^>]+>)?\\s*\\(([^)]*)\\)',
  'gm'
);
const CS_ATTRIBUTE_RE = new RegExp(
  '\\[(\\w+)(?:\\([^)]*\\))?\\]\\s*\\n\\s*' +
  '(?:public|private|internal|protected)',
  'gm'
);

// --- Helper to reset regex lastIndex ---

function resetRegexes(...regexes) {
  for (const re of regexes) {
    re.lastIndex = 0;
  }
}

// --- Structural extraction functions ---

/**
 * Extract structural elements from Write content. No implementation bodies.
 */
function extractStructuralElements(content, lang, captureCfg) {
  if (!captureCfg) captureCfg = {};

  const result = {
    imports: [],
    functions: [],
    classes: [],
    interfaces: [],
    decorators: [],
    exports: [],
    metrics: {
      lines: content.split('\n').length,
      function_count: 0,
      class_count: 0,
    },
  };

  if (lang === 'ts') {
    _extractTs(content, result, captureCfg);
  } else if (lang === 'py') {
    _extractPy(content, result, captureCfg);
  } else if (lang === 'cs') {
    _extractCs(content, result, captureCfg);
  }

  // Update metrics
  result.metrics.function_count = result.functions.length;
  result.metrics.class_count = result.classes.length;

  return result;
}

/**
 * Extract TypeScript/JavaScript structural elements.
 */
function _extractTs(content, result, captureCfg) {
  if (captureCfg.imports !== false) {
    resetRegexes(TS_IMPORT_RE);
    let m;
    while ((m = TS_IMPORT_RE.exec(content)) !== null) {
      const namesParts = [];
      for (const g of [m[1], m[2], m[3], m[4]]) {
        if (g) {
          for (const n of g.split(',')) {
            const trimmed = n.trim();
            if (trimmed) namesParts.push(trimmed);
          }
        }
      }
      const module = m[5] || m[6] || '';
      if (module) {
        result.imports.push({
          module: module,
          names: namesParts.length > 0 ? namesParts : [],
        });
      }
    }
  }

  if (captureCfg.functionSignatures !== false) {
    resetRegexes(TS_FUNCTION_RE);
    let m;
    while ((m = TS_FUNCTION_RE.exec(content)) !== null) {
      const isAsync = content.substring(Math.max(0, m.index - 10), m.index + 6).includes('async');
      const params = m[2] ? m[2].split(',').filter(p => p.trim()).length : 0;
      result.functions.push({
        name: m[1],
        params: params,
        return_type: m[3] || null,
        is_async: isAsync,
      });
    }
    resetRegexes(TS_ARROW_RE);
    while ((m = TS_ARROW_RE.exec(content)) !== null) {
      const isAsync = content.substring(Math.max(0, m.index - 10), m.index + 20).includes('async');
      result.functions.push({
        name: m[1],
        params: -1, // arrow params harder to count reliably
        return_type: m[3] || null,
        is_async: isAsync,
      });
    }
  }

  if (captureCfg.classNames !== false) {
    resetRegexes(TS_CLASS_RE);
    let m;
    while ((m = TS_CLASS_RE.exec(content)) !== null) {
      const implements_ = [];
      if (m[3]) {
        for (const i of m[3].split(',')) {
          const trimmed = i.trim();
          if (trimmed) implements_.push(trimmed);
        }
      }
      result.classes.push({
        name: m[1],
        extends: m[2] || null,
        implements: implements_,
      });
    }
    resetRegexes(TS_INTERFACE_RE);
    while ((m = TS_INTERFACE_RE.exec(content)) !== null) {
      const extends_ = [];
      if (m[2]) {
        for (const e of m[2].split(',')) {
          const trimmed = e.trim();
          if (trimmed) extends_.push(trimmed);
        }
      }
      result.interfaces.push({
        name: m[1],
        extends: extends_,
      });
    }
  }

  if (captureCfg.decorators !== false) {
    resetRegexes(TS_DECORATOR_RE);
    let m;
    while ((m = TS_DECORATOR_RE.exec(content)) !== null) {
      result.decorators.push({
        name: m[1],
        target: m[2],
      });
    }
  }

  if (captureCfg.exports !== false) {
    resetRegexes(TS_EXPORT_RE);
    let m;
    while ((m = TS_EXPORT_RE.exec(content)) !== null) {
      result.exports.push(m[1]);
    }
  }
}

/**
 * Extract Python structural elements.
 */
function _extractPy(content, result, captureCfg) {
  if (captureCfg.imports !== false) {
    resetRegexes(PY_IMPORT_RE);
    let m;
    while ((m = PY_IMPORT_RE.exec(content)) !== null) {
      if (m[1]) { // from X import Y
        const names = m[2].split(',').map(n => n.trim()).filter(n => n);
        result.imports.push({
          module: m[1],
          names: names,
        });
      } else if (m[3]) { // import X, Y
        const modules = m[3].split(',').map(n => n.trim()).filter(n => n);
        for (const mod of modules) {
          result.imports.push({
            module: mod,
            names: [],
          });
        }
      }
    }
  }

  if (captureCfg.functionSignatures !== false) {
    resetRegexes(PY_FUNCTION_RE);
    let m;
    while ((m = PY_FUNCTION_RE.exec(content)) !== null) {
      const isAsync = content.substring(Math.max(0, m.index - 10), m.index + 6).includes('async');
      const params = m[3] ? m[3].split(',').filter(p => p.trim()).length : 0;
      result.functions.push({
        name: m[2],
        params: params,
        return_type: m[4] || null,
        is_async: isAsync,
      });
    }
  }

  if (captureCfg.classNames !== false) {
    resetRegexes(PY_CLASS_RE);
    let m;
    while ((m = PY_CLASS_RE.exec(content)) !== null) {
      const bases = [];
      if (m[2]) {
        for (const b of m[2].split(',')) {
          const trimmed = b.trim();
          if (trimmed) bases.push(trimmed);
        }
      }
      result.classes.push({
        name: m[1],
        extends: bases.length > 0 ? bases[0] : null,
        implements: bases.length > 1 ? bases.slice(1) : [],
      });
    }
  }

  if (captureCfg.decorators !== false) {
    resetRegexes(PY_DECORATOR_RE);
    let m;
    while ((m = PY_DECORATOR_RE.exec(content)) !== null) {
      result.decorators.push({
        name: m[1],
        target: m[2],
      });
    }
  }
}

/**
 * Extract C# structural elements.
 */
function _extractCs(content, result, captureCfg) {
  if (captureCfg.imports !== false) {
    resetRegexes(CS_USING_RE);
    let m;
    while ((m = CS_USING_RE.exec(content)) !== null) {
      result.imports.push({
        module: m[1],
        names: [],
      });
    }
  }

  if (captureCfg.functionSignatures !== false) {
    resetRegexes(CS_METHOD_RE);
    let m;
    while ((m = CS_METHOD_RE.exec(content)) !== null) {
      const isAsync = content.substring(Math.max(0, m.index - 10), m.index + 20).includes('async');
      const params = m[3] ? m[3].split(',').filter(p => p.trim()).length : 0;
      result.functions.push({
        name: m[2],
        params: params,
        return_type: m[1] || null,
        is_async: isAsync,
      });
    }
  }

  if (captureCfg.classNames !== false) {
    resetRegexes(CS_CLASS_RE);
    let m;
    while ((m = CS_CLASS_RE.exec(content)) !== null) {
      const bases = [];
      if (m[2]) {
        for (const b of m[2].split(',')) {
          const trimmed = b.trim();
          if (trimmed) bases.push(trimmed);
        }
      }
      result.classes.push({
        name: m[1],
        extends: bases.length > 0 ? bases[0] : null,
        implements: bases.length > 1 ? bases.slice(1) : [],
      });
    }

    // Also extract namespaces as a special class-level element
    resetRegexes(CS_NAMESPACE_RE);
    while ((m = CS_NAMESPACE_RE.exec(content)) !== null) {
      if (!result.namespaces) result.namespaces = [];
      result.namespaces.push(m[1]);
    }
  }

  if (captureCfg.decorators !== false) {
    resetRegexes(CS_ATTRIBUTE_RE);
    let m;
    while ((m = CS_ATTRIBUTE_RE.exec(content)) !== null) {
      result.decorators.push({
        name: m[1],
        target: null, // C# attributes don't always have an obvious target name
      });
    }
  }
}

/**
 * Extract structural diff from Edit operation.
 */
function extractStructuralDiff(oldString, newString, lang, captureCfg) {
  if (!captureCfg) captureCfg = {};

  if (captureCfg.structuralDiffs === false) {
    return {};
  }

  const oldStruct = extractStructuralElements(oldString, lang, captureCfg);
  const newStruct = extractStructuralElements(newString, lang, captureCfg);

  const diff = {};

  // Import diffs - use string keys for Set comparison
  const oldImports = new Set(oldStruct.imports.map(i => JSON.stringify([i.module, i.names || []])));
  const newImports = new Set(newStruct.imports.map(i => JSON.stringify([i.module, i.names || []])));

  const addedImports = [];
  const removedImports = [];

  for (const entry of newImports) {
    if (!oldImports.has(entry)) {
      const [module, names] = JSON.parse(entry);
      addedImports.push({ module, names });
    }
  }
  for (const entry of oldImports) {
    if (!newImports.has(entry)) {
      const [module, names] = JSON.parse(entry);
      removedImports.push({ module, names });
    }
  }

  if (addedImports.length > 0) diff.added_imports = addedImports;
  if (removedImports.length > 0) diff.removed_imports = removedImports;

  // Function diffs
  const oldFuncs = {};
  for (const f of oldStruct.functions) oldFuncs[f.name] = f;
  const newFuncs = {};
  for (const f of newStruct.functions) newFuncs[f.name] = f;

  const oldFuncNames = new Set(Object.keys(oldFuncs));
  const newFuncNames = new Set(Object.keys(newFuncs));

  const addedFuncs = [];
  const removedFuncs = [];
  for (const n of newFuncNames) {
    if (!oldFuncNames.has(n)) addedFuncs.push({ name: n, params: newFuncs[n].params });
  }
  for (const n of oldFuncNames) {
    if (!newFuncNames.has(n)) removedFuncs.push(n);
  }

  if (addedFuncs.length > 0) diff.added_functions = addedFuncs;
  if (removedFuncs.length > 0) diff.removed_functions = removedFuncs;

  // Type changes on existing functions
  const typeChanges = [];
  for (const name of oldFuncNames) {
    if (newFuncNames.has(name)) {
      const oldRt = oldFuncs[name].return_type || null;
      const newRt = newFuncs[name].return_type || null;
      if (oldRt !== newRt) {
        typeChanges.push({
          function: name,
          old_return: oldRt,
          new_return: newRt,
        });
      }
    }
  }
  if (typeChanges.length > 0) diff.type_changes = typeChanges;

  // Decorator diffs
  const oldDecorators = new Set(oldStruct.decorators.map(d => JSON.stringify([d.name, d.target || ''])));
  const newDecorators = new Set(newStruct.decorators.map(d => JSON.stringify([d.name, d.target || ''])));

  const addedDecorators = [];
  const removedDecorators = [];
  for (const entry of newDecorators) {
    if (!oldDecorators.has(entry)) {
      const [name, target] = JSON.parse(entry);
      addedDecorators.push({ name, target });
    }
  }
  for (const entry of oldDecorators) {
    if (!newDecorators.has(entry)) {
      const [name, target] = JSON.parse(entry);
      removedDecorators.push({ name, target });
    }
  }

  if (addedDecorators.length > 0) diff.added_decorators = addedDecorators;
  if (removedDecorators.length > 0) diff.removed_decorators = removedDecorators;

  // Categorize the change
  diff.change_category = _categorizeChange(diff);

  return diff;
}

/**
 * Categorize a structural diff into a change type.
 */
function _categorizeChange(diff) {
  const hasImports = !!(diff.added_imports || diff.removed_imports);
  const hasFuncs = !!(diff.added_functions || diff.removed_functions);
  const hasTypes = !!diff.type_changes;
  const hasDecorators = !!(diff.added_decorators || diff.removed_decorators);

  if (hasImports && !hasFuncs && !hasTypes) return 'import_fix';
  if (hasTypes && !hasFuncs) return 'type_change';
  if (hasDecorators && !hasFuncs) return 'decorator_change';
  if (hasFuncs && !hasImports) return 'function_change';
  if (hasImports && hasFuncs) return 'structural_addition';
  return 'mixed';
}

/**
 * Extract structure from Bash command. Secrets sanitized.
 */
function extractBashStructure(command, secretPatterns, captureCfg) {
  if (!captureCfg) captureCfg = {};

  if (captureCfg.bashFullCommand === false) {
    return {};
  }

  // Sanitize first
  const sanitized = sanitizeCommand(command, secretPatterns || FALLBACK_SECRET_PATTERN_STRINGS);

  const result = {
    operation: 'command',
    full_command: sanitized,
  };

  // Parse command structure
  const parts = sanitized.trim().split(/\s+/);
  if (parts.length === 0) return result;

  result.program = parts[0];

  // Extract subcommand (second non-flag arg)
  if (parts.length > 1 && !parts[1].startsWith('-')) {
    result.subcommand = parts[1];
  }

  // Extract flags
  const flags = parts.slice(1).filter(p => p.startsWith('-') && !p.includes('='));
  if (flags.length > 0) result.flags = flags;

  // Extract targets (non-flag args after subcommand)
  const nonFlagArgs = parts.slice(2).filter(p => !p.startsWith('-'));
  if (nonFlagArgs.length > 0) result.targets = nonFlagArgs.slice(0, 5); // Cap at 5

  // Git-specific enrichment
  if (result.program === 'git') {
    _enrichGit(result, sanitized, parts);
  }

  // Test-specific enrichment
  if (['npm', 'npx', 'yarn', 'pnpm', 'bun'].includes(result.program)) {
    _enrichNode(result, parts);
  } else if (['pytest', 'python', 'dotnet'].includes(result.program)) {
    _enrichTest(result, parts);
  }

  return result;
}

/**
 * Extract git-specific structure.
 */
function _enrichGit(result, command, parts) {
  const subcommand = result.subcommand || '';
  if (subcommand === 'commit') {
    // Extract commit message
    let msgMatch = command.match(/-m\s+["']([^"']+)["']/);
    if (!msgMatch) {
      msgMatch = command.match(/-m\s+(\S+)/);
    }
    if (msgMatch) {
      result.git_message = msgMatch[1];
    }
  }
}

/**
 * Extract node package manager test/build targets.
 */
function _enrichNode(result, parts) {
  if (parts.length > 1) {
    const subcmd = parts[1];
    if (subcmd === 'test' || subcmd === 'run') {
      result.test_scope = parts.slice(1, 4).join(' ');
    } else if (subcmd === 'build' || (subcmd === 'run' && parts.length > 2 && parts[2] === 'build')) {
      result.build_target = parts.slice(1, 4).join(' ');
    }
  }
}

/**
 * Extract test framework targets.
 */
function _enrichTest(result, parts) {
  if (result.program === 'pytest') {
    // Get test file/dir targets
    const targets = parts.slice(1).filter(p => !p.startsWith('-'));
    if (targets.length > 0) {
      result.test_scope = targets[0];
    }
  } else if (result.program === 'dotnet' && parts.length > 1 && parts[1] === 'test') {
    result.test_scope = parts.slice(1, 3).join(' ');
  }
}

/**
 * Strip secrets from command strings.
 */
function sanitizeCommand(command, secretPatterns) {
  if (!command) return command;
  if (!secretPatterns) secretPatterns = FALLBACK_SECRET_PATTERN_STRINGS;

  let sanitized = command;
  for (const pattern of secretPatterns) {
    try {
      const re = new RegExp(pattern, 'g');
      sanitized = sanitized.replace(re, '[REDACTED]');
    } catch (e) {
      // ignore bad patterns
    }
  }

  return sanitized;
}

// --- Correction detection ---

/**
 * Check if this Edit is a correction (Edit shortly after Write to same file).
 */
function detectCorrection(toolName, filePath, cwd, sessionId) {
  if (toolName !== 'Edit' || !filePath) return false;

  const cachePath = getSessionCachePath(cwd);
  if (!fs.existsSync(cachePath)) return false;

  try {
    const cacheData = fs.readFileSync(cachePath, 'utf8');
    const cache = JSON.parse(cacheData);

    const now = new Date();
    const writes = cache.writes || [];
    for (let i = writes.length - 1; i >= 0; i--) {
      const entry = writes[i];
      if (entry.file_path === filePath) {
        try {
          const writeTime = new Date(entry.timestamp);
          if ((now - writeTime) / 1000 < 300) { // 5 minutes
            return true;
          }
        } catch (e) {
          // ignore parse errors
        }
        break;
      }
    }
  } catch (e) {
    // ignore
  }

  return false;
}

// --- File rotation ---

/**
 * Rotate structural observations file if it exceeds max size.
 */
function rotateStructuralIfNeeded(obsPath, maxBytes) {
  try {
    if (!fs.existsSync(obsPath)) return;
    const stats = fs.statSync(obsPath);
    if (stats.size < maxBytes) return;
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '-' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    const archivePath = obsPath.replace('.jsonl', `.archive-${dateStr}.jsonl`);
    fs.renameSync(obsPath, archivePath);
  } catch (e) {
    // ignore
  }
}

// --- Tool handlers ---

/**
 * Handle Write tool - extract structural elements from new file content.
 */
function _handleWrite(toolInput, maxContent, captureCfg, langConfig, secretFiles, sessionId) {
  const filePath = toolInput.file_path || '';
  const content = toolInput.content || '';

  if (!filePath || !content) return null;

  // Skip secret files
  if (isSecretFile(filePath, secretFiles)) return null;

  // Check language family
  const lang = getLanguageFamily(filePath, langConfig);
  if (!lang) return null;

  // Content size guard
  if (Buffer.byteLength(content, 'utf8') > maxContent) return null;

  const structural = extractStructuralElements(content, lang, captureCfg);
  structural.file_path = filePath;
  structural.operation = 'create';

  return {
    timestamp: new Date().toISOString(),
    tool: 'Write',
    structural: structural,
    session_id: sessionId,
  };
}

/**
 * Handle Edit tool - extract structural diff.
 */
function _handleEdit(toolInput, maxContent, captureCfg, langConfig, secretFiles, sessionId, cwd) {
  const filePath = toolInput.file_path || '';
  const oldString = toolInput.old_string || '';
  const newString = toolInput.new_string || '';

  if (!filePath || (!oldString && !newString)) return null;

  if (isSecretFile(filePath, secretFiles)) return null;

  const lang = getLanguageFamily(filePath, langConfig);
  if (!lang) return null;

  // Size guard on both strings
  const combinedSize = Buffer.byteLength(oldString + newString, 'utf8');
  if (combinedSize > maxContent) return null;

  const structural = extractStructuralDiff(oldString, newString, lang, captureCfg);
  if (!structural || Object.keys(structural).length === 0) return null;

  structural.file_path = filePath;
  structural.operation = 'modify';

  // Detect if this is a user correction
  const isCorrection = detectCorrection('Edit', filePath, cwd, sessionId);
  if (isCorrection) {
    structural.is_correction = true;
  }

  return {
    timestamp: new Date().toISOString(),
    tool: 'Edit',
    structural: structural,
    session_id: sessionId,
  };
}

/**
 * Handle Bash tool - extract command structure.
 */
function _handleBash(toolInput, maxCmdLen, captureCfg, secretPatterns, sessionId) {
  let command = toolInput.command || '';

  if (!command) return null;

  // Truncate overly long commands
  if (command.length > maxCmdLen) {
    command = command.substring(0, maxCmdLen);
  }

  const structural = extractBashStructure(command, secretPatterns, captureCfg);
  if (!structural || Object.keys(structural).length === 0) return null;

  return {
    timestamp: new Date().toISOString(),
    tool: 'Bash',
    structural: structural,
    session_id: sessionId,
  };
}

// --- Main entry point ---

function main() {
  try {
    const inputData = loadHookInputSync();

    let cwd = inputData.cwd || '.';
    cwd = findGitRoot(cwd) || cwd;
    const sessionId = inputData.session_id || '';

    // Config - CONFIG_AVAILABLE is always false in JS version
    const structuralCfg = {
      enabled: true,
      maxContentBytes: MAX_CONTENT_BYTES,
      maxCommandLength: MAX_COMMAND_LENGTH,
      languages: {},
      capturePatterns: {},
      secretCommandPatterns: FALLBACK_SECRET_PATTERN_STRINGS,
      maxStructuralObservationsMB: 10,
    };
    const privacyCfg = {
      excludeSecretFiles: [],
    };

    if (!structuralCfg.enabled) {
      process.stdout.write(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    const toolName = inputData.tool_name || '';
    const toolInput = inputData.tool_input || {};

    if (!['Write', 'Edit', 'Bash'].includes(toolName)) {
      process.stdout.write(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    // --- Route by tool type ---

    const maxContent = structuralCfg.maxContentBytes || MAX_CONTENT_BYTES;
    const maxCmdLen = structuralCfg.maxCommandLength || MAX_COMMAND_LENGTH;
    const captureCfg = structuralCfg.capturePatterns || {};
    const langConfig = structuralCfg.languages || {};
    const secretPatterns = structuralCfg.secretCommandPatterns || FALLBACK_SECRET_PATTERN_STRINGS;
    const secretFiles = privacyCfg.excludeSecretFiles || [];

    let observation = null;

    if (toolName === 'Write') {
      observation = _handleWrite(toolInput, maxContent, captureCfg, langConfig, secretFiles, sessionId);
    } else if (toolName === 'Edit') {
      observation = _handleEdit(toolInput, maxContent, captureCfg, langConfig, secretFiles, sessionId, cwd);
    } else if (toolName === 'Bash') {
      observation = _handleBash(toolInput, maxCmdLen, captureCfg, secretPatterns, sessionId);
    }

    if (observation) {
      // Write structural observation
      const obsPath = getStructuralObservationsPath(cwd);
      const maxMB = structuralCfg.maxStructuralObservationsMB || 10;
      const maxBytes = maxMB * 1024 * 1024;

      rotateStructuralIfNeeded(obsPath, maxBytes);

      const obsDir = path.dirname(obsPath);
      if (!fs.existsSync(obsDir)) {
        fs.mkdirSync(obsDir, { recursive: true });
      }
      fs.appendFileSync(obsPath, JSON.stringify(observation) + '\n', 'utf8');
    }

    process.stdout.write(JSON.stringify({ ok: true }));
    process.exit(0);

  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: true }));
    process.exit(0);
  }
}

main();
