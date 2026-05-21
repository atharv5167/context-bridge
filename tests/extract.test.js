// tests/extract.test.js — Tests for the extraction module

const path = require('path');
const { extract, extractDeveloperMessages } = require('../src/modules/extract');
const { detect } = require('../src/modules/detect');

const FAKE_PROJECT = path.join(__dirname, 'fixtures', 'fake-project');

// Get a detection report for the fake project
const detectionReport = detect(FAKE_PROJECT);

// ─── Doc Extraction ─────────────────────────────────────────────────────────

describe('Document Extraction', () => {
  test('reads PRD content from file', () => {
    const context = extract(FAKE_PROJECT, detectionReport);
    expect(context.docs.prd).not.toBeNull();
    expect(context.docs.prd).toContain('Product Requirements');
  });

  test('reads architecture doc content', () => {
    const context = extract(FAKE_PROJECT, detectionReport);
    expect(context.docs.architecture).not.toBeNull();
    expect(context.docs.architecture).toContain('Microservices');
  });

  test('reads implementation plan content', () => {
    const context = extract(FAKE_PROJECT, detectionReport);
    expect(context.docs.implementationPlan).not.toBeNull();
    expect(context.docs.implementationPlan).toContain('Implementation Plan');
  });

  test('reads TODO tasks content', () => {
    const context = extract(FAKE_PROJECT, detectionReport);
    expect(context.docs.tasks).not.toBeNull();
    expect(context.docs.tasks).toContain('Build dashboard');
  });

  test('reads changelog content', () => {
    const context = extract(FAKE_PROJECT, detectionReport);
    expect(context.docs.changelog).not.toBeNull();
    expect(context.docs.changelog).toContain('Initial release');
  });
});

// ─── Log Extraction ─────────────────────────────────────────────────────────

describe('Log Extraction', () => {
  test('reads build log last lines', () => {
    const context = extract(FAKE_PROJECT, detectionReport);
    expect(context.logs.build).not.toBeNull();
    expect(context.logs.build).toContain('Build completed');
  });

  test('reads error log last lines', () => {
    const context = extract(FAKE_PROJECT, detectionReport);
    expect(context.logs.error).not.toBeNull();
    expect(context.logs.error).toContain('TypeError');
  });
});

// ─── Chat Log Extraction ────────────────────────────────────────────────────

describe('Chat Log Extraction', () => {
  test('extracts developer messages from Aider history', () => {
    const messages = extractDeveloperMessages(
      'User: Add a login page\nAssistant: Done\nUser: Add validation\nAssistant: Added'
    );
    expect(messages).toContain('Add a login page');
    expect(messages).toContain('Add validation');
  });

  test('strips code blocks from messages', () => {
    const messages = extractDeveloperMessages(
      'User: Fix this\n```javascript\nconst x = 1;\n```\nAssistant: Fixed'
    );
    expect(messages).not.toContain('const x = 1');
    expect(messages).toContain('Fix this');
  });

  test('limits to last 50 messages', () => {
    // Generate 60 messages
    const lines = [];
    for (let i = 0; i < 60; i++) {
      lines.push(`User: Message number ${i}`);
      lines.push(`Assistant: Response ${i}`);
    }
    const messages = extractDeveloperMessages(lines.join('\n'));
    const count = (messages.match(/Message number/g) || []).length;
    expect(count).toBeLessThanOrEqual(50);
  });

  test('returns raw content when no structured messages found', () => {
    const messages = extractDeveloperMessages('This is just raw unstructured text\nWith multiple lines');
    expect(messages).toContain('raw unstructured text');
  });

  test('returns null for missing log paths', () => {
    // Create a detection report with no log paths
    const emptyReport = {
      detectionLayer: 3,
      tools: [],
      logPaths: {},
      customLogPath: null,
      docs: {
        prd: null, srd: null, architecture: null,
        implementationPlan: null, tasks: null, changelog: null,
        readme: null, docsFolder: null, buildLog: null,
        errorLog: null, testResults: null,
      },
    };
    const context = extract(FAKE_PROJECT, emptyReport);
    expect(context.chatLogs.messages).toBeNull();
    expect(context.docs.prd).toBeNull();
  });
});

// ─── Git Extraction ─────────────────────────────────────────────────────────

describe('Git Extraction', () => {
  test('git diff is captured (may be null if nothing staged)', () => {
    const context = extract(FAKE_PROJECT, detectionReport);
    // diff could be null if nothing is staged — that is correct behavior
    expect(context.git).toHaveProperty('diff');
  });

  test('git recent log is captured (may be null if no commits)', () => {
    const context = extract(FAKE_PROJECT, detectionReport);
    expect(context.git).toHaveProperty('recentLog');
  });
});

// ─── Context Structure ──────────────────────────────────────────────────────

describe('Extracted Context Structure', () => {
  test('has all top-level keys', () => {
    const context = extract(FAKE_PROJECT, detectionReport);
    expect(context).toHaveProperty('docs');
    expect(context).toHaveProperty('logs');
    expect(context).toHaveProperty('chatLogs');
    expect(context).toHaveProperty('git');
  });

  test('chatLogs includes detectionLayer', () => {
    const context = extract(FAKE_PROJECT, detectionReport);
    expect(context.chatLogs.detectionLayer).toBeDefined();
    expect(typeof context.chatLogs.detectionLayer).toBe('number');
  });
});
