// src/modules/detect.js — 3-Layer Detection Module
// Detects AI coding tools, project documents, and log paths
//
// Layer 1: Known tool signatures (folder/file markers)
// Layer 2: Generic log scan (chat history patterns)
// Layer 3: Git fallback (always works)

const os = require('os');
const path = require('path');
const { fileExists, isDirectory, scanDir, findFilesBySuffix, listDir } = require('../utils/files');

// ─── Known AI tool definitions ──────────────────────────────────────────────

const KNOWN_TOOLS = [
  {
    name: 'claude-code',
    displayName: 'Claude Code',
    // Check project root and home directory
    projectMarkers: ['.claude'],
    homeMarkers: ['.claude'],
    logPath: (homeDir) => path.join(homeDir, '.claude', 'logs'),
  },
  {
    name: 'cursor',
    displayName: 'Cursor',
    projectMarkers: ['.cursor'],
    homeMarkers: ['.cursor'],
    logPath: (homeDir) => path.join(homeDir, '.cursor', 'logs'),
  },
  {
    name: 'windsurf',
    displayName: 'Windsurf',
    projectMarkers: ['.windsurf', '.codeium'],
    homeMarkers: ['.windsurf', '.codeium'],
    logPath: (homeDir) => {
      // Check windsurf first, then codeium
      const wsPath = path.join(homeDir, '.windsurf');
      if (fileExists(wsPath)) return wsPath;
      return path.join(homeDir, '.codeium');
    },
  },
  {
    name: 'gemini-code-assist',
    displayName: 'Gemini Code Assist',
    projectMarkers: ['.gemini'],
    homeMarkers: ['.gemini'],
    // Gemini/Antigravity stores conversations in brain/ subdirectory
    logPath: (homeDir) => path.join(homeDir, '.gemini', 'antigravity', 'brain'),
    logType: 'antigravity-brain',
  },
  {
    name: 'continue-dev',
    displayName: 'Continue.dev',
    projectMarkers: ['.continue'],
    homeMarkers: [],
    logPath: (_homeDir, projectRoot) => path.join(projectRoot, '.continue', 'logs'),
  },
  {
    name: 'tabnine',
    displayName: 'Tabnine',
    projectMarkers: [],
    homeMarkers: ['.tabnine'],
    logPath: (homeDir) => path.join(homeDir, '.tabnine'),
  },
  {
    name: 'aider',
    displayName: 'Aider',
    projectMarkers: ['aider.chat.history'],
    homeMarkers: [],
    // Aider log is the file itself, not a directory
    logPath: (_homeDir, projectRoot) => path.join(projectRoot, 'aider.chat.history'),
  },
];

// ─── Document file patterns ─────────────────────────────────────────────────

const DOC_PATTERNS = {
  prd: ['prd.md', 'PRD.md', 'product-requirements.md'],
  srd: ['srd.md', 'SRD.md', 'system-requirements.md'],
  architecture: ['ARCHITECTURE.md', 'DESIGN.md'],
  implementationPlan: ['implementation-plan.md', 'IMPLEMENTATION.md'],
  tasks: ['TODO.md', 'TASKS.md'],
  changelog: ['CHANGELOG.md', 'CHANGES.md'],
  readme: ['README.md'],
  buildLog: ['build.log'],
  errorLog: ['error.log'],
};

// Directory-based doc patterns (check if folder exists)
const DOC_DIR_PATTERNS = {
  architecture: ['ADR', 'decisions'],
  tasks: ['tasks'],
  testResults: ['test-results', 'coverage'],
  docsFolder: ['docs'],
  buildLog: ['.build'],
};

// ─── Layer 1: Known Tool Detection ──────────────────────────────────────────

/**
 * Scan for known AI tool signatures in project root and home directory
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ tools: Object[], logPaths: Object, logTypes: Object }}
 */
function detectKnownTools(projectRoot) {
  const homeDir = os.homedir();
  const tools = [];
  const logPaths = {};
  const logTypes = {};

  for (const tool of KNOWN_TOOLS) {
    let found = false;

    // Check project-level markers
    for (const marker of tool.projectMarkers) {
      if (fileExists(path.join(projectRoot, marker))) {
        found = true;
        break;
      }
    }

    // Check home-level markers if not found in project
    if (!found) {
      for (const marker of tool.homeMarkers) {
        if (fileExists(path.join(homeDir, marker))) {
          found = true;
          break;
        }
      }
    }

    if (found) {
      tools.push({
        name: tool.name,
        displayName: tool.displayName,
      });

      const logDir = tool.logPath(homeDir, projectRoot);
      if (fileExists(logDir)) {
        logPaths[tool.name] = logDir;
      }

      // Track special log types (e.g. antigravity-brain for Gemini)
      if (tool.logType) {
        logTypes[tool.name] = tool.logType;
      }
    }
  }

  // Special case: GitHub Copilot detection via VS Code extensions
  const copilotDetected = detectCopilot(homeDir);
  if (copilotDetected) {
    tools.push({
      name: 'github-copilot',
      displayName: 'GitHub Copilot',
    });
    // Copilot logs are in VS Code's extension host logs — not reliably readable
  }

  return { tools, logPaths, logTypes };
}

/**
 * Detect GitHub Copilot by checking VS Code extensions directory
 * @param {string} homeDir - User home directory
 * @returns {boolean}
 */
