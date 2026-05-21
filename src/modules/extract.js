// src/modules/extract.js — Context Extraction Module
// Pulls raw context from all available sources in priority order
//
// Priority 1: Planning docs (PRD, SRD, spec)
// Priority 2: Architecture docs (ARCHITECTURE.md, ADR/)
// Priority 3: Implementation plan
// Priority 4: AI chat logs (from detected tools)
// Priority 5: Build/error logs
// Priority 6: Task/changelog docs
// Priority 7: Test results
// Priority 8: Git log history
// Priority 9: Current diff (git diff --staged)

const path = require('path');
const { readFile, readLastLines, fileExists, isDirectory, listDir } = require('../utils/files');
const { getStagedDiff, getRecentLog } = require('../utils/git');

/**
 * Extract all available context from a project
 * @param {string} projectRoot - Absolute path to project root
 * @param {Object} detectionReport - Output from detect.js
 * @returns {Object} Structured extracted context
 */
function extract(projectRoot, detectionReport) {
  const context = {
    docs: {
      prd: null,
      srd: null,
      architecture: null,
      implementationPlan: null,
      tasks: null,
      changelog: null,
    },
    logs: {
      build: null,
      error: null,
      testResults: null,
    },
    chatLogs: {
      detectionLayer: detectionReport.detectionLayer,
      tool: null,
      messages: null,
    },
    git: {
      diff: null,
      recentLog: null,
    },
  };

  // ── Priority 1: Planning docs ───────────────────────────────────────────
  if (detectionReport.docs.prd) {
    context.docs.prd = readDocFile(projectRoot, detectionReport.docs.prd, 'PRD');
  }
  if (detectionReport.docs.srd) {
    context.docs.srd = readDocFile(projectRoot, detectionReport.docs.srd, 'SRD');
  }

  // ── Priority 2: Architecture docs ───────────────────────────────────────
  if (detectionReport.docs.architecture) {
    const archPath = detectionReport.docs.architecture;
    if (archPath.endsWith('/')) {
      // It's a directory (ADR/, decisions/) — read all .md files in it
      context.docs.architecture = readDocsFromDir(projectRoot, archPath);
    } else {
      context.docs.architecture = readDocFile(projectRoot, archPath, 'ARCHITECTURE');
    }
  }

  // ── Priority 3: Implementation plan ─────────────────────────────────────
  if (detectionReport.docs.implementationPlan) {
    context.docs.implementationPlan = readDocFile(
      projectRoot, detectionReport.docs.implementationPlan, 'IMPLEMENTATION PLAN'
    );
  }

  // ── Priority 4: AI chat logs ────────────────────────────────────────────
  // Attach project root so extractChatLogs can pass it to workspace-aware extractors
  detectionReport._projectRoot = projectRoot;
  const chatResult = extractChatLogs(detectionReport);
  if (chatResult) {
    context.chatLogs.tool = chatResult.tool;
    context.chatLogs.messages = chatResult.messages;
  }

  // ── Priority 5: Build and error logs ────────────────────────────────────
  if (detectionReport.docs.buildLog) {
    const buildPath = resolveDocPath(projectRoot, detectionReport.docs.buildLog);
    context.logs.build = readLastLines(buildPath, 100);
  }
  if (detectionReport.docs.errorLog) {
    const errorPath = resolveDocPath(projectRoot, detectionReport.docs.errorLog);
    context.logs.error = readLastLines(errorPath, 50);
  }

  // ── Priority 6: Task and changelog docs ─────────────────────────────────
  if (detectionReport.docs.tasks) {
    const tasksPath = detectionReport.docs.tasks;
    if (tasksPath.endsWith('/')) {
      context.docs.tasks = readDocsFromDir(projectRoot, tasksPath);
    } else {
      context.docs.tasks = readDocFile(projectRoot, tasksPath, 'TASKS');
    }
  }
  if (detectionReport.docs.changelog) {
    const changelogPath = resolveDocPath(projectRoot, detectionReport.docs.changelog);
    // Read last 20 entries — approximate by reading last 200 lines
    context.docs.changelog = readLastLines(changelogPath, 200);
  }

  // ── Priority 7: Test results ────────────────────────────────────────────
  if (detectionReport.docs.testResults) {
    context.logs.testResults = extractTestResults(projectRoot, detectionReport.docs.testResults);
  }

  // ── Priority 8: Git log ─────────────────────────────────────────────────
  context.git.recentLog = getRecentLog(projectRoot, 10);

  // ── Priority 9: Current diff ────────────────────────────────────────────
  context.git.diff = getStagedDiff(projectRoot);

  return context;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Resolve a doc path (could be relative like ./prd.md) to absolute
 */
function resolveDocPath(projectRoot, docPath) {
  if (path.isAbsolute(docPath)) return docPath;
  // Remove leading ./ if present
  const cleaned = docPath.replace(/^\.\//, '');
  return path.join(projectRoot, cleaned);
}

/**
 * Read a document file and return its tagged content
 */
function readDocFile(projectRoot, docPath, tag) {
  const fullPath = resolveDocPath(projectRoot, docPath);
  const content = readFile(fullPath);
  if (!content) return null;
  return content.trim();
}

/**
 * Read all markdown files from a directory and concatenate them
 */
function readDocsFromDir(projectRoot, dirPath) {
  const fullDir = resolveDocPath(projectRoot, dirPath);
  if (!isDirectory(fullDir)) return null;

  const entries = listDir(fullDir);
  const mdFiles = entries.filter(f => f.endsWith('.md'));

  if (mdFiles.length === 0) return null;

  const contents = [];
  for (const file of mdFiles) {
    const content = readFile(path.join(fullDir, file));
    if (content) {
      contents.push(`--- ${file} ---\n${content.trim()}`);
    }
  }

  return contents.join('\n\n') || null;
}

/**
 * Extract chat logs from detected AI tools
 * Returns developer messages only, code blocks stripped, limited to last 50
 */
function extractChatLogs(detectionReport) {
  // Try custom log path first
  if (detectionReport.customLogPath) {
    const content = readFile(detectionReport.customLogPath);
    if (content) {
      return {
        tool: 'custom',
        messages: extractDeveloperMessages(content),
      };
    }
  }

  // Layer 1 — known tools with log paths
  if (detectionReport.detectionLayer === 1 && Object.keys(detectionReport.logPaths).length > 0) {
    const logTypes = detectionReport.logTypes || {};

    for (const [toolName, logPath] of Object.entries(detectionReport.logPaths)) {
      // Special case: Antigravity/Gemini brain format
      if (logTypes[toolName] === 'antigravity-brain') {
        const messages = extractAntigravityLogs(logPath, detectionReport._projectRoot);
        if (messages) {
          return {
            tool: toolName,
            messages,
          };
        }
        continue;
      }

      // Special case: Aider — the log IS the file
      if (toolName === 'aider') {
        const content = readFile(logPath);
        if (content) {
          return {
            tool: toolName,
            messages: extractDeveloperMessages(content),
          };
        }
        continue;
      }

      // For directory-based logs, find the most recent log file
      if (isDirectory(logPath)) {
        const recentLog = findMostRecentLog(logPath);
        if (recentLog) {
          const content = readFile(recentLog);
          if (content) {
            return {
              tool: toolName,
              messages: extractDeveloperMessages(content),
            };
          }
        }
      }
    }
  }

  // Layer 2 — generic logs
  if (detectionReport.detectionLayer === 2) {
    const paths = detectionReport.logPaths['generic-logs'];
    if (Array.isArray(paths) && paths.length > 0) {
      const content = readFile(paths[0]);
      if (content) {
        return {
          tool: 'generic',
          messages: extractDeveloperMessages(content),
        };
      }
    }
  }

  return null;
}

/**
 * Extract developer prompts from Antigravity/Gemini brain directory
 * Scans conversation directories for ones matching the current project,
 * then extracts USER_REQUEST content from the overview.txt files
 *
 * @param {string} brainDir - Path to ~/.gemini/antigravity/brain/
 * @param {string} projectRoot - Current project root to match against
 * @returns {string|null} Extracted developer prompts or null
 */
function extractAntigravityLogs(brainDir, projectRoot) {
  if (!projectRoot || !isDirectory(brainDir)) return null;

  const entries = listDir(brainDir);
  if (!entries || entries.length === 0) return null;

  // Normalize the project root for comparison (handle Windows backslashes)
  const normalizedProject = projectRoot.replace(/\\\\/g, '/').replace(/\\/g, '/').toLowerCase();

  const allPrompts = [];

  for (const entry of entries) {
    // Skip non-conversation entries (files, temp dirs, etc.)
    const conversationDir = path.join(brainDir, entry);
    if (!isDirectory(conversationDir)) continue;

    const overviewPath = path.join(conversationDir, '.system_generated', 'logs', 'overview.txt');
    if (!fileExists(overviewPath)) continue;

    const content = readFile(overviewPath);
    if (!content) continue;

    // Quick check — does this conversation reference our project?
    const contentNormalized = content.replace(/\\\\/g, '/').toLowerCase();
    if (!contentNormalized.includes(normalizedProject)) continue;

    // Parse JSON-per-line
    const lines = content.split('\n').filter(Boolean);
    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }

      // Only extract user messages
      if (entry.source !== 'USER_EXPLICIT' || entry.type !== 'USER_INPUT') continue;
      if (!entry.content) continue;

      // Extract the USER_REQUEST content
      const requestMatch = entry.content.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/);
      if (requestMatch && requestMatch[1].trim()) {
        allPrompts.push({
          timestamp: entry.created_at || '',
          message: requestMatch[1].trim(),
        });
      }
    }
  }

  if (allPrompts.length === 0) return null;

  // Sort by timestamp (most recent last) and take last 50
  allPrompts.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const recent = allPrompts.slice(-50);

  // Format as readable text
  return recent.map(p => p.message).join('\n\n---\n\n');
}

