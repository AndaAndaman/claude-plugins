#!/usr/bin/env node
/**
 * Quick Wins Permission-Asking Stop Hook
 *
 * Detects completion signals and politely asks permission to run a quick wins scan
 * instead of forcing it. Respects user flow and autonomy.
 *
 * Decision Logic:
 * 1. Check exclusion criteria (urgency, mid-development, docs only, etc.) -> Allow stop
 * 2. Check for strong completion signals (1+) -> Ask permission
 * 3. Check for moderate completion signals (2+) -> Ask permission
 * 4. Otherwise -> Allow stop
 */

const fs = require('fs');
const path = require('path');

// Strong completion signals (1+ triggers permission request)
const STRONG_SIGNALS = [
  // Explicit completion
  /\b(done|finished|ready|complete|completed)\b/i,
  /\blooks?\s+(good|great|fine|ok|okay)\b/i,
  /\ball\s+set\b/i,
  /that'?s?\s+it\b/i,

  // Commit intent
  /\bready\s+to\s+commit\b/i,
  /let'?s?\s+commit\b/i,
  /\bcommit\s+(this|these|changes)\b/i,

  // Next steps queries
  /\bwhat\s*'?s?\s+next\b/i,
  /\banything\s+else\b/i,
  /\bwhat\s+(should\s+)?i\s+do\s+now\b/i,
  /\bnow\s+what(\s+next)?\b/i,

  // Testing complete
  /\btests?\s+(pass|passed|passing)\b/i,
  /\ball\s+(green|tests?\s+green)\b/i,
  /\btested\s+and\s+working\b/i,

  // Deployment mentions
  /\bready\s+to\s+deploy\b/i,
  /\bpush\s+to\s+prod\b/i,
];

// Moderate signals (2+ trigger permission request)
const MODERATE_SIGNALS = [
  /\bfeature\s+(is\s+)?(working|complete|done)\b/i,
  /\bimplementation\s+(is\s+)?(complete|done|finished)\b/i,
  /\brefactoring\s+(is\s+)?(complete|done|finished)\b/i,
  /\bbuild\s+(passes|passed|successful)\b/i,
  /\bno\s+(errors|issues|problems)\b/i,
];

// Exclusion keywords (if present, always allow stop)
const EXCLUSION_SIGNALS = [
  // Urgency
  /\b(urgent|critical|hotfix|emergency|asap|immediately)\b/i,
  /\bproduction\s+(down|issue|bug)\b/i,

  // Explicit decline
  /\bskip\s+(scan|review|quick\s+wins)\b/i,
  /\bno\s+quick\s+wins\b/i,
  /\bdon'?t\s+(scan|check|review)\b/i,
  /\bnot\s+now\b/i,

  // Mid-development indicators
  /\bstill\s+(not\s+)?working\b/i,
  /\blet\s+me\s+try\b/i,
  /\btrying\s+to\b/i,
  /\bdebugging\b/i,
];

// Code file extensions
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx',  // TypeScript/JavaScript
  '.cs',                          // C#
]);

// Compound code extensions (checked against full filename)
const CODE_COMPOUND_EXTENSIONS = [
  '.component.ts', '.service.ts', '.module.ts', '.guard.ts',  // Angular
  '.controller.cs', '.facade.cs', '.logic.cs',                 // .NET patterns
];

// Documentation/config extensions
const DOC_EXTENSIONS = new Set([
  '.md', '.txt', '.rst',
  '.json', '.yaml', '.yml', '.xml', '.toml', '.ini',
  '.gitignore', '.editorconfig',
]);

function isCodeFile(filePath) {
  if (!filePath) return false;

  const ext = path.extname(filePath).toLowerCase();
  if (CODE_EXTENSIONS.has(ext)) return true;

  // Check compound extensions
  const name = path.basename(filePath).toLowerCase();
  for (const compoundExt of CODE_COMPOUND_EXTENSIONS) {
    if (name.endsWith(compoundExt)) return true;
  }

  return false;
}

function isDocFile(filePath) {
  if (!filePath) return false;

  const ext = path.extname(filePath).toLowerCase();
  return DOC_EXTENSIONS.has(ext);
}

function checkPatternInText(patterns, text) {
  const textLower = text.toLowerCase();
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(textLower)) {
      count++;
    }
  }
  return count;
}

