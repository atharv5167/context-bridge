// src/modules/hook.js — Git Hook Installer
// Installs a prepare-commit-msg hook as a Node.js script
// Cross-platform: works on Windows, Mac, Linux without shell dependency

const fs = require('fs');
const path = require('path');
const { fileExists } = require('../utils/files');
const { isGitRepo } = require('../utils/git');

const HOOK_NAME = 'prepare-commit-msg';

/**
 * Get the path to the git hooks directory
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string}
 */
function getHooksDir(projectRoot) {
  return path.join(projectRoot, '.git', 'hooks');
}

/**
 * Get the full path to the prepare-commit-msg hook
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string}
 */
function getHookPath(projectRoot) {
  return path.join(getHooksDir(projectRoot), HOOK_NAME);
}

/**
 * Build the hook script content
 * The hook is a Node.js script — NOT a shell script
 * Uses #!/usr/bin/env node so it runs identically on Windows, Mac, Linux
 * @returns {string} Hook file content with LF line endings
 */
function buildHookContent() {
  // Build the hook script as a template string for readability
  // The hook is a Node.js script — NOT a shell script
  const script = [
    '#!/usr/bin/env node',
    '',
    '// Installed by ContextBridge',
    '// This hook runs before every commit to generate rich context-aware commit messages',
    '// Do not edit manually — run "contextbridge init" to reinstall',
    '',
    'const { execSync } = require("child_process");',
    'const path = require("path");',
    '',
    'const commitMsgFile = process.argv[2];',
    'if (!commitMsgFile) process.exit(0);',
    '',
    'try {',
    '  const globalRoot = execSync("npm root -g", { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).trim();',
    '  const entryPoint = path.join(globalRoot, "contextbridge", "bin", "contextbridge.js");',
    '  const fs = require("fs");',
    '  if (fs.existsSync(entryPoint)) {',
    '    execSync(`node "${entryPoint}" hook "${commitMsgFile}"`, { stdio: "inherit", cwd: process.cwd() });',
    '  } else {',
    '    execSync(`npx contextbridge hook "${commitMsgFile}"`, { stdio: "inherit", cwd: process.cwd() });',
    '  }',
    '} catch (e) {',
    '  // Silently let git proceed — contextbridge handles its own errors and always exits 0',
    '}',
    '',
  ].join('\n');

  return script;
}

/**
 * Check if a hook is already installed
 * @param {string} projectRoot - Absolute path to project root
 * @returns {boolean}
 */
function isHookInstalled(projectRoot) {
  return fileExists(getHookPath(projectRoot));
}

/**
 * Check if the existing hook was installed by ContextBridge
 * @param {string} projectRoot - Absolute path to project root
 * @returns {boolean}
 */
function isContextBridgeHook(projectRoot) {
  const hookPath = getHookPath(projectRoot);
  if (!fileExists(hookPath)) return false;

  try {
    const content = fs.readFileSync(hookPath, 'utf-8');
    return content.includes('Installed by ContextBridge');
  } catch {
    return false;
  }
}

/**
 * Install the prepare-commit-msg hook
 * @param {string} projectRoot - Absolute path to project root
 * @param {Object} [options] - Install options
 * @param {boolean} [options.force] - Overwrite existing hook without asking
 * @returns {{ success: boolean, message: string }}
 */
function installHook(projectRoot, options = {}) {
  // Verify git repo
  if (!isGitRepo(projectRoot)) {
    return {
      success: false,
      message: 'Not a git repository. Run "git init" first.',
    };
  }

  // Ensure hooks directory exists
  const hooksDir = getHooksDir(projectRoot);
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = getHookPath(projectRoot);

  // Check for existing hook
  if (isHookInstalled(projectRoot) && !options.force) {
    if (isContextBridgeHook(projectRoot)) {
      // Our hook already installed — just overwrite with latest version
    } else {
      return {
        success: false,
        message: 'A prepare-commit-msg hook already exists and was not installed by ContextBridge. Use --force to overwrite.',
      };
    }
  }

  // Write the hook file with LF line endings
  const content = buildHookContent();
  fs.writeFileSync(hookPath, content, { encoding: 'utf-8' });

  // Make executable (cross-platform)
  try {
    fs.chmodSync(hookPath, 0o755);
  } catch {
    // chmod may not work on all Windows setups — not fatal
    // Git Bash handles execution differently
  }

  // Verify: read back and check for CRLF
  const written = fs.readFileSync(hookPath, 'utf-8');
  if (written.includes('\r\n')) {
    // Force fix CRLF → LF
    fs.writeFileSync(hookPath, written.replace(/\r\n/g, '\n'), { encoding: 'utf-8' });
  }

  return {
    success: true,
    message: 'Git hook installed at ' + hookPath,
  };
}

/**
 * Remove the ContextBridge hook
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ success: boolean, message: string }}
 */
function removeHook(projectRoot) {
  const hookPath = getHookPath(projectRoot);

  if (!isHookInstalled(projectRoot)) {
    return { success: true, message: 'No hook installed.' };
  }

  if (!isContextBridgeHook(projectRoot)) {
    return {
      success: false,
      message: 'Hook exists but was not installed by ContextBridge. Not removing.',
    };
  }

  fs.unlinkSync(hookPath);
  return { success: true, message: 'Hook removed.' };
}

module.exports = {
  getHookPath,
  getHooksDir,
  buildHookContent,
  isHookInstalled,
  isContextBridgeHook,
  installHook,
  removeHook,
  HOOK_NAME,
};
