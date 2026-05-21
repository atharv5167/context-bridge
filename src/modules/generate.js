// src/modules/generate.js — Commit Message Generator
// Routes to the correct provider based on project config

const store = require('./store');
const { getProvider } = require('../providers');

/**
 * Generate a commit message using the configured provider
 * @param {string} projectRoot - Absolute path to project root
 * @param {Object} context - Extracted context from extract.js
 * @returns {Promise<string>} Generated commit message
 */
async function generate(projectRoot, context) {
  // Read provider from config
  const config = store.read(projectRoot);
  const providerName = (config && config.provider) || 'auto-format';

  // Get the provider module
  const provider = getProvider(providerName);

  // Generate the commit message
  const message = await provider.generate(context);

  return message;
}

/**
 * Build a list of which context sources were actually available
 * Used for tracking in the feature log
 * @param {Object} context - Extracted context
 * @returns {string[]}
 */
function getContextSources(context) {
  const sources = [];

  if (context.docs.prd) sources.push('prd');
  if (context.docs.srd) sources.push('srd');
  if (context.docs.architecture) sources.push('architecture');
  if (context.docs.implementationPlan) sources.push('implementation-plan');
  if (context.docs.tasks) sources.push('tasks');
  if (context.docs.changelog) sources.push('changelog');
  if (context.logs.build) sources.push('build-log');
  if (context.logs.error) sources.push('error-log');
  if (context.logs.testResults) sources.push('test-results');
  if (context.chatLogs.messages) sources.push(`${context.chatLogs.tool || 'ai'}-logs`);
  if (context.git.recentLog) sources.push('git-log');
  if (context.git.diff) sources.push('git-diff');

  return sources;
}

module.exports = { generate, getContextSources };
