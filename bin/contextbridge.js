#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const pkg = require(path.join(__dirname, '..', 'package.json'));

const program = new Command();

program
  .name('contextbridge')
  .description('Extracts AI development context and injects it into Git commits and PR descriptions.')
  .version(pkg.version);

// contextbridge init
program
  .command('init')
  .description('Initialize ContextBridge in the current project')
  .action(async () => {
    const init = require(path.join(__dirname, '..', 'src', 'commands', 'init.js'));
    await init();
  });

// contextbridge status
program
  .command('status')
  .description('Show current ContextBridge status for this project')
  .action(async () => {
    const status = require(path.join(__dirname, '..', 'src', 'commands', 'status.js'));
    await status();
  });

// contextbridge context
program
  .command('context')
  .description('View the full context store for this project')
  .action(async () => {
    const context = require(path.join(__dirname, '..', 'src', 'commands', 'context.js'));
    await context();
  });

// contextbridge hook (internal — called by git hook, not by developer)
program
  .command('hook <commitMsgFile>')
  .description('Generate commit message (called by git hook)')
  .action(async (commitMsgFile) => {
    const hook = require(path.join(__dirname, '..', 'src', 'commands', 'hook.js'));
    await hook(commitMsgFile);
  });

// contextbridge provider — switch commit message provider
program
  .command('provider')
  .description('View or change the commit message provider')
  .option('--set <provider>', 'Set provider directly (auto-format, gemini, ollama, anthropic, openai)')
  .action(async (opts) => {
    const provider = require(path.join(__dirname, '..', 'src', 'commands', 'provider.js'));
    await provider(opts);
  });

// contextbridge commit — interactive commit with approval menu
program
  .command('commit')
  .description('Generate a context-aware commit message with interactive approval')
  .action(async () => {
    const commit = require(path.join(__dirname, '..', 'src', 'commands', 'commit.js'));
    await commit();
  });

program.parse(process.argv);
