// src/providers/ollama.js — Ollama local model provider
// HTTP call to localhost:11434 — no API key needed

const { buildSystemPrompt, buildUserMessage } = require('./prompt');

const OLLAMA_BASE_URL = 'http://localhost:11434';

/**
 * Generate a commit message using local Ollama instance
 * @param {Object} context - Extracted context from extract.js
 * @returns {Promise<string>} Generated commit message
 */
async function generate(context) {
  // Check if Ollama is running
  const isRunning = await checkOllamaRunning();
  if (!isRunning) {
    throw new Error(
      'Provider is set to Ollama but Ollama is not running.\n\n' +
      'Start Ollama:\n' +
      'ollama serve\n\n' +
      'Or install it from: https://ollama.com\n\n' +
      'Or switch provider:\n' +
      'contextbridge provider'
    );
  }

  const model = process.env.OLLAMA_MODEL || 'llama3';
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(context);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      prompt: `${systemPrompt}\n\n---\n\n${userMessage}`,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return (data.response || '').trim();
}

/**
 * Check if Ollama server is running on localhost
 * @returns {Promise<boolean>}
 */
async function checkOllamaRunning() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = { generate, checkOllamaRunning };