/**
 * Extract developer (human) messages from a chat log
 * Strips code blocks and limits to last 50 messages
 */
function extractDeveloperMessages(rawContent) {
  // Strip code blocks (```...```) to reduce noise
  let cleaned = rawContent.replace(/```[\s\S]*?```/g, '[code block removed]');

  // Try to extract human/developer messages
  // Common patterns: "Human:", "User:", "> ", "developer:", lines starting with prompts
  const lines = cleaned.split('\n');
  const messages = [];
  let isHumanMessage = false;
  let currentMessage = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect human message markers
    if (/^(Human|User|Developer|user|human|\>)\s*:?\s/i.test(trimmed)) {
      // Save previous message if exists
      if (currentMessage.length > 0) {
        messages.push(currentMessage.join('\n').trim());
        currentMessage = [];
      }
      isHumanMessage = true;
      // Remove the marker prefix
      const cleaned = trimmed.replace(/^(Human|User|Developer|user|human|\>)\s*:?\s*/i, '');
      if (cleaned) currentMessage.push(cleaned);
    } else if (/^(Assistant|AI|Claude|System|assistant|claude)\s*:?\s/i.test(trimmed)) {
      // End of human message, start of AI message
      if (currentMessage.length > 0 && isHumanMessage) {
        messages.push(currentMessage.join('\n').trim());
        currentMessage = [];
      }
      isHumanMessage = false;
    } else if (isHumanMessage && trimmed) {
      currentMessage.push(trimmed);
    }
  }

  // Don't forget the last message
  if (currentMessage.length > 0 && isHumanMessage) {
    messages.push(currentMessage.join('\n').trim());
  }

  // If no structured messages found, return the raw content (truncated)
  if (messages.length === 0) {
    const truncated = cleaned.split('\n').slice(-200).join('\n');
    return truncated.trim();
  }

  // Return last 50 messages
  return messages.slice(-50).join('\n\n---\n\n');
}

