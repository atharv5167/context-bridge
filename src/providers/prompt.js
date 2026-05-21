// src/providers/prompt.js — Shared prompt builder for all AI providers
// Constructs the system prompt and user message from extracted context

/**
 * Build the system prompt for commit message generation
 * @returns {string}
 */
function buildSystemPrompt() {
  return `You are a commit message generator. You have full context about a software project.
Generate a structured, detailed Git commit message based on the code diff and all
context provided. The message will be read by an AI code reviewer (CodeRabbit) so
make intent and decisions explicit. Format the message clearly with these exact sections:

<summary line>

WHY THIS WAS BUILT
[1-3 sentences explaining the business or product reason]

WHAT CHANGED
- [file or component]: [what it does now]

INTENTIONAL DECISIONS
- [decision]: [reason it was made this way]

KNOWN TRADEOFFS
- [tradeoff if any, or omit this section if none]

CONTEXT REF
PRD: [yes/no] | Arch: [yes/no] | Impl Plan: [yes/no] | AI Logs: [tool/none] | Build Log: [yes/no] | Tests: [pass/fail/none]

Rules:
- The summary line should follow conventional commits format (feat:, fix:, chore:, refactor:, docs:, test:, style:, perf:, ci:, build:)
- Be concise but informative
- Focus on WHY, not just WHAT
- If you don't have enough context for a section, omit it rather than guess
- Note which context sources were available in the CONTEXT REF line`;
}

/**
 * Build the user message from extracted context
 * Only includes sections that have data
 * @param {Object} context - Extracted context from extract.js
 * @returns {string}
 */
function buildUserMessage(context) {
  const parts = [];

  // Planning docs
  if (context.docs.prd) {
    parts.push(`[PRD CONTENT]\n${context.docs.prd}`);
  }
  if (context.docs.srd) {
    parts.push(`[SRD CONTENT]\n${context.docs.srd}`);
  }

  // Architecture
  if (context.docs.architecture) {
    parts.push(`[ARCHITECTURE]\n${context.docs.architecture}`);
  }

  // Implementation plan
  if (context.docs.implementationPlan) {
    parts.push(`[IMPLEMENTATION PLAN]\n${context.docs.implementationPlan}`);
  }

  // AI chat logs
  if (context.chatLogs.messages) {
    const toolLabel = context.chatLogs.tool || 'unknown';
    parts.push(`[RECENT DEVELOPER PROMPTS - via ${toolLabel}]\n${context.chatLogs.messages}`);
  }

  // Build log
  if (context.logs.build) {
    parts.push(`[BUILD LOG - last 100 lines]\n${context.logs.build}`);
  }

  // Error log
  if (context.logs.error) {
    parts.push(`[ERROR LOG - last 50 lines]\n${context.logs.error}`);
  }

  // Test results
  if (context.logs.testResults) {
    parts.push(`[TEST RESULTS]\n${context.logs.testResults}`);
  }

  // Tasks
  if (context.docs.tasks) {
    parts.push(`[TASK LIST]\n${context.docs.tasks}`);
  }

  // Git history
  if (context.git.recentLog) {
    parts.push(`[RECENT GIT HISTORY]\n${context.git.recentLog}`);
  }

  // Current diff (always last — this is what we're committing)
  if (context.git.diff) {
    parts.push(`[CURRENT DIFF]\n${context.git.diff}`);
  }

  // Custom User Instruction (e.g. from hook regeneration prompt)
  if (context.customInstruction) {
    parts.push(`[SPECIAL INSTRUCTION FOR THIS COMMIT]\n${context.customInstruction}`);
  }

  parts.push('Generate a commit message for the current diff given all of this context.');
  parts.push('Note which context sources were available at the bottom of the message.');

  return parts.join('\n\n');
}

module.exports = { buildSystemPrompt, buildUserMessage };
