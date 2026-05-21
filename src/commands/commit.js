// src/commands/commit.js — contextbridge commit
// Interactive commit flow with full arrow-key menu
// This runs in a REAL terminal with a TTY — Inquirer works here
// The developer runs this INSTEAD of `git commit`

const { execSync } = require('child_process');
const inquirer = require('inquirer');
const ora = require('ora');
const logger = require('../utils/logger');
const { detect } = require('../modules/detect');
const { extract } = require('../modules/extract');
const { generate, getContextSources } = require('../modules/generate');
const store = require('../modules/store');
const { isGitRepo, getStagedFiles, getStagedDiff } = require('../utils/git');

module.exports = async function commit() {
  const cwd = process.cwd();

  // ── Preflight checks ────────────────────────────────────────────────
  if (!isGitRepo(cwd)) {
    logger.error('Not a git repository.');
    return;
  }

  const config = store.read(cwd);
  if (!config) {
    logger.error('ContextBridge not initialized. Run "contextbridge init" first.');
    return;
  }

  // Check if there are staged changes
  const stagedFiles = getStagedFiles(cwd);
  if (!stagedFiles || stagedFiles.length === 0) {
    logger.warn('No staged changes. Stage files first with "git add".');
    return;
  }

  // ── Detect + Extract ────────────────────────────────────────────────
  const spinner = ora('Reading your changes...').start();

  const report = detect(cwd, config);
  const context = extract(cwd, report);

  const toolName = context.chatLogs.tool
    ? `from ${context.chatLogs.tool} logs`
    : 'from available sources';
  spinner.text = `Extracting context ${toolName}...`;

  // ── Generation Loop ─────────────────────────────────────────────────
  let isGenerating = true;

  while (isGenerating) {
    spinner.text = context.customInstruction
      ? 'Regenerating commit message with instructions...'
      : 'Generating commit message...';

    spinner.start();
    const message = await generate(cwd, context);
    spinner.stop();

    // Show the generated message
    logger.blank();
    logger.header('GENERATED COMMIT MESSAGE');
    console.log(message);
    logger.divider();

    // ── Interactive menu (works because we have a real TTY) ──────────
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do with this message?',
      choices: [
        { name: '✓ Yes, commit with this message', value: 'yes' },
        { name: '✎ Edit it first, then commit', value: 'edit' },
        { name: '↻ Regenerate with custom instruction...', value: 'regenerate' },
        { name: '✗ Cancel — don\'t commit', value: 'cancel' },
      ],
      default: 'yes',
    }]);

    if (action === 'yes') {
      // Commit directly with this message
      try {
        execSync(`git commit -m ${escapeForShell(message)}`, {
          stdio: 'inherit',
          cwd,
        });

        // Log to context store
        const sources = getContextSources(context);
        store.addFeatureEntry(cwd, {
          summary: message.split('\n')[0],
          intent: extractIntent(message),
          filesChanged: stagedFiles,
          contextSources: sources,
        });

        logger.success('Committed.');
      } catch (err) {
        logger.error(`Commit failed: ${err.message}`);
      }
      isGenerating = false;

    } else if (action === 'edit') {
      // Let the developer edit, then commit
      const { edited } = await inquirer.prompt([{
        type: 'editor',
        name: 'edited',
        message: 'Edit your commit message:',
        default: message,
      }]);

      const finalMessage = edited.trim();
      if (!finalMessage) {
        logger.warn('Empty message — commit cancelled.');
        isGenerating = false;
        return;
      }

      try {
        execSync(`git commit -m ${escapeForShell(finalMessage)}`, {
          stdio: 'inherit',
          cwd,
        });

        const sources = getContextSources(context);
        store.addFeatureEntry(cwd, {
          summary: finalMessage.split('\n')[0],
          intent: extractIntent(finalMessage),
          filesChanged: stagedFiles,
          contextSources: sources,
        });

        logger.success('Committed.');
      } catch (err) {
        logger.error(`Commit failed: ${err.message}`);
      }
      isGenerating = false;

    } else if (action === 'regenerate') {
      const { instruction } = await inquirer.prompt([{
        type: 'input',
        name: 'instruction',
        message: 'What should the new message focus on?',
        validate: input => input.trim().length > 0 ? true : 'Please enter an instruction.',
      }]);

      context.customInstruction = instruction;
      // Loops back to generate with the new instruction

    } else {
      // Cancel
      logger.info('Cancelled. Nothing was committed.');
      isGenerating = false;
    }
  }
};

/**
 * Escape a string for use in a shell command argument
 * Uses double quotes on Windows, handles internal quotes
 */
function escapeForShell(str) {
  // Use double quotes and escape internal double quotes
  const escaped = str.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Extract the WHY THIS WAS BUILT section from a generated message
 */
function extractIntent(message) {
  const match = message.match(/WHY THIS WAS BUILT\n([\s\S]*?)(?:\n\n|$)/);
  if (match) return match[1].trim();
  return '';
}
