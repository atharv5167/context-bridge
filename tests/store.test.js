// tests/store.test.js — Tests for the context store module

const path = require('path');
const fs = require('fs');
const store = require('../src/modules/store');

// Use a temp directory for store tests to avoid polluting fixtures
const TEST_DIR = path.join(__dirname, 'fixtures', 'store-test-project');

beforeEach(() => {
  // Create fresh test directory
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  // Remove existing store file
  const storePath = store.getStorePath(TEST_DIR);
  if (fs.existsSync(storePath)) {
    fs.unlinkSync(storePath);
  }
});

afterAll(() => {
  // Clean up test directory
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

// ─── Create and Read ────────────────────────────────────────────────────────

describe('Store Create and Read', () => {
  test('creates new store with correct defaults', () => {
    const data = store.createDefault({
      name: 'TestApp',
      description: 'A test application',
      provider: 'gemini',
      detectedTools: ['claude-code', 'cursor'],
      detectionLayer: 1,
    });

    expect(data.project.name).toBe('TestApp');
    expect(data.project.description).toBe('A test application');
    expect(data.provider).toBe('gemini');
    expect(data.detectedTools).toEqual(['claude-code', 'cursor']);
    expect(data.detectionLayer).toBe(1);
    expect(data.customLogPath).toBeNull();
    expect(data.featureLog).toEqual([]);
    expect(data.docChanges).toEqual([]);
    expect(data.project.createdAt).toBeDefined();
  });

  test('creates default store with auto-format provider', () => {
    const data = store.createDefault();
    expect(data.provider).toBe('auto-format');
  });

  test('writes and reads store correctly', () => {
    const data = store.createDefault({ name: 'WriteTest', provider: 'anthropic' });
    store.write(TEST_DIR, data);

    const read = store.read(TEST_DIR);
    expect(read).not.toBeNull();
    expect(read.project.name).toBe('WriteTest');
    expect(read.provider).toBe('anthropic');
  });

  test('returns null when store file does not exist', () => {
    const read = store.read(TEST_DIR);
    expect(read).toBeNull();
  });

  test('store file has all doc fields', () => {
    const data = store.createDefault();
    store.write(TEST_DIR, data);

    const read = store.read(TEST_DIR);
    const expectedDocKeys = ['prd', 'srd', 'architecture', 'implementationPlan',
      'tasks', 'changelog', 'readme', 'docsFolder', 'buildLog', 'errorLog', 'testResults'];

    for (const key of expectedDocKeys) {
      expect(read.docs).toHaveProperty(key);
    }
  });
});

// ─── Feature Log ────────────────────────────────────────────────────────────

describe('Feature Log Operations', () => {
  test('adds feature entry with contextSources', () => {
    const data = store.createDefault({ name: 'FeatureTest' });
    store.write(TEST_DIR, data);

    store.addFeatureEntry(TEST_DIR, {
      commitHash: 'abc1234',
      summary: 'Added OTP verification',
      intent: 'Users getting locked out',
      filesChanged: ['src/auth/login.js'],
      intentionalDecisions: ['6-digit OTP for mobile'],
      contextSources: ['prd', 'claude-code-logs', 'git-diff'],
    });

    const read = store.read(TEST_DIR);
    expect(read.featureLog.length).toBe(1);
    expect(read.featureLog[0].commitHash).toBe('abc1234');
    expect(read.featureLog[0].contextSources).toContain('prd');
    expect(read.featureLog[0].timestamp).toBeDefined();
  });

  test('returns correct recent entries', () => {
    const data = store.createDefault({ name: 'RecentTest' });
    store.write(TEST_DIR, data);

    // Add 3 entries
    for (let i = 0; i < 3; i++) {
      store.addFeatureEntry(TEST_DIR, {
        commitHash: `hash${i}`,
        summary: `Feature ${i}`,
      });
    }

    const recent2 = store.getRecentEntries(TEST_DIR, 2);
    expect(recent2.length).toBe(2);
    expect(recent2[0].summary).toBe('Feature 1');
    expect(recent2[1].summary).toBe('Feature 2');
  });

  test('returns empty array when no feature log', () => {
    const entries = store.getRecentEntries(TEST_DIR, 5);
    expect(entries).toEqual([]);
  });
});

// ─── Doc Change Tracking ────────────────────────────────────────────────────

describe('Doc Change Tracking', () => {
  test('records doc change with timestamp', () => {
    const data = store.createDefault({ name: 'DocChangeTest' });
    store.write(TEST_DIR, data);

    store.flagDocChange(TEST_DIR, 'prd.md', 'Added payment section');

    const read = store.read(TEST_DIR);
    expect(read.docChanges.length).toBe(1);
    expect(read.docChanges[0].file).toBe('prd.md');
    expect(read.docChanges[0].note).toBe('Added payment section');
    expect(read.docChanges[0].timestamp).toBeDefined();
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  test('handles missing store file gracefully', () => {
    const read = store.read(path.join(__dirname, 'fixtures', 'nonexistent'));
    expect(read).toBeNull();
  });

  test('updates lastUpdated on write', () => {
    const data = store.createDefault({ name: 'TimestampTest' });
    const before = data.project.lastUpdated;

    // Small delay to ensure timestamp differs
    store.write(TEST_DIR, data);
    const read = store.read(TEST_DIR);

    expect(read.project.lastUpdated).toBeDefined();
  });
});
