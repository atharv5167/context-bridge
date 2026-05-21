// src/commands/init.js — contextbridge init
// First-time setup: detect tools, ask project info, pick provider, create config, install hook

const path = require('path');
const inquirer = require('inquirer');
const ora = require('ora');
const logger = require('../utils/logger');
const { isGitRepo } = require('../utils/git');
const { detect } = require('../modules/detect');
const store = require('../modules/store');
const { installHook } = require('../modules/hook');
const { VALID_PROVIDERS } = require('../providers');

const PROVIDER_CHOICES = [
  { name: '1. Auto format    — free, no setup, works immediately', value: 'auto-format' },
  { name: '2. Gemini         — free API tier, needs Google API key', value: 'gemini' },
  { name: '3. Ollama         — local model, fully free, needs Ollama installed', value: 'ollama' },
  { name: '4. Anthropic      — paid, best quality, needs Anthropic API key', value: 'anthropic' },
  { name: '5. OpenAI         — paid, needs OpenAI API key', value: 'openai' },
];

module.exports = async function init() {
  logger.header('ContextBridge Setup');

  // ── Step 1: Check git repo ────────────────────────────────────────────
  const cwd = process.cwd();
  if (!isGitRepo(cwd)) {
    logger.error('Not a git repository. Run "git init" first.');
    process.exit(1);
  }
  logger.success('Git repository found');

  // ── Step 2: Check if already initialized ──────────────────────────────
  const existingConfig = store.read(cwd);
  if (existingConfig) {
    logger.warn('ContextBridge is already initialized in this project.');
    const { reinit } = await inquirer.prompt([{
      type: 'confirm',
      name: 'reinit',
      message: 'Reinitialize? This will update detection and config.',
      default: false,
    }]);
    if (!reinit) {
      logger.info('Cancelled. Run "contextbridge status" to see current config.');
      return;
    }
  }

  // ── Step 3: Run detection ─────────────────────────────────────────────
  const spinner = ora('Scanning your environment...').start();
  const report = detect(cwd, existingConfig);
  spinner.stop();

  logger.blank();

  // Show detected tools
  if (report.detectionLayer === 1) {
    const toolNames = report.tools.map(t => t.displayName).join(', ');
    logger.success(`Detected AI tools:  ${toolNames}  (Layer 1)`);
  } else if (report.detectionLayer === 2) {
    logger.warn('No known AI tool detected. Found generic log files.  (Layer 2)');
  } else {
    logger.warn('No AI tool logs found. Falling back to git history.  (Layer 3)');
  }

  // Show detected docs
  const docEntries = Object.entries(report.docs).filter(([_, v]) => v !== null);
  for (const [key, value] of docEntries) {
    const label = formatDocLabel(key);
    logger.success(`Found ${label}:  ${value}`);
  }

  if (docEntries.length === 0) {
    logger.info('No project documents found.');
  }

  logger.blank();

  // ── Step 4: Ask project info ──────────────────────────────────────────
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'What is this project called?',
      default: path.basename(cwd),
    },
    {
      type: 'input',
      name: 'description',
      message: 'One sentence — what does it do?',
      default: '',
    },
  ]);

  // ── Step 5: Ask provider selection ────────────────────────────────────
  logger.blank();
  const { provider } = await inquirer.prompt([{
    type: 'list',
    name: 'provider',
    message: 'How do you want to generate commit messages?',
    choices: PROVIDER_CHOICES,
    default: 'auto-format',
  }]);

  // ── Step 6: Create config ─────────────────────────────────────────────
  const config = store.createDefault({
    name: answers.name,
    description: answers.description,
    provider: provider,
    detectedTools: report.tools.map(t => t.name),
    detectionLayer: report.detectionLayer,
    docs: report.docs,
    customLogPath: (existingConfig && existingConfig.customLogPath) || null,
  });

  store.write(cwd, config);
  logger.success('Config saved to .contextbridge');

  // ── Step 7: Install git hook ──────────────────────────────────────────
  const hookResult = installHook(cwd, { force: true });
  if (hookResult.success) {
    logger.success('Git hook installed');
  } else {
    logger.error(`Hook install failed: ${hookResult.message}`);
  }

  // ── Done ──────────────────────────────────────────────────────────────
  logger.blank();
  logger.success("You're all set. Every commit will now generate rich context automatically.");

  if (provider === 'auto-format') {
    logger.info('Using auto-format (free, no API key needed).');
  } else if (provider === 'gemini') {
    logger.info('Make sure GEMINI_API_KEY is set in your .env file.');
  } else if (provider === 'anthropic') {
    logger.info('Make sure ANTHROPIC_API_KEY is set in your .env file.');
  } else if (provider === 'openai') {
    logger.info('Make sure OPENAI_API_KEY is set in your .env file.');
  } else if (provider === 'ollama') {
    logger.info('Make sure Ollama is running: ollama serve');
  }

  logger.info('Run: git add . && git commit -m "test" to try it.');
};

function formatDocLabel(key) {
  const labels = {
    prd: 'PRD',
    srd: 'SRD',
    architecture: 'Arch doc',
    implementationPlan: 'Impl plan',
    tasks: 'Tasks',
    changelog: 'Changelog',
    readme: 'README',
    docsFolder: 'Docs folder',
    buildLog: 'Build log',
    errorLog: 'Error log',
    testResults: 'Test results',
  };
  return labels[key] || key;
}
