// src/providers/anthropic.js — Anthropic Claude provider
// Uses @anthropic-ai/sdk

const { buildSystemPrompt, buildUserMessage } = require('./prompt');

/**
 * Generate a commit message using Anthropic Claude API
 * @param {Object} context - Extracted context from extract.js
 * @returns {Promise<string>} Generated commit message
 */
async function generate(context) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Provider is set to Anthropic but no ANTHROPIC_API_KEY found.\n\n' +
      'Add it to your .env file:\n' +
      'ANTHROPIC_API_KEY=sk-ant-...\n\n' +
      'Or switch provider:\n' +
      'contextbridge provider'
    );
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const model = process.env.CONTEXTBRIDGE_MODEL || 'claude-sonnet-4-6';
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(context);

  const response = await client.messages.create({
    model: model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  // Extract text from response
  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  return text.trim();
}

module.exports = { generate };
