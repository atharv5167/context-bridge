// src/commands/status.js — contextbridge status
// Shows current ContextBridge state for the project

const logger = require('../utils/logger');
const store = require('../modules/store');
const { isHookInstalled, isContextBridgeHook } = require('../modules/hook');
const { isGitRepo } = require('../utils/git');

const PROVIDER_LABELS = {
  'auto-format': 'Auto Format (free)',
  'gemini': 'Gemini',
  'ollama': 'Ollama (local)',
  'anthropic': 'Anthropic Claude',
  'openai': 'OpenAI',
};

module.exports = async function status() {
  const cwd = process.cwd();

  logger.header('ContextBridge Status');

  // Check if initialized
  const config = store.read(cwd);
  if (!config) {
    logger.error('ContextBridge is not initialized in this project.');
    logger.info('Run "contextbridge init" to set up.');
    return;
  }

  // Project info
  logger.keyValue('Project', config.project.name || '(unnamed)');
  logger.keyValue('Description', config.project.description || '(none)');

  // Provider
  const providerLabel = PROVIDER_LABELS[config.provider] || config.provider;
  logger.keyValue('Provider', providerLabel);

  // Git hook status
  if (isGitRepo(cwd)) {
    if (isHookInstalled(cwd)) {
      if (isContextBridgeHook(cwd)) {
        logger.keyValue('Git hook', '✓ installed');
      } else {
        logger.keyValue('Git hook', '⚠ exists but not ContextBridge');
      }
    } else {
      logger.keyValue('Git hook', '✗ not installed');
    }
  } else {
    logger.keyValue('Git hook', '✗ not a git repo');
  }

  // Detection
  const tools = config.detectedTools || [];
  const toolDisplay = tools.length > 0 ? tools.join(', ') : 'none';
  logger.keyValue('Detected tools', `${toolDisplay} (Layer ${config.detectionLayer || '?'})`);

  // Docs tracked
  const trackedDocs = Object.entries(config.docs || {})
    .filter(([_, v]) => v !== null)
    .map(([_, v]) => {
      // Extract just the filename from paths like ./prd.md
      const name = v.replace(/^\.\//, '');
      return name;
    });
  logger.keyValue('Docs tracked', trackedDocs.length > 0 ? trackedDocs.join(', ') : 'none');

  // Feature log
  const featureCount = (config.featureLog || []).length;
  logger.keyValue('Features logged', `${featureCount} commits with context`);

  // Last updated
  if (config.project.lastUpdated) {
    const ago = timeAgo(config.project.lastUpdated);
    logger.keyValue('Last updated', ago);
  }

  logger.blank();
};

function timeAgo(isoString) {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
}