function extractModifiedFiles(transcriptPath) {
  const modifiedFiles = [];

  try {
    const data = fs.readFileSync(transcriptPath, 'utf8');
    const lines = data.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      let entry;
      try {
        entry = JSON.parse(line);
      } catch (e) {
        continue;
      }

      if (entry.type === 'assistant') {
        const message = entry.message || {};
        const content = message.content || [];

        for (const block of content) {
          if (block.type === 'tool_use') {
            const toolName = block.name || '';
            const toolInput = block.input || {};

            if (['Write', 'Edit', 'NotebookEdit'].includes(toolName)) {
              const filePath = toolInput.file_path || '';
              if (filePath) {
                modifiedFiles.push(filePath);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }

  return modifiedFiles;
}

function getRecentUserMessages(transcriptPath, limit) {
  limit = limit || 3;
  const userMessages = [];

  try {
    const data = fs.readFileSync(transcriptPath, 'utf8');
    const lines = data.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      let entry;
      try {
        entry = JSON.parse(line);
      } catch (e) {
        continue;
      }

      if (entry.type === 'user') {
        const message = entry.message || {};
        const content = message.content || [];

        for (const block of content) {
          if (block.type === 'text') {
            const text = block.text || '';
            if (text) {
              userMessages.push(text);
            }
          }
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }

  // Return last N messages
  return userMessages.length > 0
    ? userMessages.slice(-limit).join(' ')
    : '';
}

function analyzeCompletionSignals(transcriptPath) {
  const result = {
    should_ask: false,
    reason: '',
    code_files: [],
  };

  // Get recent user messages (last 3 messages)
  const recentMessages = getRecentUserMessages(transcriptPath, 3);

  if (!recentMessages) {
    result.reason = 'No recent user messages';
    return result;
  }

  // Check for exclusion signals
  const exclusionCount = checkPatternInText(EXCLUSION_SIGNALS, recentMessages);
  if (exclusionCount > 0) {
    result.reason = 'Exclusion signal detected';
    return result;
  }

  // Extract modified files
  const modifiedFiles = extractModifiedFiles(transcriptPath);

  if (modifiedFiles.length === 0) {
    result.reason = 'No files modified';
    return result;
  }

  // Categorize files
  const codeFiles = modifiedFiles.filter(f => isCodeFile(f));
  const docFiles = modifiedFiles.filter(f => isDocFile(f));

  // Only doc files modified
  if (codeFiles.length === 0 && docFiles.length > 0) {
    result.reason = 'Only documentation changes';
    return result;
  }

  if (codeFiles.length === 0) {
    result.reason = 'No code files modified';
    return result;
  }

  // Check for completion signals
  const strongSignalCount = checkPatternInText(STRONG_SIGNALS, recentMessages);
  const moderateSignalCount = checkPatternInText(MODERATE_SIGNALS, recentMessages);

  // Decision logic: Strong (1+) or Moderate (2+) triggers permission request
  if (strongSignalCount >= 1 || moderateSignalCount >= 2) {
    result.should_ask = true;
    result.code_files = codeFiles;
    result.reason = `Completion signals detected (strong: ${strongSignalCount}, moderate: ${moderateSignalCount})`;
  } else {
    result.reason = `Insufficient signals (strong: ${strongSignalCount}, moderate: ${moderateSignalCount})`;
  }

  return result;
}

function main() {
  try {
    // Read hook input from stdin
    const inputData = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8') || '{}');

    // Check if stop hook is already active (prevent infinite loops)
    if (inputData.stop_hook_active) {
      console.log(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    // Get transcript path
    const transcriptPath = inputData.transcript_path || '';

    if (!transcriptPath) {
      // No transcript, allow stop
      console.log(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    // Analyze completion signals
    const analysis = analyzeCompletionSignals(transcriptPath);

    if (analysis.should_ask) {
      // Ask permission instead of forcing
      const codeFiles = analysis.code_files;
      // Deduplicate preserving order
      const uniqueFiles = [...new Map(codeFiles.map(f => [f, f])).values()];

      // Format file list
      let fileList;
      if (uniqueFiles.length <= 3) {
        fileList = uniqueFiles.map(f => path.basename(f)).join(', ');
      } else {
        fileList = uniqueFiles.slice(0, 3).map(f => path.basename(f)).join(', ');
        fileList += ` (+${uniqueFiles.length - 3} more)`;
      }

      // Friendly permission request
      const result = {
        decision: 'block',
        reason: `I noticed you modified ${fileList}. Would you like me to run a quick wins scan to check for easy improvements? (Say "yes" to scan, or "no"/"skip" to continue)`
      };
      console.log(JSON.stringify(result));
    } else {
      // Allow stop
      console.log(JSON.stringify({ ok: true }));
    }

    process.exit(0);

  } catch (e) {
    // On any error, allow stop (don't block user)
    console.log(JSON.stringify({ ok: true }));
    process.exit(0);
  }
}

main();
