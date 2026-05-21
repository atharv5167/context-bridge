// src/utils/git.js — Git helpers
// Uses child_process.execSync for synchronous git commands

const { execSync } = require('child_process');
const path = require('path');
const { fileExists, isDirectory } = require('./files');

/**
 * Check if the given directory is inside a git repository
 * @param {string} dir - Directory to check
 * @returns {boolean}
 */
function isGitRepo(dir) {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: dir,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the root directory of the git repository
 * @param {string} dir - Any directory inside the repo
 * @returns {string|null}
 */
function getRepoRoot(dir) {
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return root.trim();
  } catch {
    return null;
  }
}

/**
 * Get the staged diff (what is about to be committed)
 * @param {string} dir - Repository directory
 * @returns {string|null}
 */
function getStagedDiff(dir) {
  try {
    const diff = execSync('git diff --staged', {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large diffs
    });
    return diff.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Get recent commit log as one-line summaries
 * @param {string} dir - Repository directory
 * @param {number} [n=10] - Number of recent commits to retrieve
 * @returns {string|null}
 */
function getRecentLog(dir, n = 10) {
  try {
    const log = execSync(`git log --oneline -${n}`, {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return log.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Get list of staged file paths
 * @param {string} dir - Repository directory
 * @returns {string[]}
 */
function getStagedFiles(dir) {
  try {
    const output = execSync('git diff --staged --name-only', {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = {
  isGitRepo,
  getRepoRoot,
  getStagedDiff,
  getRecentLog,
  getStagedFiles,
};
