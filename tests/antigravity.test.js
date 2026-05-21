// tests/antigravity.test.js — Tests for Gemini/Antigravity brain log extraction

const path = require('path');
const { extractAntigravityLogs } = require('../src/modules/extract');

const FAKE_BRAIN = path.join(__dirname, 'fixtures', 'fake-brain');
// The project root that our test conversations reference
const MATCHING_PROJECT = 'c:\\Users\\athar\\OneDrive\\Desktop\\fake-project';
const NON_MATCHING_PROJECT = 'c:\\Users\\athar\\OneDrive\\Desktop\\totally-different';

describe('Antigravity Brain Log Extraction', () => {
  test('extracts prompts from conversations matching the project', () => {
    const result = extractAntigravityLogs(FAKE_BRAIN, MATCHING_PROJECT);
    expect(result).not.toBeNull();
    expect(result).toContain('add user authentication with JWT tokens');
    expect(result).toContain('also add refresh token rotation');
    expect(result).toContain('fix the database connection pooling issue');
    expect(result).toContain('increase pool size to 20 and add retry logic');
  });

  test('does not include prompts from non-matching projects', () => {
    const result = extractAntigravityLogs(FAKE_BRAIN, MATCHING_PROJECT);
    expect(result).not.toContain('update the landing page hero section');
  });

  test('returns null when no conversations match the project', () => {
    const result = extractAntigravityLogs(FAKE_BRAIN, NON_MATCHING_PROJECT);
    expect(result).toBeNull();
  });

  test('returns null when brain directory does not exist', () => {
    const result = extractAntigravityLogs('/nonexistent/path', MATCHING_PROJECT);
    expect(result).toBeNull();
  });

  test('returns null when projectRoot is empty', () => {
    const result = extractAntigravityLogs(FAKE_BRAIN, '');
    expect(result).toBeNull();
  });

  test('skips non-USER_INPUT entries (VIEW_FILE, MODEL responses)', () => {
    const result = extractAntigravityLogs(FAKE_BRAIN, MATCHING_PROJECT);
    // VIEW_FILE entry content should not appear
    expect(result).not.toContain('The USER viewed file db.js');
    // MODEL response should not appear
    expect(result).not.toContain('I\'ll add JWT authentication');
    expect(result).not.toContain('investigate the connection pooling');
  });

  test('sorts prompts chronologically (oldest first)', () => {
    const result = extractAntigravityLogs(FAKE_BRAIN, MATCHING_PROJECT);
    const messages = result.split('\n\n---\n\n');
    // conv-001 is from May 18, conv-003 is from May 19
    // So JWT messages should come before pooling messages
    const jwtIndex = messages.findIndex(m => m.includes('JWT'));
    const poolIndex = messages.findIndex(m => m.includes('pool'));
    expect(jwtIndex).toBeLessThan(poolIndex);
  });

  test('returns correct number of matched prompts', () => {
    const result = extractAntigravityLogs(FAKE_BRAIN, MATCHING_PROJECT);
    const messages = result.split('\n\n---\n\n');
    // 2 from conv-001 + 2 from conv-003 = 4 total
    expect(messages).toHaveLength(4);
  });

  test('handles Windows-style backslashes in project path matching', () => {
    // Test with forward slashes — should still match
    const forwardSlashProject = 'c:/Users/athar/OneDrive/Desktop/fake-project';
    const result = extractAntigravityLogs(FAKE_BRAIN, forwardSlashProject);
    expect(result).not.toBeNull();
    expect(result).toContain('JWT tokens');
  });
});
