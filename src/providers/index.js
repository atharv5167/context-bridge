// src/providers/index.js — Provider router
// Reads provider from config and returns the correct provider module

const path = require('path');

const VALID_PROVIDERS = ['auto-format', 'gemini', 'ollama', 'anthropic', 'openai'];

/**
 * Get the provider module for the given provider name
 * @param {string} providerName - Provider identifier
 * @returns {Object} Provider module with generate() function
 */
function getProvider(providerName) {
  const name = (providerName || 'auto-format').toLowerCase();

  if (!VALID_PROVIDERS.includes(name)) {
    throw new Error(
      `Unknown provider: "${name}"\n\n` +
      `Valid providers: ${VALID_PROVIDERS.join(', ')}\n\n` +
      'Set provider with:\n' +
      'contextbridge provider --set <provider>'
    );
  }

  switch (name) {
    case 'auto-format':
      return require('./auto-format');
    case 'gemini':
      return require('./gemini');
    case 'ollama':
      return require('./ollama');
    case 'anthropic':
      return require('./anthropic');
    case 'openai':
      return require('./openai');
    default:
      return require('./auto-format');
  }
}

module.exports = {
  getProvider,
  VALID_PROVIDERS,
};
