// src/providers/auto-format.js — Deterministic template engine
// No API call. Formats context into structured commit message using templates.
// Always works, always free, zero external dependency.

/**
 * Generate a structured commit message from extracted context
 * Uses pure string formatting — no AI, no API call
 * @param {Object} context - Extracted context from extract.js
 * @returns {string} Formatted commit message
 */
function generate(context) {
  const sections = [];

  // ── Summary line ──────────────────────────────────────────────────────
  const summary = buildSummaryLine(context);
  sections.push(summary);

  // ── WHY THIS WAS BUILT ────────────────────────────────────────────────
  const why = buildWhySection(context);
  if (why) {
    sections.push(`\nWHY THIS WAS BUILT\n${why}`);
  }

  // ── WHAT CHANGED ──────────────────────────────────────────────────────
  const what = buildWhatChanged(context);
  if (what) {
    sections.push(`\nWHAT CHANGED\n${what}`);
  }

  // ── INTENTIONAL DECISIONS ─────────────────────────────────────────────
  const decisions = buildDecisions(context);
  if (decisions) {
    sections.push(`\nINTENTIONAL DECISIONS\n${decisions}`);
  }

  // ── CONTEXT REF ───────────────────────────────────────────────────────
  const contextRef = buildContextRef(context);
  sections.push(`\nCONTEXT REF\n${contextRef}`);

  return sections.join('\n');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildSummaryLine(context) {
  if (!context.git.diff) return 'chore: update project files';

  // Extract file names from the diff
  const files = extractFilesFromDiff(context.git.diff);
  if (files.length === 0) return 'chore: update project files';

  if (files.length === 1) {
    return `chore: update ${files[0]}`;
  }

  // Try to find a common directory
  const dirs = [...new Set(files.map(f => f.split('/')[0]))];
  if (dirs.length === 1) {
    return `chore: update ${dirs[0]} (${files.length} files)`;
  }

  return `chore: update ${files.length} files across ${dirs.length} directories`;
}

function buildWhySection(context) {
  const parts = [];

  if (context.docs.prd) {
    // Extract first meaningful paragraph from PRD
    const firstParagraph = getFirstParagraph(context.docs.prd);
    if (firstParagraph) parts.push(firstParagraph);
  }

  if (context.docs.tasks) {
    // Show in-progress tasks
    const inProgress = extractInProgressTasks(context.docs.tasks);
    if (inProgress) parts.push(`Current tasks: ${inProgress}`);
  }

  if (context.chatLogs.messages) {
    // Use the most recent developer message as intent
    const lastMessage = getLastDeveloperMessage(context.chatLogs.messages);
    if (lastMessage) parts.push(`Developer intent: ${lastMessage}`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

function buildWhatChanged(context) {
  if (!context.git.diff) return null;

  const files = extractFilesFromDiff(context.git.diff);
  if (files.length === 0) return null;

  return files.map(f => `- ${f}`).join('\n');
}

function buildDecisions(context) {
  // Auto-format can't infer decisions — that requires AI
  // But we can note what context was available
  if (context.docs.architecture) {
    const snippet = context.docs.architecture.substring(0, 200).trim();
    return `- Architecture reference available: ${snippet.split('\n')[0]}`;
  }
  return null;
}

function buildContextRef(context) {
  const refs = [];
  refs.push(`PRD: ${context.docs.prd ? 'yes' : 'no'}`);
  refs.push(`Arch: ${context.docs.architecture ? 'yes' : 'no'}`);
  refs.push(`Impl Plan: ${context.docs.implementationPlan ? 'yes' : 'no'}`);
  refs.push(`AI Logs: ${context.chatLogs.tool || 'none'}`);
  refs.push(`Build Log: ${context.logs.build ? 'yes' : 'no'}`);

  // Test results
  if (context.logs.testResults) {
    const hasFailure = context.logs.testResults.toLowerCase().includes('fail');
    refs.push(`Tests: ${hasFailure ? 'fail' : 'pass'}`);
  } else {
    refs.push('Tests: none');
  }

  return refs.join(' | ');
}

// ─── Text Utilities ─────────────────────────────────────────────────────────

function extractFilesFromDiff(diff) {
  const matches = diff.match(/^diff --git a\/(.*?) b\//gm) || [];
  return matches.map(m => m.replace('diff --git a/', '').replace(/ b\/.*/, ''));
}

function getFirstParagraph(text) {
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  return lines.length > 0 ? lines[0].trim().substring(0, 200) : null;
}

function extractInProgressTasks(tasks) {
  const lines = tasks.split('\n');
  const inProgress = lines.filter(l => l.includes('[ ]') || l.includes('[/]'));
  if (inProgress.length === 0) return null;
  return inProgress.slice(0, 3).map(l => l.replace(/^[\s\-*]*\[.\]\s*/, '').trim()).join(', ');
}

function getLastDeveloperMessage(messages) {
  if (!messages) return null;
  // Messages are separated by ---
  const parts = messages.split('---');
  const last = parts[parts.length - 1].trim();
  return last.substring(0, 150);
}

module.exports = { generate };
