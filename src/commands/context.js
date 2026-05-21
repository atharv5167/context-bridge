// src/commands/context.js — contextbridge context
// Shows the full context store in human-readable format
// Includes which sources were used in the last commit

const logger = require('../utils/logger');
const store = require('../modules/store');

module.exports = async function context() {
  const cwd = process.cwd();

  logger.header('Project Context');

  const config = store.read(cwd);
  if (!config) {
    logger.error('ContextBridge is not initialized in this project.');
    logger.info('Run "contextbridge init" to set up.');
    return;
  }

  // Project summary
  const name = config.project.name || '(unnamed)';
  const desc = config.project.description || '';
  logger.info(`${name}${desc ? ' — ' + desc : ''}`);
  logger.blank();

  // Recent feature log
  const entries = config.featureLog || [];
  if (entries.length > 0) {
    console.log('  Recent feature log:');
    const recent = entries.slice(-10);
    for (const entry of recent) {
      const ago = timeAgo(entry.timestamp);
      console.log(`  • [${ago}] ${entry.summary || 'no summary'}`);

      // Show context sources used (user's request: show which sources were used)
      if (entry.contextSources && entry.contextSources.length > 0) {
        console.log(`    Sources: ${entry.contextSources.join(', ')}`);
      }
    }
  } else {
    logger.info('No commits with context yet.');
  }

  logger.blank();

  // Docs being tracked
  const trackedDocs = Object.entries(config.docs || {})
    .filter(([_, v]) => v !== null);

  if (trackedDocs.length > 0) {
    console.log('  Docs:');
    for (const [key, value] of trackedDocs) {
      console.log(`  • ${value}`);
    }
  } else {
    logger.info('No documents tracked.');
  }

  // Doc changes
  const docChanges = config.docChanges || [];
  if (docChanges.length > 0) {
    logger.blank();
    console.log('  Recent doc changes:');
    const recentChanges = docChanges.slice(-5);
    for (const change of recentChanges) {
      const ago = timeAgo(change.timestamp);
      console.log(`  • [${ago}] ${change.note}`);
    }
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
  const diffWeek = Math.floor(diffDay / 7);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
}