function detectCopilot(homeDir) {
  const extensionsDir = path.join(homeDir, '.vscode', 'extensions');
  if (!isDirectory(extensionsDir)) return false;

  const entries = listDir(extensionsDir);
  return entries.some(entry =>
    entry.toLowerCase().startsWith('github.copilot')
  );
}

// ─── Layer 2: Generic Log Scan ──────────────────────────────────────────────

const GENERIC_LOG_PATTERNS = [
  '.chat.history',
  '.ai.history',
  '.agent.log',
  'chat_history.json',
  'conversation.json',
];

const GENERIC_LOG_SUFFIXES = ['.chat.md'];

/**
 * Scan for generic chat/AI log files when no known tool is detected
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ found: boolean, paths: string[] }}
 */
function detectGenericLogs(projectRoot) {
  const foundPaths = [];

  // Check for specific filenames
  for (const pattern of GENERIC_LOG_PATTERNS) {
    const fullPath = path.join(projectRoot, pattern);
    if (fileExists(fullPath)) {
      foundPaths.push(fullPath);
    }
  }

  // Check for files matching suffixes (e.g. *.chat.md)
  for (const suffix of GENERIC_LOG_SUFFIXES) {
    const matches = findFilesBySuffix(projectRoot, suffix);
    foundPaths.push(...matches);
  }

  // Check .logs/ and logs/ directories for chat/conversation files
  const logDirs = [
    path.join(projectRoot, '.logs'),
    path.join(projectRoot, 'logs'),
  ];

  for (const logDir of logDirs) {
    if (isDirectory(logDir)) {
      const entries = listDir(logDir);
      for (const entry of entries) {
        const lower = entry.toLowerCase();
        if (lower.includes('chat') || lower.includes('conversation') || lower.includes('agent')) {
          foundPaths.push(path.join(logDir, entry));
        }
      }
    }
  }

  return {
    found: foundPaths.length > 0,
    paths: foundPaths,
  };
}

// ─── Document Detection ─────────────────────────────────────────────────────

/**
 * Scan project root for known document files and directories
 * @param {string} projectRoot - Absolute path to project root
 * @returns {Object} Map of doc type to path (or null)
 */
function detectDocs(projectRoot) {
  const docs = {};

  // File-based docs — check each pattern, take the first match
  for (const [docType, patterns] of Object.entries(DOC_PATTERNS)) {
    docs[docType] = null;

    for (const pattern of patterns) {
      const fullPath = path.join(projectRoot, pattern);
      if (fileExists(fullPath)) {
        // Store as relative path for portability
        docs[docType] = './' + pattern;
        break;
      }
    }
  }

  // Directory-based docs
  for (const [docType, patterns] of Object.entries(DOC_DIR_PATTERNS)) {
    // Don't overwrite a file-based match (e.g. architecture file found above)
    // But for directory-only types (testResults, docsFolder), always check
    const isFileOnly = docs[docType] !== undefined;

    for (const pattern of patterns) {
      const fullPath = path.join(projectRoot, pattern);
      if (isDirectory(fullPath)) {
        if (!isFileOnly || docs[docType] === null) {
          docs[docType] = './' + pattern + '/';
        }
        break;
      }
    }
  }

  // Ensure all expected keys exist
  const allDocKeys = ['prd', 'srd', 'architecture', 'implementationPlan', 'tasks',
    'changelog', 'readme', 'docsFolder', 'buildLog', 'errorLog', 'testResults'];

  for (const key of allDocKeys) {
    if (docs[key] === undefined) {
      docs[key] = null;
    }
  }

  return docs;
}

// ─── Main Detection Function ────────────────────────────────────────────────

/**
 * Run full 3-layer detection on a project
 * @param {string} projectRoot - Absolute path to project root
 * @param {Object} [existingConfig] - Existing .contextbridge config (for customLogPath)
 * @returns {Object} Detection report
 */
function detect(projectRoot, existingConfig = null) {
  const report = {
    tools: [],
    detectionLayer: 3, // default to git-only fallback
    docs: {},
    logPaths: {},
    logTypes: {},
    customLogPath: null,
  };

  // Check for custom log path override first
  if (existingConfig && existingConfig.customLogPath) {
    const customPath = path.isAbsolute(existingConfig.customLogPath)
      ? existingConfig.customLogPath
      : path.join(projectRoot, existingConfig.customLogPath);

    if (fileExists(customPath)) {
      report.customLogPath = customPath;
    }
  }

  // Layer 1 — Known tool detection
  const { tools, logPaths, logTypes } = detectKnownTools(projectRoot);
  if (tools.length > 0) {
    report.tools = tools;
    report.logPaths = logPaths;
    report.logTypes = logTypes;
    report.detectionLayer = 1;
  }

  // Layer 2 — Generic log scan (only if Layer 1 found nothing)
  if (report.detectionLayer !== 1) {
    const genericResult = detectGenericLogs(projectRoot);
    if (genericResult.found) {
      report.tools = [{
        name: 'generic-logs',
        displayName: 'Generic AI Logs',
      }];
      report.logPaths = { 'generic-logs': genericResult.paths };
      report.detectionLayer = 2;
    }
  }

  // Layer 3 is implicit — git diff + log always available

  // Detect documents (always runs, independent of tool detection)
  report.docs = detectDocs(projectRoot);

  return report;
}

module.exports = {
  detect,
  detectKnownTools,
  detectGenericLogs,
  detectDocs,
  detectCopilot,
};
