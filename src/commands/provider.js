// src/commands/provider.js — contextbridge provider
// View or change the commit message provider

const inquirer = require('inquirer');
const logger = require('../utils/logger');
const store = require('../modules/store');
const { VALID_PROVIDERS } = require('../providers');

const PROVIDER_CHOICES = [
  { name: '1. Auto format    — free, no setup, works immediately', value: 'auto-format' },
  { name: '2. Gemini         — free API tier, needs Google API key', value: 'gemini' },
  { name: '3. Ollama         — local model, fully free, needs Ollama installed', value: 'ollama' },
  { name: '4. Anthropic      — paid, best quality, needs Anthropic API key', value: 'anthropic' },
  { name: '5. OpenAI         — paid, needs OpenAI API key', value: 'openai' },
];

module.exports = async function provider(opts) {
  const cwd = process.cwd();

  // Check if initialized
  const config = store.read(cwd);
  if (!config) {
    logger.error('ContextBridge is not initialized in this project.');
    logger.info('Run "contextbridge init" to set up.');
    return;
  }

  // Direct set via --set flag
  if (opts && opts.set) {
    const name = opts.set.toLowerCase();
    if (!VALID_PROVIDERS.includes(name)) {
      logger.error(`Unknown provider: "${name}"`);
      logger.info(`Valid providers: ${VALID_PROVIDERS.join(', ')}`);
      return;
    }

    config.provider = name;
    store.write(cwd, config);
    logger.success(`Provider set to: ${name}`);
    showKeyReminder(name);
    return;
  }

  // Interactive menu
  logger.header('Commit Message Provider');
  logger.info(`Current provider: ${config.provider || 'auto-format'}`);
  logger.blank();

  const { newProvider } = await inquirer.prompt([{
    type: 'list',
    name: 'newProvider',
    message: 'How do you want to generate commit messages?',
    choices: PROVIDER_CHOICES,
    default: config.provider || 'auto-format',
  }]);

  config.provider = newProvider;
  store.write(cwd, config);

  logger.blank();
  logger.success(`Provider set to: ${newProvider}`);
  showKeyReminder(newProvider);
};

function showKeyReminder(provider) {
  switch (provider) {
    case 'auto-format':
      logger.info('No API key needed. Works immediately.');
      break;
    case 'gemini':
      if (!process.env.GEMINI_API_KEY) {
        logger.warn('No GEMINI_API_KEY found. Add it to your .env file:');
        logger.info('GEMINI_API_KEY=your-key-here');
      }
      break;
    case 'ollama':
      logger.info('Make sure Ollama is running: ollama serve');
      break;
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) {
        logger.warn('No ANTHROPIC_API_KEY found. Add it to your .env file:');
        logger.info('ANTHROPIC_API_KEY=sk-ant-...');
      }
      break;
    case 'openai':
      if (!process.env.OPENAI_API_KEY) {
        logger.warn('No OPENAI_API_KEY found. Add it to your .env file:');
        logger.info('OPENAI_API_KEY=sk-...');
      }
      break;
  }
}