/**
 * Find the most recently modified log file in a directory
 */
function findMostRecentLog(dirPath) {
  const fs = require('fs');
  const entries = listDir(dirPath);
  if (entries.length === 0) return null;

  let newest = null;
  let newestTime = 0;

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && stat.mtimeMs > newestTime) {
        newestTime = stat.mtimeMs;
        newest = fullPath;
      }
    } catch {
      continue;
    }
  }

  return newest;
}

/**
 * Extract test results from test output directory
 */
function extractTestResults(projectRoot, testResultsPath) {
  const fullPath = resolveDocPath(projectRoot, testResultsPath);

  // Check for common test result files
  const possibleFiles = [
    'jest-results.json',
    'test-results.json',
    'results.json',
    'junit.xml',
    'test-report.json',
  ];

  // If it's a directory, look for result files inside
  if (isDirectory(fullPath)) {
    const entries = listDir(fullPath);
    for (const file of possibleFiles) {
      if (entries.includes(file)) {
        const content = readFile(path.join(fullPath, file));
        if (content) {
          // For JSON files, try to extract pass/fail summary
          if (file.endsWith('.json')) {
            return parseTestResultsJson(content);
          }
          return content.trim();
        }
      }
    }
    return null;
  }

  // If it's a file, read it directly
  const content = readFile(fullPath);
  if (content && testResultsPath.endsWith('.json')) {
    return parseTestResultsJson(content);
  }
  return content ? content.trim() : null;
}

/**
 * Parse a JSON test results file into a summary string
 */
function parseTestResultsJson(jsonContent) {
  try {
    const data = JSON.parse(jsonContent);

    // Jest format
    if (data.numPassedTests !== undefined) {
      const passed = data.numPassedTests || 0;
      const failed = data.numFailedTests || 0;
      const total = data.numTotalTests || passed + failed;
      let summary = `Tests: ${passed}/${total} passed`;
      if (failed > 0) {
        summary += `, ${failed} failed`;
        // Include failed test names if available
        if (data.testResults) {
          const failedTests = data.testResults
            .filter(r => r.status === 'failed')
            .map(r => r.name || r.testFilePath)
            .slice(0, 10);
          if (failedTests.length > 0) {
            summary += '\nFailed: ' + failedTests.join(', ');
          }
        }
      }
      return summary;
    }

    // Generic: look for common keys
    if (data.passed !== undefined && data.failed !== undefined) {
      return `Tests: ${data.passed} passed, ${data.failed} failed`;
    }

    // Fallback: return stringified
    return JSON.stringify(data, null, 2).substring(0, 500);
  } catch {
    return jsonContent.substring(0, 500);
  }
}

module.exports = {
  extract,
  extractDeveloperMessages,
  extractChatLogs,
  extractAntigravityLogs,
  extractTestResults,
  resolveDocPath,
};
