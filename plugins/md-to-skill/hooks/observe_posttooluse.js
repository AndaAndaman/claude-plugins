#!/usr/bin/env node
/**
 * md-to-skill PostToolUse Hook - Observation Collector (Node.js port)
 *
 * Captures tool use patterns to .claude/md-to-skill-observations.jsonl for later
 * analysis by the /observe command. Detects richer patterns including user
 * corrections, error resolutions, naming conventions, and tool preferences.
 *
 * Hooks on: Write|Edit|Bash|Read (actions that reveal preferences)
 * Never blocks execution.
 */

try {
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');

  const {
    findGitRoot,
    loadHookInputSync,
    isSecretFile,
    getObservationsPath,
    getSessionCachePath,
  } = require('./hook_utils');

  // Config not available in JS (Python-only config_loader)
  const CONFIG_AVAILABLE = false;

  // Fallback defaults
  const FALLBACK_MAX_FILE_SIZE_MB = 10;
  const FALLBACK_MAX_COMMAND_PREVIEW = 200;
  const SESSION_CACHE_MAX_ENTRIES = 20;
  const FALLBACK_SESSION_CACHE_TTL_HOURS = 4;

  // Default sampling rates per tool
  const DEFAULT_SAMPLING_RATES = {
    Write: 1.0,
    Edit: 1.0,
    Bash: 1.0,
    Read: 0.2,
  };

  /**
   * Filter entries older than cutoffSeconds.
   */
  function filterByTtl(entries, now, cutoffSeconds) {
    const result = [];
    for (const entry of entries) {
      try {
        const ts = new Date(entry.timestamp || '');
        if ((now - ts) / 1000 < cutoffSeconds) {
          result.push(entry);
        }
      } catch (e) {
        // Keep entries with unparseable timestamps (don't discard data)
        result.push(entry);
      }
    }
    return result;
  }

  /**
   * Load session cache tracking recent Write operations.
   *
   * Applies hybrid TTL:
   * - If sessionId differs from cached last_session_id, clear entries
   * - If no sessionId, filter out entries older than ttlHours
   */
  function loadSessionCache(cwd, sessionId, ttlHours) {
    sessionId = sessionId || '';
    ttlHours = ttlHours || FALLBACK_SESSION_CACHE_TTL_HOURS;
    const cachePath = getSessionCachePath(cwd);
    const defaultCache = { writes: [], bash_failures: [], last_session_id: '' };

    if (!fs.existsSync(cachePath)) {
      return defaultCache;
    }

    try {
      const raw = fs.readFileSync(cachePath, 'utf8');
      const data = JSON.parse(raw);
      if (!data.writes) data.writes = [];
      if (!data.bash_failures) data.bash_failures = [];

      const cachedSessionId = data.last_session_id || '';

      // Session-based TTL: if session changed, clear entries
      if (sessionId && cachedSessionId && sessionId !== cachedSessionId) {
        data.writes = [];
        data.bash_failures = [];
        data.last_session_id = sessionId;
        return data;
      }

      // Time-based TTL: if no sessionId, filter old entries
      if (!sessionId) {
        const now = new Date();
        const cutoffSeconds = ttlHours * 3600;
        data.writes = filterByTtl(data.writes, now, cutoffSeconds);
        data.bash_failures = filterByTtl(data.bash_failures, now, cutoffSeconds);
      }

      return data;
    } catch (e) {
      return defaultCache;
    }
  }

  /**
   * Save session cache, keeping only the most recent entries.
   */
  function saveSessionCache(cwd, cache, sessionId) {
    sessionId = sessionId || '';
    const cachePath = getSessionCachePath(cwd);
    try {
      // Trim to max entries
      cache.writes = cache.writes.slice(-SESSION_CACHE_MAX_ENTRIES);
      cache.bash_failures = cache.bash_failures.slice(-SESSION_CACHE_MAX_ENTRIES);

      // Store sessionId for TTL detection
      if (sessionId) {
        cache.last_session_id = sessionId;
      }

      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf8');
    } catch (e) {
      // ignore
    }
  }

  /**
   * Rotate observations file if it exceeds max size.
   */
  function rotateIfNeeded(obsPath, maxBytes) {
    try {
      if (!fs.existsSync(obsPath)) return;
      const size = fs.statSync(obsPath).size;
      if (size < maxBytes) return;

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr =
        now.getFullYear().toString() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        '-' +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds());
      const archivePath = obsPath.replace('.jsonl', `.archive-${dateStr}.jsonl`);
      fs.renameSync(obsPath, archivePath);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Detect naming case style from a file or directory name.
   */
  function detectCaseStyle(name) {
    const base = name.includes('.') ? name.split('.').slice(0, -1).join('.') : name;

    if (base.includes('-')) return 'kebab-case';
    if (base.includes('_')) return 'snake_case';
    if (/^[A-Z]/.test(base) && /[A-Z]/.test(base.slice(1))) return 'PascalCase';
    if (/^[a-z]/.test(base) && /[A-Z]/.test(base.slice(1))) return 'camelCase';
    return 'unknown';
  }

  /**
   * Extract suffix pattern like .test.ts, .spec.js, .module.ts.
   */
  function getSuffixPattern(filePath) {
    const basename = path.basename(filePath);
    const parts = basename.split('.');
    if (parts.length >= 3) {
      return '.' + parts.slice(-2).join('.');
    } else if (parts.length >= 2) {
      return '.' + parts[parts.length - 1];
    }
    return '';
  }

  /**
   * Compute a lightweight hash representing the workflow pattern.
   */
  function computeWorkflowHash(toolName, inputSummary) {
    const keyParts = [toolName];

    if (inputSummary.file_path) {
      const ext = path.extname(inputSummary.file_path);
      keyParts.push(ext);
    }

    if (inputSummary.command_preview) {
      const cmd = inputSummary.command_preview.trim();
      const firstToken = cmd.split(/\s+/)[0] || '';
      keyParts.push(firstToken);
    }

    const raw = keyParts.join('|');
    return crypto.createHash('md5').update(raw).digest('hex').slice(0, 8);
  }

  /**
   * Detect richer patterns from the tool use context.
   */
  function detectPatterns(toolName, toolInput, toolOutput, inputSummary, outputSummary, sessionCache, captureConfig) {
    const patterns = {};

    const filePath = inputSummary.file_path || '';

    // --- User corrections: Edit after recent Write to same file ---
    if ((captureConfig.userCorrections !== false) && toolName === 'Edit' && filePath) {
      const now = new Date();
      const writes = sessionCache.writes || [];
      for (let i = writes.length - 1; i >= 0; i--) {
        const writeEntry = writes[i];
        if (writeEntry.file_path === filePath) {
          try {
            const writeTime = new Date(writeEntry.timestamp);
            const secondsSince = (now - writeTime) / 1000;
            if (secondsSince < 300) {
              patterns.correction = {
                target_file: filePath,
                seconds_since_write: Math.round(secondsSince),
              };
              inputSummary.is_correction = true;
            }
          } catch (e) {
            // ignore
          }
          break;
        }
      }
    }

    // --- Error resolutions: Bash success after previous Bash failure ---
    if ((captureConfig.errorResolutions !== false) && toolName === 'Bash') {
      if (outputSummary.success) {
        const cmdPreview = inputSummary.command_preview || '';
        const firstToken = cmdPreview.split(/\s+/)[0] || '';
        const failures = sessionCache.bash_failures || [];
        for (let i = failures.length - 1; i >= 0; i--) {
          const failure = failures[i];
          const failedFirstToken = failure.first_token || '';
          if (firstToken && firstToken === failedFirstToken) {
            patterns.error_resolution = {
              command_prefix: firstToken,
              resolved: true,
            };
            break;
          }
        }
      }
    }

    // --- File naming conventions ---
    if ((captureConfig.fileNamingConventions !== false) && filePath) {
      const basename = path.basename(filePath);
      const caseStyle = detectCaseStyle(basename);
      const suffix = getSuffixPattern(filePath);
      if (caseStyle !== 'unknown') {
        const naming = { case: caseStyle };
        if (suffix) {
          naming.suffix_pattern = suffix;
        }
        patterns.naming = naming;
      }
    }

    // --- Tool preferences ---
    if ((captureConfig.toolPreferences !== false) && toolName === 'Bash') {
      const cmd = inputSummary.command_preview || '';
      if (cmd) {
        if (/\b(grep|rg)\b/.test(cmd)) {
          patterns.tool_preference = {
            category: 'search',
            chose: 'bash_grep',
          };
        } else if (/\b(echo|cat)\b.*>/.test(cmd)) {
          patterns.tool_preference = {
            category: 'write',
            chose: 'bash_redirect',
          };
        }
      }
    }

    // --- Workflow hash ---
    patterns.workflow_hash = computeWorkflowHash(toolName, inputSummary);

    return patterns;
  }

  /**
   * Extract lightweight summary from tool input (no full content).
   */
  function extractInputSummary(toolName, toolInput, maxCmdPreview) {
    const summary = {};

    if (toolName === 'Write') {
      summary.file_path = toolInput.file_path || '';
      const content = toolInput.content || '';
      summary.content_length = content.length;
    } else if (toolName === 'Edit') {
      summary.file_path = toolInput.file_path || '';
      summary.has_old_string = Boolean(toolInput.old_string);
      summary.replace_all = toolInput.replace_all || false;
    } else if (toolName === 'Bash') {
      const command = toolInput.command || '';
      summary.command_preview = command.slice(0, maxCmdPreview);
      summary.command_length = command.length;
    } else if (toolName === 'Read') {
      summary.file_path = toolInput.file_path || '';
    }

    return summary;
  }

  /**
   * Extract lightweight summary from tool output.
   */
  function extractOutputSummary(toolName, toolOutput) {
    const summary = {};

    if (toolOutput && typeof toolOutput === 'object' && !Array.isArray(toolOutput)) {
      if ('error' in toolOutput) {
        summary.success = false;
        summary.error_type = String(toolOutput.error || '').slice(0, 100);
      } else {
        summary.success = true;
      }
    } else if (typeof toolOutput === 'string') {
      summary.success = !toolOutput.toLowerCase().slice(0, 200).includes('error');
    } else {
      summary.success = true;
    }

    return summary;
  }

  /**
   * Check if this Edit targets a file with a recent Write (correction pattern).
   */
  function isCorrectionPattern(toolName, filePath, sessionCache) {
    if (toolName !== 'Edit' || !filePath) return false;
    const now = new Date();
    const writes = sessionCache.writes || [];
    for (let i = writes.length - 1; i >= 0; i--) {
      const writeEntry = writes[i];
      if (writeEntry.file_path === filePath) {
        try {
          const writeTime = new Date(writeEntry.timestamp);
          if ((now - writeTime) / 1000 < 300) {
            return true;
          }
        } catch (e) {
          // ignore
        }
        break;
      }
    }
    return false;
  }

  /**
   * Determine whether to record this observation based on sampling.
   *
   * Exemptions (always record):
   * - Errors (outputSummary.success is false)
   * - Correction patterns (Edit after recent Write to same file)
   */
  function shouldSample(toolName, samplingRates, outputSummary, isCorrection) {
    // Always record errors
    if (outputSummary.success === false) return true;

    // Always record corrections
    if (isCorrection) return true;

    // Apply sampling rate
    const rate = samplingRates[toolName] !== undefined ? samplingRates[toolName] : 1.0;
    return Math.random() < rate;
  }

  /**
   * Update session cache with Write and Bash failure tracking.
   *
   * Note: Read is NOT added to session cache writes (Read is not a Write).
   */
  function updateSessionCache(toolName, filePath, inputSummary, outputSummary, cwd, sessionCache, sessionId) {
    const nowIso = new Date().toISOString();

    if (toolName === 'Write' && filePath) {
      sessionCache.writes.push({
        file_path: filePath,
        timestamp: nowIso,
      });
    }

    if (toolName === 'Bash' && outputSummary.success === false) {
      const cmdPreview = inputSummary.command_preview || '';
      const firstToken = cmdPreview.split(/\s+/)[0] || '';
      if (firstToken) {
        sessionCache.bash_failures.push({
          first_token: firstToken,
          timestamp: nowIso,
        });
      }
    }

    saveSessionCache(cwd, sessionCache, sessionId);
  }

  /**
   * Main entry point for the observation collector hook.
   */
  function main() {
    const inputData = loadHookInputSync();

    let cwd = inputData.cwd || '.';
    cwd = findGitRoot(cwd) || cwd;
    const sessionId = inputData.session_id || '';

    // Load config (centralized or fallback)
    let observerCfg, privacyCfg;
    if (CONFIG_AVAILABLE) {
      // Would load from config_loader here, but not available in JS
      observerCfg = {};
      privacyCfg = {};
    } else {
      observerCfg = {
        enabled: true,
        maxObservationsMB: FALLBACK_MAX_FILE_SIZE_MB,
        capturePatterns: {},
        excludeTools: [],
        excludePathPatterns: [],
        samplingRates: DEFAULT_SAMPLING_RATES,
        sessionCacheTTLHours: FALLBACK_SESSION_CACHE_TTL_HOURS,
      };
      privacyCfg = {
        maxCommandPreviewLength: FALLBACK_MAX_COMMAND_PREVIEW,
        excludeSecretFiles: [],
      };
    }

    if (!observerCfg.enabled) {
      process.stdout.write(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    const toolName = inputData.tool_name || '';
    const toolInput = inputData.tool_input || {};
    const toolOutput = inputData.tool_output || {};

    if (!toolName) {
      process.stdout.write(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    // Check if tool is excluded
    if ((observerCfg.excludeTools || []).includes(toolName)) {
      process.stdout.write(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    // Extract summaries
    const maxCmdPreview = privacyCfg.maxCommandPreviewLength || FALLBACK_MAX_COMMAND_PREVIEW;
    const inputSummary = extractInputSummary(toolName, toolInput, maxCmdPreview);
    const outputSummary = extractOutputSummary(toolName, toolOutput);

    // Privacy enforcement: skip secret files
    const filePath = inputSummary.file_path || '';
    const secretPatterns = privacyCfg.excludeSecretFiles || [];
    if (filePath && isSecretFile(filePath, secretPatterns)) {
      process.stdout.write(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    // Check excluded path patterns
    const excludePathPatterns = observerCfg.excludePathPatterns || [];
    if (filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      for (const pattern of excludePathPatterns) {
        if (normalized.includes(pattern)) {
          process.stdout.write(JSON.stringify({ ok: true }));
          process.exit(0);
        }
      }
    }

    // Load session cache with TTL support
    const ttlHours = observerCfg.sessionCacheTTLHours || FALLBACK_SESSION_CACHE_TTL_HOURS;
    const sessionCache = loadSessionCache(cwd, sessionId, ttlHours);

    // Per-tool sampling - check before doing heavy pattern detection
    const samplingRates = observerCfg.samplingRates || DEFAULT_SAMPLING_RATES;
    const correction = isCorrectionPattern(toolName, filePath, sessionCache);

    if (!shouldSample(toolName, samplingRates, outputSummary, correction)) {
      // Still update session cache even if not recording
      updateSessionCache(toolName, filePath, inputSummary, outputSummary, cwd, sessionCache, sessionId);
      process.stdout.write(JSON.stringify({ ok: true }));
      process.exit(0);
    }

    // Detect patterns
    const captureConfig = observerCfg.capturePatterns || {};
    const patterns = detectPatterns(
      toolName, toolInput, toolOutput,
      inputSummary, outputSummary,
      sessionCache, captureConfig
    );

    // Update session cache (Write tracking and Bash failure tracking)
    updateSessionCache(toolName, filePath, inputSummary, outputSummary, cwd, sessionCache, sessionId);

    // Build observation entry
    const observation = {
      timestamp: new Date().toISOString(),
      tool: toolName,
      input_summary: inputSummary,
      output_summary: outputSummary,
      session_id: sessionId,
      patterns: patterns,
    };

    // Write observation
    const obsPath = getObservationsPath(cwd);
    const maxMb = observerCfg.maxObservationsMB || FALLBACK_MAX_FILE_SIZE_MB;
    const maxBytes = maxMb * 1024 * 1024;

    // Rotate if needed
    rotateIfNeeded(obsPath, maxBytes);

    // Append observation
    fs.mkdirSync(path.dirname(obsPath), { recursive: true });
    fs.appendFileSync(obsPath, JSON.stringify(observation) + '\n', 'utf8');

    // Never block
    process.stdout.write(JSON.stringify({ ok: true }));
    process.exit(0);
  }

  main();
} catch (e) {
  // Never block on errors
  process.stdout.write(JSON.stringify({ ok: true }));
  process.exit(0);
}
