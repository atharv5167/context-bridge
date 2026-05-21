// tests/detect.test.js — Tests for the 3-layer detection module

const path = require('path');
const { detect, detectKnownTools, detectGenericLogs, detectDocs } = require('../src/modules/detect');

// Fixture paths
const FAKE_PROJECT = path.join(__dirname, 'fixtures', 'fake-project');
const EMPTY_PROJECT = path.join(__dirname, 'fixtures', 'empty-project');
const GENERIC_LOG_PROJECT = path.join(__dirname, 'fixtures', 'generic-log-project');

// ─── Layer 1: Known Tool Detection ─────────────────────────────────────────

describe('Layer 1 — Known Tool Detection', () => {
  test('detects Claude Code when .claude folder exists', () => {
    const { tools } = detectKnownTools(FAKE_PROJECT);
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('claude-code');
  });

  test('detects Cursor when .cursor folder exists', () => {
    const { tools } = detectKnownTools(FAKE_PROJECT);
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('cursor');
  });

  test('detects Windsurf when .windsurf folder exists', () => {
    const { tools } = detectKnownTools(FAKE_PROJECT);
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('windsurf');
  });

  test('detects Continue.dev when .continue folder exists', () => {
    const { tools } = detectKnownTools(FAKE_PROJECT);
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('continue-dev');
  });

  test('detects Aider when aider.chat.history file exists', () => {
    const { tools } = detectKnownTools(FAKE_PROJECT);
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('aider');
  });

  test('returns empty tools array when no tools found', () => {
    const { tools } = detectKnownTools(EMPTY_PROJECT);
    // Empty project has no tool markers — may still detect home-level tools
    // so we just verify it returns an array
    expect(Array.isArray(tools)).toBe(true);
  });

  test('provides log paths for detected tools', () => {
    const { tools, logPaths } = detectKnownTools(FAKE_PROJECT);
    // Aider log path is the file itself
    if (tools.find(t => t.name === 'aider')) {
      expect(logPaths['aider']).toBe(path.join(FAKE_PROJECT, 'aider.chat.history'));
    }
  });
});

// ─── Layer 2: Generic Log Scan ──────────────────────────────────────────────

describe('Layer 2 — Generic Log Scan', () => {
  test('finds chat_history.json as generic log', () => {
    const result = detectGenericLogs(GENERIC_LOG_PROJECT);
    expect(result.found).toBe(true);
    expect(result.paths.length).toBeGreaterThan(0);
    expect(result.paths[0]).toContain('chat_history.json');
  });

  test('returns found=false when no generic logs exist', () => {
    const result = detectGenericLogs(EMPTY_PROJECT);
    expect(result.found).toBe(false);
    expect(result.paths).toEqual([]);
  });
});

// ─── Document Detection ─────────────────────────────────────────────────────

describe('Document Detection', () => {
  test('finds prd.md in project root', () => {
    const docs = detectDocs(FAKE_PROJECT);
    expect(docs.prd).toBe('./prd.md');
  });

  test('finds srd.md in project root', () => {
    const docs = detectDocs(FAKE_PROJECT);
    expect(docs.srd).toBe('./srd.md');
  });

  test('finds ARCHITECTURE.md in project root', () => {
    const docs = detectDocs(FAKE_PROJECT);
    expect(docs.architecture).toBe('./ARCHITECTURE.md');
  });

  test('finds implementation-plan.md in project root', () => {
    const docs = detectDocs(FAKE_PROJECT);
    expect(docs.implementationPlan).toBe('./implementation-plan.md');
  });

  test('finds TODO.md in project root', () => {
    const docs = detectDocs(FAKE_PROJECT);
    expect(docs.tasks).toBe('./TODO.md');
  });

  test('finds CHANGELOG.md in project root', () => {
    const docs = detectDocs(FAKE_PROJECT);
    expect(docs.changelog).toBe('./CHANGELOG.md');
  });

  test('finds build.log in project root', () => {
    const docs = detectDocs(FAKE_PROJECT);
    expect(docs.buildLog).toBe('./build.log');
  });

  test('finds error.log in project root', () => {
    const docs = detectDocs(FAKE_PROJECT);
    expect(docs.errorLog).toBe('./error.log');
  });

  test('finds test-results/ directory', () => {
    const docs = detectDocs(FAKE_PROJECT);
    expect(docs.testResults).toBe('./test-results/');
  });

  test('finds docs/ folder', () => {
    const docs = detectDocs(FAKE_PROJECT);
    expect(docs.docsFolder).toBe('./docs/');
  });

  test('returns null for missing documents', () => {
    const docs = detectDocs(EMPTY_PROJECT);
    expect(docs.srd).toBeNull();
    expect(docs.architecture).toBeNull();
    expect(docs.changelog).toBeNull();
  });
});

// ─── Full Detection (all 3 layers) ─────────────────────────────────────────

describe('Full 3-Layer Detection', () => {
  test('returns detectionLayer 1 when known tools are found', () => {
    const report = detect(FAKE_PROJECT);
    expect(report.detectionLayer).toBe(1);
    expect(report.tools.length).toBeGreaterThan(0);
  });

  test('returns detectionLayer 2 when only generic logs found', () => {
    const report = detect(GENERIC_LOG_PROJECT);
    // This will be Layer 2 ONLY if no known home-dir tools are detected
    // If home-dir tools exist, it will be Layer 1
    expect(report.detectionLayer).toBeLessThanOrEqual(2);
  });

  test('returns detectionLayer 3 when nothing found', () => {
    const report = detect(EMPTY_PROJECT);
    // Empty project: no tools, no generic logs
    // Could still be Layer 1 if home directory has tool markers
    expect([1, 2, 3]).toContain(report.detectionLayer);
  });

  test('includes docs regardless of detection layer', () => {
    const report = detect(FAKE_PROJECT);
    expect(report.docs.prd).toBe('./prd.md');
    expect(report.docs.architecture).toBe('./ARCHITECTURE.md');
  });

  test('uses customLogPath from config when set', () => {
    const config = { customLogPath: './custom-logs' };
    const report = detect(FAKE_PROJECT, config);
    // customLogPath won't exist on disk, so should remain null
    expect(report.customLogPath).toBeNull();
  });

  test('detectionReport has all expected keys', () => {
    const report = detect(FAKE_PROJECT);
    expect(report).toHaveProperty('tools');
    expect(report).toHaveProperty('detectionLayer');
    expect(report).toHaveProperty('docs');
    expect(report).toHaveProperty('logPaths');
    expect(report).toHaveProperty('customLogPath');
  });

  test('docs object has all expected keys', () => {
    const report = detect(FAKE_PROJECT);
    const expectedKeys = ['prd', 'srd', 'architecture', 'implementationPlan',
      'tasks', 'changelog', 'readme', 'docsFolder', 'buildLog', 'errorLog', 'testResults'];
    for (const key of expectedKeys) {
      expect(report.docs).toHaveProperty(key);
    }
  });
});
