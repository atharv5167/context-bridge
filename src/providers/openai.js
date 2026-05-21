// src/providers/openai.js — OpenAI provider
// Uses openai SDK

const { buildSystemPrompt, buildUserMessage } = require('./prompt');

/**
 * Generate a commit message using OpenAI API
 * @param {Object} context - Extracted context from extract.js
 * @returns {Promise<string>} Generated commit message
 */
async function generate(context) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Provider is set to OpenAI but no OPENAI_API_KEY found.\n\n' +
      'Add it to your .env file:\n' +
      'OPENAI_API_KEY=sk-...\n\n' +
      'Or switch provider:\n' +
      'contextbridge provider'
    );
  }

  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey });

  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(context);

  const response = await client.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 1024,
  });

  return (response.choices[0].message.content || '').trim();
}

module.exports = { generate };
