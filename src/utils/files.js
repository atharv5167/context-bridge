// src/utils/files.js — File system helpers
// All path construction uses path.join() for cross-platform safety

const fs = require('fs');
const path = require('path');

/**
 * Check if a file or directory exists at the given path
 * @param {string} filePath - Absolute path to check
 * @returns {boolean}
 */
function fileExists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a path is a directory
 * @param {string} dirPath - Absolute path to check
 * @returns {boolean}
 */
function isDirectory(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read a file and return its contents as a string
 * Returns null if file does not exist or cannot be read
 * @param {string} filePath - Absolute path to file
 * @returns {string|null}
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Read the last N lines of a file
 * Useful for build logs and error logs where only recent output matters
 * @param {string} filePath - Absolute path to file
 * @param {number} n - Number of lines to read from the end
 * @returns {string|null}
 */
function readLastLines(filePath, n) {
  const content = readFile(filePath);
  if (!content) return null;

  const lines = content.split('\n');
  const lastLines = lines.slice(-n);
  return lastLines.join('\n').trim();
}

/**
 * Scan a directory for files/folders matching given names
 * @param {string} dirPath - Absolute path to directory to scan
 * @param {string[]} patterns - Array of file/folder names to look for
 * @returns {Object} Map of pattern name to full path (or null if not found)
 */
function scanDir(dirPath, patterns) {
  const results = {};

  for (const pattern of patterns) {
    const fullPath = path.join(dirPath, pattern);
    results[pattern] = fileExists(fullPath) ? fullPath : null;
  }

  return results;
}

/**
 * Scan a directory for files matching a glob-like suffix pattern
 * e.g. find all files ending in '.chat.md' in a directory
 * @param {string} dirPath - Absolute path to directory
 * @param {string} suffix - File suffix to match (e.g. '.chat.md')
 * @returns {string[]} Array of full paths to matching files
 */
function findFilesBySuffix(dirPath, suffix) {
  try {
    const entries = fs.readdirSync(dirPath);
    return entries
      .filter(entry => entry.endsWith(suffix))
      .map(entry => path.join(dirPath, entry));
  } catch {
    return [];
  }
}

/**
 * List all entries in a directory (non-recursive)
 * @param {string} dirPath - Absolute path to directory
 * @returns {string[]} Array of entry names
 */
function listDir(dirPath) {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

module.exports = {
  fileExists,
  isDirectory,
  readFile,
  readLastLines,
  scanDir,
  findFilesBySuffix,
  listDir,
};
