// src/utils/logger.js — Terminal output formatting using chalk

const chalk = require('chalk');

const logger = {
  /**
   * Print a section header with a divider line beneath
   */
  header(text) {
    console.log('');
    console.log(chalk.bold.white(`  ${text}`));
    console.log(chalk.dim('  ' + '━'.repeat(text.length + 2)));
    console.log('');
  },

  /**
   * Success message with green checkmark
   */
  success(text) {
    console.log(chalk.green('  ✓ ') + text);
  },

  /**
   * Error message with red cross
   */
  error(text) {
    console.log(chalk.red('  ✗ ') + text);
  },

  /**
   * Informational message with dim bullet
   */
  info(text) {
    console.log(chalk.dim('  • ') + text);
  },

  /**
   * Warning message with yellow triangle
   */
  warn(text) {
    console.log(chalk.yellow('  ⚠ ') + text);
  },

  /**
   * Print a horizontal divider line
   */
  divider() {
    console.log('');
    console.log(chalk.dim('  ' + '━'.repeat(36)));
    console.log('');
  },

  /**
   * Print a key-value pair, aligned for status output
   */
  keyValue(key, value) {
    const paddedKey = (key + ':').padEnd(18);
    console.log(chalk.dim('  ') + chalk.white(paddedKey) + value);
  },

  /**
   * Print a blank line
   */
  blank() {
    console.log('');
  }
};

module.exports = logger;
