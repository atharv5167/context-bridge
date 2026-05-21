// src/providers/gemini.js — Google Gemini provider
// Uses @google/generative-ai SDK

const { buildSystemPrompt, buildUserMessage } = require('./prompt');

/**
 * Generate a commit message using Google Gemini API
 * @param {Object} context - Extracted context from extract.js
 * @returns {Promise<string>} Generated commit message
 */
async function generate(context) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Provider is set to Gemini but no GEMINI_API_KEY found.\n\n' +
      'Add it to your .env file:\n' +
      'GEMINI_API_KEY=your-key-here\n\n' +
      'Get a free key at: https://aistudio.google.com/apikey\n\n' +
      'Or switch provider:\n' +
      'contextbridge provider'
    );
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(context);

  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userMessage}` }] },
    ],
  });

  const response = result.response;
  return response.text().trim();
}

module.exports = { generate };
