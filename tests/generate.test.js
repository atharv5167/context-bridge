// tests/generate.test.js — Tests for the generate module and providers

const path = require('path');
const fs = require('fs');
const { getProvider, VALID_PROVIDERS } = require('../src/providers');
const { buildSystemPrompt, buildUserMessage } = require('../src/providers/prompt');
const { getContextSources } = require('../src/modules/generate');
const autoFormat = require('../src/providers/auto-format');

// ─── Provider Router ────────────────────────────────────────────────────────

describe('Provider Router', () => {
  test('returns auto-format provider by default', () => {
    const provider = getProvider('auto-format');
    expect(provider).toHaveProperty('generate');
    expect(typeof provider.generate).toBe('function');
  });

  test('returns correct provider for each valid name', () => {
    for (const name of VALID_PROVIDERS) {
      const provider = getProvider(name);
      expect(provider).toHaveProperty('generate');
    }
  });

  test('throws error for unknown provider', () => {
    expect(() => getProvider('unknown-ai')).toThrow('Unknown provider');
    expect(() => getProvider('unknown-ai')).toThrow('Valid providers');
  });

  test('defaults to auto-format when null', () => {
    const provider = getProvider(null);
    expect(provider).toHaveProperty('generate');
  });
});

// ─── Prompt Builder ─────────────────────────────────────────────────────────

describe('Prompt Builder', () => {
  const fullContext = {
    docs: {
      prd: 'Product requirements document content',
      srd: 'System requirements content',
      architecture: 'Architecture decisions',
      implementationPlan: 'Implementation plan content',
      tasks: '- [ ] Build dashboard',
      changelog: '## 1.0.0\n- Initial release',
    },
    logs: {
      build: 'Build completed successfully',
      error: 'TypeError at auth.js:42',
      testResults: 'Tests: 10/10 passed',
    },
    chatLogs: {
      detectionLayer: 1,
      tool: 'claude-code',
      messages: 'Add OTP verification to login',
    },
    git: {
      diff: 'diff --git a/src/auth.js b/src/auth.js\n+added OTP logic',
      recentLog: 'abc1234 initial setup',
    },
  };

  const emptyContext = {
    docs: { prd: null, srd: null, architecture: null, implementationPlan: null, tasks: null, changelog: null },
    logs: { build: null, error: null, testResults: null },
    chatLogs: { detectionLayer: 3, tool: null, messages: null },
    git: { diff: null, recentLog: null },
  };

  test('system prompt contains key instructions', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('commit message generator');
    expect(prompt).toContain('CodeRabbit');
    expect(prompt).toContain('WHY THIS WAS BUILT');
    expect(prompt).toContain('CONTEXT REF');
  });

  test('user message includes all available context sources', () => {
    const message = buildUserMessage(fullContext);
    expect(message).toContain('[PRD CONTENT]');
    expect(message).toContain('[SRD CONTENT]');
    expect(message).toContain('[ARCHITECTURE]');
    expect(message).toContain('[IMPLEMENTATION PLAN]');
    expect(message).toContain('[RECENT DEVELOPER PROMPTS - via claude-code]');
    expect(message).toContain('[BUILD LOG');
    expect(message).toContain('[ERROR LOG');
    expect(message).toContain('[TEST RESULTS]');
    expect(message).toContain('[TASK LIST]');
    expect(message).toContain('[RECENT GIT HISTORY]');
    expect(message).toContain('[CURRENT DIFF]');
  });

  test('user message omits sections cleanly when docs are missing', () => {
    const message = buildUserMessage(emptyContext);
    expect(message).not.toContain('[PRD CONTENT]');
    expect(message).not.toContain('[ARCHITECTURE]');
    expect(message).not.toContain('[BUILD LOG');
    expect(message).not.toContain('[ERROR LOG');
    // Should still contain the final instruction
    expect(message).toContain('Generate a commit message');
  });

  test('user message handles missing chat logs gracefully', () => {
    const message = buildUserMessage(emptyContext);
    expect(message).not.toContain('[RECENT DEVELOPER PROMPTS');
  });

  test('user message includes custom user instructions when provided', () => {
    const contextWithInstruction = {
      ...emptyContext,
      customInstruction: 'Focus specifically on security patches in the auth logic',
    };
    const message = buildUserMessage(contextWithInstruction);
    expect(message).toContain('[SPECIAL INSTRUCTION FOR THIS COMMIT]');
    expect(message).toContain('Focus specifically on security patches in the auth logic');
  });
});

