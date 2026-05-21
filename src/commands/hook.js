// src/commands/hook.js — contextbridge hook (internal)
// Called by the git prepare-commit-msg hook, NOT by the developer
// This runs in a NON-INTERACTIVE context (no TTY) — no prompts allowed
// Generates and writes the commit message silently, then exits
// The developer edits the message in their git editor

const fs = require('fs');
const { detect } = require('../modules/detect');
const { extract } = require('../modules/extract');
const { generate, getContextSources } = require('../modules/generate');
const store = require('../modules/store');
const { getStagedFiles } = require('../utils/git');

module.exports = async function hook(commitMsgFile) {
  const cwd = process.cwd();

  // Read existing config
  const config = store.read(cwd);
  if (!config) {
    // Not initialized — silently exit, don't block the commit
    process.exit(0);
    return;
  }

  try {
    // ── Detect + Extract ──────────────────────────────────────────────
    const report = detect(cwd, config);
    const context = extract(cwd, report);

    // Skip if nothing staged
    if (!context.git.diff) {
      process.exit(0);
      return;
    }

    // ── Generate ──────────────────────────────────────────────────────
    const message = await generate(cwd, context);

    // ── Write to commit file ──────────────────────────────────────────
    fs.writeFileSync(commitMsgFile, message + '\n', 'utf-8');

    // ── Log to context store ──────────────────────────────────────────
    const sources = getContextSources(context);
    const stagedFiles = getStagedFiles(cwd);
    store.addFeatureEntry(cwd, {
      summary: message.split('\n')[0],
      intent: extractIntent(message),
      filesChanged: stagedFiles,
      contextSources: sources,
    });

    // One clean line of output, then exit
    process.stdout.write('\nContextBridge: message ready. Edit in your git editor.\n');
    process.exit(0);

  } catch (err) {
    // Never block the commit — silently exit
    if (process.env.CONTEXTBRIDGE_DEBUG === 'true') {
      process.stderr.write(`\nContextBridge error: ${err.message}\n`);
    }
    process.exit(0);
  }
};

/**
 * Extract the WHY THIS WAS BUILT section from a generated message
 */
function extractIntent(message) {
  const match = message.match(/WHY THIS WAS BUILT\n([\s\S]*?)(?:\n\n|$)/);
  if (match) return match[1].trim();
  return '';
}
