// src/modules/store.js — Context Store
// Reads and writes the .contextbridge JSON file at project root
// This file is committed to git so the full context history is shared

const fs = require('fs');
const path = require('path');
const { fileExists, readFile } = require('../utils/files');

const STORE_FILENAME = '.contextbridge';

/**
 * Get the full path to the .contextbridge file
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string}
 */
function getStorePath(projectRoot) {
  return path.join(projectRoot, STORE_FILENAME);
}

/**
 * Create a new default store object
 * @param {Object} options - Initial values
 * @returns {Object}
 */
function createDefault(options = {}) {
  return {
    project: {
      name: options.name || '',
      description: options.description || '',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    },
    provider: options.provider || 'auto-format',
    detectedTools: options.detectedTools || [],
    detectionLayer: options.detectionLayer || 3,
    customLogPath: options.customLogPath || null,
    docs: options.docs || {
      prd: null,
      srd: null,
      architecture: null,
      implementationPlan: null,
      tasks: null,
      changelog: null,
      readme: null,
      docsFolder: null,
      buildLog: null,
      errorLog: null,
      testResults: null,
    },
    featureLog: [],
    docChanges: [],
  };
}

/**
 * Read the .contextbridge file and parse it
 * Returns null if file does not exist
 * @param {string} projectRoot - Absolute path to project root
 * @returns {Object|null}
 */
function read(projectRoot) {
  const storePath = getStorePath(projectRoot);
  const content = readFile(storePath);

  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write data to the .contextbridge file
 * Updates the lastUpdated timestamp automatically
 * @param {string} projectRoot - Absolute path to project root
 * @param {Object} data - Store data to write
 */
function write(projectRoot, data) {
  const storePath = getStorePath(projectRoot);

  // Always update timestamp
  if (data.project) {
    data.project.lastUpdated = new Date().toISOString();
  }

  // Write with LF line endings
  const content = JSON.stringify(data, null, 2).replace(/\r\n/g, '\n');
  fs.writeFileSync(storePath, content + '\n', 'utf-8');
}

/**
 * Add a new feature log entry
 * @param {string} projectRoot - Absolute path to project root
 * @param {Object} entry - Feature log entry
 * @param {string} entry.commitHash - Git commit hash
 * @param {string} entry.summary - One-line summary
 * @param {string} entry.intent - Why this was built
 * @param {string[]} entry.filesChanged - List of changed files
 * @param {string[]} entry.intentionalDecisions - Key decisions made
 * @param {string[]} entry.contextSources - Which context sources were available
 */
function addFeatureEntry(projectRoot, entry) {
  const data = read(projectRoot);
  if (!data) return;

  const fullEntry = {
    commitHash: entry.commitHash || '',
    timestamp: new Date().toISOString(),
    summary: entry.summary || '',
    intent: entry.intent || '',
    filesChanged: entry.filesChanged || [],
    intentionalDecisions: entry.intentionalDecisions || [],
    contextSources: entry.contextSources || [],
  };

  data.featureLog.push(fullEntry);
  write(projectRoot, data);
}

/**
 * Get the most recent N feature log entries
 * @param {string} projectRoot - Absolute path to project root
 * @param {number} [n=5] - Number of entries to return
 * @returns {Object[]}
 */
function getRecentEntries(projectRoot, n = 5) {
  const data = read(projectRoot);
  if (!data || !data.featureLog) return [];

  return data.featureLog.slice(-n);
}

/**
 * Record that a document file was modified
 * @param {string} projectRoot - Absolute path to project root
 * @param {string} file - Document filename
 * @param {string} [note] - Optional note about the change
 */
function flagDocChange(projectRoot, file, note = '') {
  const data = read(projectRoot);
  if (!data) return;

  data.docChanges.push({
    timestamp: new Date().toISOString(),
    file: file,
    note: note || `${file} was modified`,
  });

  write(projectRoot, data);
}

module.exports = {
  STORE_FILENAME,
  getStorePath,
  createDefault,
  read,
  write,
  addFeatureEntry,
  getRecentEntries,
  flagDocChange,
};