// ─── Auto-Format Provider ───────────────────────────────────────────────────

describe('Auto-Format Provider', () => {
  test('generates valid structured message without API', () => {
    const context = {
      docs: {
        prd: '# PRD\nA task management app for remote teams.',
        srd: null,
        architecture: '# Arch\nMicroservices with PostgreSQL',
        implementationPlan: null,
        tasks: '- [ ] Build dashboard\n- [x] Auth setup',
        changelog: null,
      },
      logs: { build: null, error: null, testResults: null },
      chatLogs: { detectionLayer: 1, tool: 'claude-code', messages: 'Add the login page' },
      git: {
        diff: 'diff --git a/src/auth.js b/src/auth.js\n+const login = () => {};',
        recentLog: 'abc1234 initial commit',
      },
    };

    const message = autoFormat.generate(context);
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
    expect(message).toContain('CONTEXT REF');
  });

  test('CONTEXT REF line reflects which sources were used', () => {
    const context = {
      docs: { prd: 'some prd', srd: null, architecture: null, implementationPlan: null, tasks: null, changelog: null },
      logs: { build: null, error: null, testResults: null },
      chatLogs: { detectionLayer: 3, tool: null, messages: null },
      git: { diff: null, recentLog: null },
    };

    const message = autoFormat.generate(context);
    expect(message).toContain('PRD: yes');
    expect(message).toContain('Arch: no');
    expect(message).toContain('AI Logs: none');
    expect(message).toContain('Tests: none');
  });

  test('handles completely empty context', () => {
    const context = {
      docs: { prd: null, srd: null, architecture: null, implementationPlan: null, tasks: null, changelog: null },
      logs: { build: null, error: null, testResults: null },
      chatLogs: { detectionLayer: 3, tool: null, messages: null },
      git: { diff: null, recentLog: null },
    };

    const message = autoFormat.generate(context);
    expect(typeof message).toBe('string');
    expect(message).toContain('CONTEXT REF');
  });
});

// ─── Context Sources Tracking ───────────────────────────────────────────────

describe('Context Sources Tracking', () => {
  test('returns correct sources for full context', () => {
    const context = {
      docs: { prd: 'x', srd: null, architecture: 'x', implementationPlan: 'x', tasks: null, changelog: null },
      logs: { build: 'x', error: null, testResults: null },
      chatLogs: { tool: 'claude-code', messages: 'x' },
      git: { diff: 'x', recentLog: 'x' },
    };

    const sources = getContextSources(context);
    expect(sources).toContain('prd');
    expect(sources).toContain('architecture');
    expect(sources).toContain('implementation-plan');
    expect(sources).toContain('build-log');
    expect(sources).toContain('claude-code-logs');
    expect(sources).toContain('git-diff');
    expect(sources).toContain('git-log');
    expect(sources).not.toContain('srd');
    expect(sources).not.toContain('error-log');
  });
});

// ─── AI Provider Error Messages ─────────────────────────────────────────────

describe('AI Provider Missing Key Errors', () => {
  test('Anthropic throws clear error when key missing', async () => {
    const anthropic = require('../src/providers/anthropic');
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(anthropic.generate({})).rejects.toThrow('ANTHROPIC_API_KEY');
    await expect(anthropic.generate({})).rejects.toThrow('contextbridge provider');

    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  test('Gemini throws clear error when key missing', async () => {
    const gemini = require('../src/providers/gemini');
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await expect(gemini.generate({})).rejects.toThrow('GEMINI_API_KEY');

    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });

  test('OpenAI throws clear error when key missing', async () => {
    const openai = require('../src/providers/openai');
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(openai.generate({})).rejects.toThrow('OPENAI_API_KEY');

    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });
});
