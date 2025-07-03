#! /usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lib/logger.js
function createLogger(options = {}) {
  return new AkLogger(options);
}
var import_readline, import_ak_tools, AkLogger;
var init_logger = __esm({
  "lib/logger.js"() {
    "use strict";
    import_readline = __toESM(require("readline"), 1);
    import_ak_tools = require("ak-tools");
    AkLogger = class _AkLogger {
      constructor(options = {}) {
        this.verbose = options.verbose !== false;
        this.startTime = null;
        this.lastProgressUpdate = 0;
        this.progressUpdateInterval = options.progressUpdateInterval || 250;
        this.showThroughput = options.showThroughput !== false;
        this.showMemory = options.showMemory || false;
        this.progressBarWidth = options.progressBarWidth || 30;
        this.logPrefix = options.logPrefix || "\u{1F680}";
        this.progressActive = false;
        this.originalLog = console.log;
        this.originalError = console.error;
        this.originalWarn = console.warn;
        this.log = this.log.bind(this);
        this.error = this.error.bind(this);
        this.warn = this.warn.bind(this);
        this.progress = this.progress.bind(this);
      }
      /**
       * Start a new operation with initial logging
       * 
       * @description
       * Initializes timing and displays operation start message with configuration.
       * Sets up progress tracking and logs relevant configuration details.
       * 
       * @param {string} message - Operation description to display
       * @description Brief description of what operation is starting
       * 
       * @param {Object} [config={}] - Configuration details to display
       * @param {string} [config.url] - Target URL
       * @param {string} [config.method] - HTTP method
       * @param {number} [config.batchSize] - Batch size
       * @param {number} [config.concurrency] - Concurrency level
       * @param {number} [config.retries] - Retry attempts
       * @param {number} [config.timeout] - Request timeout
       * 
       * @example
       * logger.start('Processing bulk upload', {
       *   url: 'https://api.example.com/bulk',
       *   method: 'POST',
       *   batchSize: 100,
       *   concurrency: 10
       * });
       * 
       * @since 2.0.0
       */
      start(message, config = {}) {
        this.startTime = Date.now();
        this.lastProgressUpdate = 0;
        if (!this.verbose) return;
        console.log(`
${this.logPrefix} ${message}`);
        if (config && Object.keys(config).length > 0) {
          this.logConfig(config);
        }
        console.log("");
      }
      /**
       * Log configuration details in a friendly format
       * 
       * @description
       * Displays configuration settings in a clean, readable format.
       * Shows key operational parameters and enabled features.
       * 
       * @param {Object} config - Configuration object to display
       * @param {string} [config.url] - Target URL
       * @param {string} [config.method] - HTTP method
       * @param {number} [config.batchSize] - Items per batch
       * @param {number} [config.concurrency] - Concurrent requests
       * @param {number} [config.retries] - Retry attempts
       * @param {number} [config.timeout] - Request timeout
       * @param {Array|string} [config.data] - Data source
       * 
       * @example
       * logger.logConfig({
       *   url: 'https://api.example.com',
       *   method: 'POST',
       *   batchSize: 50,
       *   concurrency: 5,
       *   enableCookies: true
       * });
       * // Outputs formatted configuration display
       * 
       * @since 2.0.0
       */
      logConfig(config) {
        if (!this.verbose) return;
        const {
          url,
          method = "POST",
          batchSize,
          concurrency,
          retries,
          timeout,
          data,
          ...otherConfig
        } = config;
        console.log("\u{1F4CB} Configuration:");
        console.log(`   URL: ${url}`);
        console.log(`   Method: ${method.toUpperCase()}`);
        if (Array.isArray(data)) {
          console.log(`   Records: ${(0, import_ak_tools.comma)(data.length)}`);
        } else if (typeof data === "string") {
          console.log(`   Data Source: ${data}`);
        }
        if (batchSize) {
          console.log(`   Batch Size: ${(0, import_ak_tools.comma)(batchSize)}`);
        }
        if (concurrency) {
          console.log(`   Concurrency: ${concurrency}`);
        }
        if (retries !== void 0) {
          console.log(`   Retries: ${retries === null ? "Fire-and-forget" : retries}`);
        }
        if (timeout) {
          console.log(`   Timeout: ${this.formatDuration(timeout)}`);
        }
        const interestingKeys = ["enableCookies", "enableConnectionPooling", "useStaticRetryDelay"];
        const additionalConfig = {};
        interestingKeys.forEach((key) => {
          if (otherConfig[key] !== void 0) {
            additionalConfig[key] = otherConfig[key];
          }
        });
        if (Object.keys(additionalConfig).length > 0) {
          console.log(`   Features: ${Object.entries(additionalConfig).filter(([, value]) => value).map(([key]) => this.camelToTitle(key)).join(", ")}`);
        }
      }
      /**
       * Update progress display with current statistics
       * 
       * @description
       * Updates the progress display with current statistics including completion
       * percentage, throughput, and ETA. Throttles updates for performance.
       * 
       * @param {number} completed - Number of completed items
       * @description Usually represents completed batches or requests
       * 
       * @param {number} [total=0] - Total number of items to process
       * @description When 0, shows completed count without percentage
       * 
       * @param {number} [records=0] - Number of individual records processed
       * @description Distinct from batches, represents actual data items
       * 
       * @param {Object} [options={}] - Additional progress options
       * @description Reserved for future progress display options
       * 
       * @example
       * // Basic progress with percentage
       * logger.progress(75, 100, 7500);
       * // Displays: [████████████████████░░░░░░░░░░] 75% | 75/100 batches | 7,500 records | 25 req/s
       * 
       * @example
       * // Progress without total (streaming mode)
       * logger.progress(150, 0, 15000);
       * // Displays: [████████████████████████████████] 0% | 150 requests | 15,000 records | 30 req/s
       * 
       * @since 2.0.0
       */
      progress(completed, total = 0, records = 0, options = {}) {
        if (!this.verbose) return;
        const now = Date.now();
        if (now - this.lastProgressUpdate < this.progressUpdateInterval) {
          return;
        }
        this.lastProgressUpdate = now;
        this.progressActive = true;
        import_readline.default.cursorTo(process.stdout, 0);
        import_readline.default.clearLine(process.stdout, 0);
        const percent = total > 0 ? Math.floor(completed / total * 100) : 0;
        const progressBar = this.createProgressBar(percent);
        let message = `${progressBar} ${percent}%`;
        if (total > 0) {
          message += ` | ${(0, import_ak_tools.comma)(completed)}/${(0, import_ak_tools.comma)(total)} batches`;
        } else {
          message += ` | ${(0, import_ak_tools.comma)(completed)} requests`;
        }
        if (records > 0) {
          message += ` | ${(0, import_ak_tools.comma)(records)} records`;
        }
        if (this.showThroughput && this.startTime && completed > 0) {
          const elapsed = (now - this.startTime) / 1e3;
          const rps = Math.floor(completed / elapsed);
          if (rps > 0) {
            message += ` | ${(0, import_ak_tools.comma)(rps)} req/s`;
          }
          if (records > 0) {
            const recordsPerSec = Math.floor(records / elapsed);
            if (recordsPerSec > 0) {
              message += ` (${(0, import_ak_tools.comma)(recordsPerSec)} rec/s)`;
            }
          }
        }
        if (this.showMemory) {
          const memUsage = process.memoryUsage();
          const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
          message += ` | ${heapMB}MB`;
        }
        if (this.startTime && total > 0 && completed > 0 && percent < 100) {
          const elapsed = now - this.startTime;
          const rate = completed / elapsed;
          const remaining = total - completed;
          const eta = remaining / rate;
          if (eta > 0 && eta < 864e5) {
            message += ` | ETA: ${this.formatDuration(eta)}`;
          }
        }
        process.stdout.write(`   ${message}`);
      }
      /**
       * Complete progress display and show final statistics
       * 
       * @description
       * Clears progress line and displays final operation statistics.
       * Shows completion status, timing, throughput, and error counts.
       * 
       * @param {Object} [results={}] - Final operation results
       * @param {number} [results.reqCount] - Total requests made
       * @param {number} [results.rowCount] - Total records processed
       * @param {number} [results.duration] - Operation duration in ms
       * @param {number} [results.rps] - Requests per second
       * @param {number} [results.errors] - Number of errors
       * @param {Object} [results.stats] - Memory statistics
       * 
       * @example
       * logger.complete({
       *   reqCount: 100,
       *   rowCount: 10000,
       *   duration: 30000,
       *   rps: 3.33,
       *   errors: 2
       * });
       * // Displays completion summary with all metrics
       * 
       * @since 2.0.0
       */
      complete(results = {}) {
        if (!this.verbose) return;
        import_readline.default.cursorTo(process.stdout, 0);
        import_readline.default.clearLine(process.stdout, 0);
        const {
          reqCount = 0,
          rowCount = 0,
          duration = 0,
          rps = 0,
          errors = 0
        } = results;
        const emoji = errors > 0 ? "\u26A0\uFE0F" : "\u2705";
        console.log(`${emoji} Completed: ${(0, import_ak_tools.comma)(reqCount)} requests`);
        if (rowCount > 0) {
          console.log(`   \u{1F4CA} Processed: ${(0, import_ak_tools.comma)(rowCount)} records`);
        }
        if (duration > 0) {
          console.log(`   \u23F1\uFE0F  Duration: ${this.formatDuration(duration)}`);
        }
        if (rps > 0) {
          console.log(`   \u{1F684} Throughput: ${(0, import_ak_tools.comma)(rps)} requests/second`);
          if (rowCount > 0) {
            const recordsPerSec = Math.floor(rowCount / (duration / 1e3));
            console.log(`   \u{1F4C8} Records/sec: ${(0, import_ak_tools.comma)(recordsPerSec)}`);
          }
        }
        if (errors > 0) {
          console.log(`   \u274C Errors: ${(0, import_ak_tools.comma)(errors)}`);
        }
        if (this.showMemory && results.stats) {
          console.log(`   \u{1F4BE} Memory: ${results.stats.heapUsed}MB heap, ${results.stats.rss}MB RSS`);
        }
        console.log("");
      }
      /**
       * Log general messages (respects verbose setting)
       * 
       * @description
       * Logs messages only when verbose mode is enabled. Uses standard console.log
       * behavior for formatting and output.
       * 
       * @param {...any} args - Arguments to log (same as console.log)
       * @description Supports all console.log argument types and formatting
       * 
       * @example
       * logger.log('Processing started');
       * logger.log('Found %d records in %s', count, filename);
       * logger.log({ config: settings });
       * 
       * @since 2.0.0
       */
      log(...args) {
        if (!this.verbose) return;
        this.originalLog(...args);
      }
      /**
       * Log error messages (always shown regardless of verbose setting)
       * 
       * @description
       * Logs error messages with error emoji prefix. Always displayed regardless
       * of verbose setting since errors are critical information.
       * 
       * @param {...any} args - Arguments to log (same as console.error)
       * @description Supports all console.error argument types and formatting
       * 
       * @example
       * logger.error('Request failed:', error.message);
       * logger.error('Network error: %s', networkError);
       * 
       * @since 2.0.0
       */
      error(...args) {
        this.originalError("\u274C", ...args);
      }
      /**
       * Log warning messages (always shown regardless of verbose setting)
       * 
       * @description
       * Logs warning messages with warning emoji prefix. Always displayed
       * regardless of verbose setting for important notifications.
       * 
       * @param {...any} args - Arguments to log (same as console.warn)
       * @description Supports all console.warn argument types and formatting
       * 
       * @example
       * logger.warn('Retrying request due to timeout');
       * logger.warn('Rate limit approaching: %d/%d', current, limit);
       * 
       * @since 2.0.0
       */
      warn(...args) {
        this.originalWarn("\u26A0\uFE0F", ...args);
      }
      /**
       * Log informational messages with icon
       * 
       * @description
       * Logs informational messages with info emoji prefix. Only displayed
       * when verbose mode is enabled.
       * 
       * @param {...any} args - Arguments to log (same as console.log)
       * @description Supports all console.log argument types and formatting
       * 
       * @example
       * logger.info('Connected to database');
       * logger.info('Cache hit rate: %d%%', hitRate);
       * 
       * @since 2.0.0
       */
      info(...args) {
        if (!this.verbose) return;
        if (this.progressActive) {
          import_readline.default.cursorTo(process.stdout, 0);
          import_readline.default.clearLine(process.stdout, 0);
          this.originalLog("\u2139\uFE0F", ...args);
          this.progressActive = false;
        } else {
          this.originalLog("\u2139\uFE0F", ...args);
        }
      }
      /**
       * Log success messages with icon
       * 
       * @description
       * Logs success messages with success emoji prefix. Only displayed
       * when verbose mode is enabled.
       * 
       * @param {...any} args - Arguments to log (same as console.log)
       * @description Supports all console.log argument types and formatting
       * 
       * @example
       * logger.success('Upload completed successfully');
       * logger.success('Processed %d records', recordCount);
       * 
       * @since 2.0.0
       */
      success(...args) {
        if (!this.verbose) return;
        this.originalLog("\u2705", ...args);
      }
      /**
       * Log file operation messages
       * 
       * @description
       * Logs file operation messages with file emoji prefix. Shows operation
       * type, filename, and optional format information.
       * 
       * @param {string} operation - Operation type (Reading, Writing, etc.)
       * @description Capitalized operation description like 'Writing', 'Reading'
       * 
       * @param {string} filename - File name or path
       * @description Full or relative path to the file being operated on
       * 
       * @param {string} [format=''] - File format description
       * @description Optional format like 'json', 'csv', 'ndjson'
       * 
       * @example
       * logger.fileOperation('Writing', './results.json', 'json');
       * // Output: 📁 Writing: ./results.json (json)
       * 
       * @example
       * logger.fileOperation('Reading', '/data/input.csv');
       * // Output: 📁 Reading: /data/input.csv
       * 
       * @since 2.0.0
       */
      fileOperation(operation, filename, format = "") {
        if (!this.verbose) return;
        const formatStr = format ? ` (${format})` : "";
        this.originalLog(`\u{1F4C1} ${operation}: ${filename}${formatStr}`);
      }
      /**
       * Create ASCII progress bar
       * 
       * @description
       * Generates an ASCII progress bar using block characters. Creates visual
       * representation of completion percentage with filled and empty sections.
       * 
       * @param {number} percent - Percentage complete (0-100)
       * @description Must be between 0 and 100, values outside range may produce unexpected results
       * 
       * @returns {string} ASCII progress bar string
       * @description Formatted progress bar like '[████████████░░░░░░░░░░░░░░░░░░]'
       * 
       * @example
       * logger.createProgressBar(75);
       * // Returns: '[██████████████████████░░░░░░░░]'
       * 
       * @example
       * logger.createProgressBar(0);
       * // Returns: '[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]'
       * 
       * @since 2.0.0
       */
      createProgressBar(percent) {
        const filled = Math.floor(percent / 100 * this.progressBarWidth);
        const empty = this.progressBarWidth - filled;
        const filledBar = "\u2588".repeat(filled);
        const emptyBar = "\u2591".repeat(empty);
        return `[${filledBar}${emptyBar}]`;
      }
      /**
       * Format duration in milliseconds to human-readable string
       * 
       * @description
       * Converts millisecond durations into human-readable format with appropriate
       * units. Automatically selects the most suitable unit (ms, s, m, h) based on duration.
       * 
       * @param {number} ms - Duration in milliseconds
       * @description Must be a non-negative number
       * 
       * @returns {string} Formatted duration string
       * @description Like '500ms', '2.5s', '3m 45s', '1h 30m'
       * 
       * @example
       * logger.formatDuration(500);    // '500ms'
       * logger.formatDuration(2500);   // '2.5s'
       * logger.formatDuration(90000);  // '1m 30s'
       * logger.formatDuration(3661000); // '1h 1m'
       * 
       * @since 2.0.0
       */
      formatDuration(ms) {
        if (ms < 1e3) {
          return `${Math.round(ms)}ms`;
        }
        const seconds = ms / 1e3;
        if (seconds < 60) {
          return `${seconds.toFixed(1)}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        if (minutes < 60) {
          return `${minutes}m ${remainingSeconds}s`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
      }
      /**
       * Convert camelCase to Title Case
       * 
       * @description
       * Converts camelCase strings to Title Case for display purposes.
       * Useful for converting configuration property names into readable labels.
       * 
       * @param {string} str - camelCase string to convert
       * @description String in camelCase format like 'enableCookies'
       * 
       * @returns {string} Title Case string
       * @description Converted string like 'Enable Cookies'
       * 
       * @example
       * logger.camelToTitle('enableCookies');        // 'Enable Cookies'
       * logger.camelToTitle('useStaticRetryDelay'); // 'Use Static Retry Delay'
       * logger.camelToTitle('maxRetries');          // 'Max Retries'
       * 
       * @since 2.0.0
       */
      camelToTitle(str) {
        return str.replace(/([A-Z])/g, " $1").replace(/^./, (str2) => str2.toUpperCase()).trim();
      }
      /**
       * Temporarily disable logging
       * 
       * @description
       * Disables verbose logging output. Error and warning messages will still
       * be displayed. Can be re-enabled with unsilence().
       * 
       * @example
       * logger.silence();
       * logger.log('This will not be displayed');
       * logger.error('This will still be displayed');
       * 
       * @since 2.0.0
       */
      silence() {
        this.verbose = false;
      }
      /**
       * Re-enable logging
       * 
       * @description
       * Re-enables verbose logging output that was previously disabled with silence().
       * Restores normal logging behavior.
       * 
       * @example
       * logger.silence();
       * logger.unsilence();
       * logger.log('This will be displayed again');
       * 
       * @since 2.0.0
       */
      unsilence() {
        this.verbose = true;
      }
      /**
       * Check if logger is in verbose mode
       * 
       * @description
       * Returns the current verbose state of the logger. Useful for conditional
       * logging logic in calling code.
       * 
       * @returns {boolean} True if verbose mode is enabled
       * @description False if logging has been silenced or verbose was set to false
       * 
       * @example
       * if (logger.isVerbose()) {
       *   const details = generateDetailedReport();
       *   logger.log('Detailed report:', details);
       * }
       * 
       * @since 2.0.0
       */
      isVerbose() {
        return this.verbose;
      }
      /**
       * Create a child logger with inherited settings
       * 
       * @description
       * Creates a new logger instance that inherits settings from the parent.
       * Allows overriding specific options while maintaining other settings.
       * 
       * @param {Object} [options={}] - Options to override from parent
       * @param {boolean} [options.verbose] - Override verbose setting
       * @param {boolean} [options.showThroughput] - Override throughput display
       * @param {boolean} [options.showMemory] - Override memory display
       * @param {number} [options.progressBarWidth] - Override progress bar width
       * @param {string} [options.logPrefix] - Override log prefix emoji
       * 
       * @returns {AkLogger} New logger instance with inherited settings
       * @description Independent logger that can be configured separately
       * 
       * @example
       * const parentLogger = new AkLogger({ verbose: true, showMemory: true });
       * const childLogger = parentLogger.child({ logPrefix: '📊' });
       * // Child inherits verbose: true, showMemory: true but uses different prefix
       * 
       * @since 2.0.0
       */
      child(options = {}) {
        return new _AkLogger({
          verbose: this.verbose,
          showThroughput: this.showThroughput,
          showMemory: this.showMemory,
          progressBarWidth: this.progressBarWidth,
          logPrefix: this.logPrefix,
          ...options
        });
      }
    };
  }
});

// cli.js
async function cliParams() {
  const args = (0, import_yargs.default)(process.argv.splice(2)).scriptName("ak-fetch").usage(`${welcome}

usage:
npx $0 [data] [options]

examples:
  # Basic batch processing
  npx $0 ./data.json --url https://api.example.com --batchSize 50

  # High-performance streaming
  npx $0 ./events.jsonl --url https://api.example.com/events --batchSize 1000 --concurrency 20 --enableConnectionPooling

  # Multiple HTTP methods
  npx $0 ./users.json --url https://api.example.com/users --method PUT --enableCookies

  # Memory-efficient large files
  npx $0 ./massive-dataset.jsonl --url https://api.example.com/bulk --maxResponseBuffer 100 --storeResponses false

  # Dynamic authentication
  npx $0 ./data.json --url https://api.example.com/secure --shellCommand 'aws sts get-session-token --query Credentials.SessionToken --output text'

  # Inline data
  npx $0 --payload '[{"id": 1, "name": "test"}]' --url https://api.example.com --verbose

DOCS: https://github.com/ak--47/ak-fetch`).command("$0", "bulk fetch calls", () => {
  }).option("url", {
    demandOption: false,
    describe: "Target API endpoint URL",
    type: "string"
  }).option("method", {
    demandOption: false,
    describe: "HTTP method (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)",
    type: "string",
    default: "POST",
    choices: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
  }).option("batch_size", {
    alias: "batchSize",
    demandOption: false,
    describe: "Records per HTTP request (0 disables batching)",
    type: "number",
    default: 2
  }).option("concurrency", {
    demandOption: false,
    describe: "Maximum concurrent requests",
    type: "number",
    default: 10
  }).option("max_tasks", {
    alias: "maxTasks",
    demandOption: false,
    describe: "Max queued tasks before pausing stream",
    type: "number",
    default: 25
  }).option("delay", {
    demandOption: false,
    describe: "Delay between requests in milliseconds",
    type: "number",
    default: 0
  }).option("retries", {
    demandOption: false,
    describe: "Max retry attempts (null for fire-and-forget)",
    type: "number",
    default: 3
  }).option("retry_delay", {
    alias: "retryDelay",
    demandOption: false,
    describe: "Base retry delay in milliseconds",
    type: "number",
    default: 1e3
  }).option("retry_on", {
    alias: "retryOn",
    demandOption: false,
    describe: "HTTP status codes to retry on (JSON array)",
    type: "string",
    default: "[408,429,500,502,503,504,520,521,522,523,524]"
  }).option("use_static_retry_delay", {
    alias: "useStaticRetryDelay",
    demandOption: false,
    describe: "Use fixed delays instead of exponential backoff",
    type: "boolean",
    default: false
  }).option("timeout", {
    demandOption: false,
    describe: "Request timeout in milliseconds",
    type: "number",
    default: 6e4
  }).option("dry_run", {
    alias: "dryRun",
    demandOption: false,
    default: false,
    describe: "Test mode: simulate requests without making them",
    type: "boolean"
  }).option("curl", {
    demandOption: false,
    default: false,
    describe: "Generate curl commands instead of making requests",
    type: "boolean"
  }).option("show_data", {
    alias: "showData",
    demandOption: false,
    default: false,
    describe: "Show first 100 transformed records in dry-run mode (useful with --preset)",
    type: "boolean"
  }).option("show_sample", {
    alias: "showSample",
    demandOption: false,
    default: false,
    describe: "Show first 3 transformed records in dry-run mode",
    type: "boolean"
  }).option("no_batch", {
    alias: "noBatch",
    demandOption: false,
    describe: "Send as single request without batching",
    type: "boolean",
    default: false
  }).option("log_file", {
    alias: "logFile",
    demandOption: false,
    describe: "Save responses to file",
    type: "string"
  }).option("format", {
    demandOption: false,
    describe: "Output format for log files (auto-detected from file extension if not specified)",
    type: "string",
    choices: ["json", "csv", "ndjson"]
  }).option("verbose", {
    demandOption: false,
    default: true,
    describe: "Enable progress display and detailed logging",
    type: "boolean"
  }).option("response_headers", {
    alias: "responseHeaders",
    demandOption: false,
    describe: "Include response headers in output",
    type: "boolean",
    default: false
  }).options("search_params", {
    alias: "searchParams",
    demandOption: false,
    default: "{}",
    describe: 'URL query parameters as JSON: {"key": "value"}',
    type: "string"
  }).options("body_params", {
    alias: "bodyParams",
    demandOption: false,
    default: "{}",
    describe: "Additional body parameters as JSON",
    type: "string"
  }).options("headers", {
    demandOption: false,
    default: "{}",
    describe: 'HTTP headers as JSON: {"Authorization": "Bearer xxx"}',
    type: "string"
  }).options("payload", {
    demandOption: false,
    describe: "Data to send as JSON (alternative to file argument)",
    type: "string"
  }).option("enable_connection_pooling", {
    alias: "enableConnectionPooling",
    demandOption: false,
    describe: "Enable HTTP connection pooling for performance",
    type: "boolean",
    default: true
  }).option("keep_alive", {
    alias: "keepAlive",
    demandOption: false,
    describe: "Keep TCP connections alive",
    type: "boolean",
    default: true
  }).option("max_response_buffer", {
    alias: "maxResponseBuffer",
    demandOption: false,
    describe: "Maximum responses kept in memory (circular buffer)",
    type: "number",
    default: 1e3
  }).option("max_memory_usage", {
    alias: "maxMemoryUsage",
    demandOption: false,
    describe: "Memory limit in bytes",
    type: "number"
  }).option("force_gc", {
    alias: "forceGC",
    demandOption: false,
    describe: "Force garbage collection after batches",
    type: "boolean",
    default: false
  }).option("high_water_mark", {
    alias: "highWaterMark",
    demandOption: false,
    describe: "Stream buffer size in bytes",
    type: "number",
    default: 16384
  }).option("enable_cookies", {
    alias: "enableCookies",
    demandOption: false,
    describe: "Enable automatic cookie handling",
    type: "boolean",
    default: false
  }).option("store_responses", {
    alias: "storeResponses",
    demandOption: false,
    describe: "Store responses in memory",
    type: "boolean",
    default: true
  }).option("clone", {
    demandOption: false,
    describe: "Clone data before transformation",
    type: "boolean",
    default: false
  }).option("debug", {
    demandOption: false,
    describe: "Enable debug mode with detailed error info",
    type: "boolean",
    default: false
  }).option("shell_command", {
    alias: "shellCommand",
    demandOption: false,
    describe: "Shell command for dynamic header generation",
    type: "string"
  }).option("shell_header", {
    alias: "shellHeader",
    demandOption: false,
    describe: "Header name for shell command output",
    type: "string",
    default: "Authorization"
  }).option("shell_prefix", {
    alias: "shellPrefix",
    demandOption: false,
    describe: "Prefix for shell command header value",
    type: "string",
    default: "Bearer"
  }).option("preset", {
    demandOption: false,
    describe: "Apply vendor-specific data transformation preset",
    type: "string",
    choices: ["mixpanel", "amplitude", "pendo"]
  }).help().wrap(null).argv;
  if (args._.length === 0 && !args.payload) {
    if (args.method !== "GET" && args.method !== "HEAD" && args.method !== "OPTIONS") {
      throw new Error("No data provided. Please specify a file or use --payload to provide inline data.");
    }
  }
  if (!args.url) {
    throw new Error("URL is required. Use --url <endpoint> to specify the target API endpoint.");
  }
  if (args.headers) {
    args.headers = parse(args.headers);
  }
  if (args.search_params) args.searchParams = parse(args.search_params);
  if (args.body_params) args.bodyParams = parse(args.body_params);
  if (args.retry_on) args.retryOn = parse(args.retry_on);
  if (args.payload) args.data = parse(args.payload);
  if (args.curl) args.dryRun = "curl";
  else if (args.dry_run) args.dryRun = true;
  else args.dryRun = false;
  if (args.shell_command) {
    args.shell = {
      // @ts-ignore
      command: args.shell_command,
      // @ts-ignore
      header: args.shell_header,
      // @ts-ignore
      prefix: args.shell_prefix
    };
  }
  if (args.retries === "null" || args.retries === null) args.retries = null;
  if (args.log_file && !args.format) {
    const ext = args.log_file.toLowerCase().split(".").pop();
    if (ext === "ndjson" || ext === "jsonl") {
      args.format = "ndjson";
    } else if (ext === "csv") {
      args.format = "csv";
    } else {
      args.format = "json";
    }
  }
  const file = args._[0];
  if (file) {
    try {
      args.data = file;
    } catch (error) {
      const logger = createLogger({ verbose: true });
      logger.error(`Failed to process file: ${file}`, error.message);
      process.exit(1);
    }
  }
  if (!args.data && args.method !== "GET" && args.method !== "HEAD" && args.method !== "OPTIONS") {
    throw new Error("No data provided for " + args.method + " request");
  }
  delete args._;
  delete args.$0;
  delete args.shell_command;
  delete args.shell_header;
  delete args.shell_prefix;
  delete args.retry_on;
  delete args.search_params;
  delete args.body_params;
  return args;
}
function parse(val, defaultVal = void 0) {
  if (typeof val === "string") {
    try {
      val = JSON.parse(val);
    } catch (firstError) {
      try {
        if (typeof val === "string") val = JSON.parse(val?.replace(/'/g, '"'));
      } catch (secondError) {
        if (this.verbose) console.log(`error parsing tags: ${val}
tags must be valid JSON`);
        val = defaultVal;
      }
    }
  }
  if (Object.keys(val).length === 0) return defaultVal;
  return val;
}
var import_yargs, import_fs, import_ak_tools2, import_meta, packageJson, version, hero, banner, welcome, cli_default;
var init_cli = __esm({
  "cli.js"() {
    "use strict";
    import_yargs = __toESM(require("yargs"), 1);
    import_fs = require("fs");
    import_ak_tools2 = __toESM(require("ak-tools"), 1);
    init_logger();
    import_meta = {};
    packageJson = JSON.parse((0, import_fs.readFileSync)("./package.json", "utf8"));
    ({ version } = packageJson);
    hero = String.raw`
░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░      ░▒▓████████▓▒░▒▓████████▓▒░▒▓████████▓▒░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░         ░▒▓█▓▒░  ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░         ░▒▓█▓▒░  ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓████████▓▒░▒▓███████▓▒░       ░▒▓██████▓▒░ ░▒▓██████▓▒░    ░▒▓█▓▒░  ░▒▓█▓▒░      ░▒▓████████▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░         ░▒▓█▓▒░  ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░         ░▒▓█▓▒░  ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓████████▓▒░  ░▒▓█▓▒░   ░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░                                                                                                    
`;
    banner = `... production-ready HTTP client for bulk operations (v${version || 2})
	\u{1F680} High Performance \u2022 \u{1F504} Smart Retries \u2022 \u{1F4BE} Memory Efficient \u2022 \u{1F512} Production Ready
	by AK (ak@mixpanel.com)

`;
    welcome = hero.concat("\n").concat(banner);
    cliParams.welcome = welcome;
    if (import_meta.url === `file://${process.argv[1]}`) {
      (async () => {
        try {
          const { default: akFetch } = await Promise.resolve().then(() => (init_index(), index_exports));
          const config = await cliParams();
          const result = await akFetch(config);
          if (result && typeof result === "object") {
            process.exit(0);
          }
        } catch (error) {
          console.error("Error:", error.message);
          process.exit(1);
        }
      })();
    }
    cli_default = cliParams;
  }
});

// lib/errors.js
var AkFetchError, NetworkError, TimeoutError, RetryError, ValidationError, RateLimitError, ConfigurationError, SSLError, MemoryError;
var init_errors = __esm({
  "lib/errors.js"() {
    "use strict";
    AkFetchError = class extends Error {
      constructor(message, options = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = options.code;
        this.statusCode = options.statusCode;
        this.url = options.url;
        this.method = options.method;
        this.retryCount = options.retryCount || 0;
        this.timestamp = (/* @__PURE__ */ new Date()).toISOString();
        Error.captureStackTrace(this, this.constructor);
      }
      toJSON() {
        return {
          name: this.name,
          message: this.message,
          type: this.type,
          code: this.code,
          statusCode: this.statusCode,
          url: this.url,
          method: this.method,
          retryCount: this.retryCount,
          timestamp: this.timestamp
        };
      }
    };
    NetworkError = class extends AkFetchError {
      constructor(message, options = {}) {
        super(message, options);
        this.type = "NETWORK_ERROR";
      }
    };
    TimeoutError = class extends AkFetchError {
      constructor(message, options = {}) {
        super(message, options);
        this.type = "TIMEOUT_ERROR";
        this.timeout = options.timeout;
      }
    };
    RetryError = class extends AkFetchError {
      constructor(message, options = {}) {
        super(message, options);
        this.type = "RETRY_ERROR";
        this.maxRetries = options.maxRetries;
        this.lastError = options.lastError;
      }
    };
    ValidationError = class extends AkFetchError {
      constructor(message, options = {}) {
        super(message, options);
        this.type = "VALIDATION_ERROR";
        this.field = options.field;
        this.value = options.value;
      }
    };
    RateLimitError = class extends AkFetchError {
      constructor(message, options = {}) {
        super(message, options);
        this.type = "RATE_LIMIT_ERROR";
        this.retryAfter = options.retryAfter;
        this.limit = options.limit;
        this.remaining = options.remaining;
      }
    };
    ConfigurationError = class extends AkFetchError {
      constructor(message, options = {}) {
        super(message, options);
        this.type = "CONFIGURATION_ERROR";
        this.parameter = options.parameter;
      }
    };
    SSLError = class extends AkFetchError {
      constructor(message, options = {}) {
        super(message, options);
        this.type = "SSL_ERROR";
        this.certificate = options.certificate;
      }
    };
    MemoryError = class extends AkFetchError {
      constructor(message, options = {}) {
        super(message, options);
        this.type = "MEMORY_ERROR";
        this.memoryUsage = options.memoryUsage;
        this.limit = options.limit;
      }
    };
  }
});

// lib/retry-strategy.js
var RetryStrategy, retry_strategy_default;
var init_retry_strategy = __esm({
  "lib/retry-strategy.js"() {
    "use strict";
    init_errors();
    RetryStrategy = class {
      /**
       * Create a new retry strategy
       * 
       * @param {Object} [options={}] - Retry strategy configuration
       * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
       * @param {number} [options.baseDelay=1000] - Base delay in milliseconds
       * @param {number} [options.maxDelay=30000] - Maximum delay in milliseconds
       * @param {number} [options.exponentialBase=2] - Exponential backoff multiplier
       * @param {number} [options.jitterFactor=0.1] - Jitter factor (0-1)
       * @param {number[]} [options.retryOn] - HTTP status codes to retry on
       * @param {boolean} [options.retryOnNetworkError=true] - Retry on network errors
       * @param {Function} [options.retryHandler] - Custom retry decision function
       * @param {boolean} [options.useStaticDelay=false] - Use static delay instead of exponential
       * @param {number} [options.staticRetryDelay] - Static delay when useStaticDelay is true
       * 
       * @example
       * const strategy = new RetryStrategy({
       *   maxRetries: 5,
       *   baseDelay: 2000,
       *   exponentialBase: 2,
       *   jitterFactor: 0.2
       * });
       * 
       * @since 2.0.0
       */
      constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1e3;
        this.maxDelay = options.maxDelay || 3e4;
        this.exponentialBase = options.exponentialBase || 2;
        this.jitterFactor = options.jitterFactor || 0.1;
        this.retryOn = options.retryOn || [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524];
        this.retryOnNetworkError = options.retryOnNetworkError !== false;
        this.retryHandler = options.retryHandler;
        this.useStaticDelay = options.useStaticDelay || false;
        this.staticRetryDelay = options.staticRetryDelay || this.baseDelay;
      }
      /**
       * Calculate delay for the next retry attempt
       * 
       * @description
       * Calculates retry delay using exponential backoff with jitter, respects
       * Retry-After headers, and enforces maximum delay limits. Supports both
       * dynamic and static delay strategies.
       * 
       * @param {number} attempt - Current attempt number (0-based)
       * @description First retry is attempt 0, second is attempt 1, etc.
       * 
       * @param {Object} [error=null] - Error that occurred
       * @param {number} [error.retryAfter] - Retry-After value in seconds
       * @description When present, takes precedence over calculated delays
       * 
       * @returns {number} Delay in milliseconds
       * @description Calculated delay capped at maxDelay
       * 
       * @example
       * // Exponential backoff
       * strategy.calculateDelay(0);  // ~1000ms + jitter
       * strategy.calculateDelay(1);  // ~2000ms + jitter  
       * strategy.calculateDelay(2);  // ~4000ms + jitter
       * 
       * @example
       * // With Retry-After header
       * const error = { retryAfter: 30 }; // 30 seconds
       * strategy.calculateDelay(0, error); // 30000ms (30 seconds)
       * 
       * @since 2.0.0
       */
      calculateDelay(attempt, error = null) {
        if (this.useStaticDelay) {
          return this.staticRetryDelay;
        }
        if (error && error.retryAfter) {
          return Math.min(error.retryAfter * 1e3, this.maxDelay);
        }
        const exponentialDelay = this.baseDelay * Math.pow(this.exponentialBase, attempt);
        const jitter = exponentialDelay * this.jitterFactor * Math.random();
        const totalDelay = exponentialDelay + jitter;
        return Math.min(totalDelay, this.maxDelay);
      }
      /**
       * Determine if an error should be retried
       * 
       * @description
       * Evaluates whether an error should trigger a retry attempt based on
       * error type, status code, attempt count, and custom retry handlers.
       * Supports network errors, HTTP status codes, and timeout conditions.
       * 
       * @param {Error} error - Error that occurred
       * @param {number} [error.statusCode] - HTTP status code
       * @param {string} [error.code] - Error code (e.g., 'ETIMEDOUT', 'ENOTFOUND')
       * @param {string} [error.name] - Error name (e.g., 'NetworkError', 'TimeoutError')
       * 
       * @param {number} attempt - Current attempt number (0-based)
       * @description Must be less than maxRetries to retry
       * 
       * @returns {boolean} True if the error should be retried
       * @description False if max attempts reached or error is not retryable
       * 
       * @example
       * strategy.shouldRetry({ statusCode: 500 }, 0); // true (server error)
       * strategy.shouldRetry({ statusCode: 404 }, 0); // false (client error)
       * strategy.shouldRetry({ code: 'ENOTFOUND' }, 1); // true (network error)
       * strategy.shouldRetry({ statusCode: 500 }, 3); // false (max attempts)
       * 
       * @since 2.0.0
       */
      shouldRetry(error, attempt) {
        if (attempt >= this.maxRetries) {
          return false;
        }
        if (this.retryHandler && typeof this.retryHandler === "function") {
          return this.retryHandler(error, attempt);
        }
        if (this.retryOnNetworkError && this.isNetworkError(error)) {
          return true;
        }
        if (error.statusCode && this.retryOn.includes(error.statusCode)) {
          return true;
        }
        if (error.code === "ETIMEDOUT" || error.name === "TimeoutError") {
          return true;
        }
        return false;
      }
      /**
       * Check if error is a network error
       * 
       * @description
       * Identifies network-related errors that should typically be retried.
       * Checks error codes, names, and types commonly associated with
       * network connectivity issues.
       * 
       * @param {Error} error - Error to check
       * @param {string} [error.code] - Error code to check
       * @param {string} [error.name] - Error name to check
       * @param {string} [error.type] - Error type to check
       * 
       * @returns {boolean} True if the error is network-related
       * @description Network errors are typically retryable
       * 
       * @example
       * strategy.isNetworkError({ code: 'ENOTFOUND' });     // true
       * strategy.isNetworkError({ code: 'ECONNRESET' });    // true
       * strategy.isNetworkError({ name: 'NetworkError' });  // true
       * strategy.isNetworkError({ statusCode: 400 });       // false
       * 
       * @since 2.0.0
       */
      isNetworkError(error) {
        const networkErrorCodes = [
          "ENOTFOUND",
          "ECONNRESET",
          "ECONNREFUSED",
          "ECONNABORTED",
          "EHOSTUNREACH",
          "ENETUNREACH",
          "EAI_AGAIN"
        ];
        return networkErrorCodes.includes(error.code) || error.name === "NetworkError" || error.type === "NETWORK_ERROR";
      }
      /**
       * Execute a function with retry logic
       * 
       * @description
       * Executes a function with automatic retry logic based on the configured
       * strategy. Handles delays between attempts, retry decision logic, and
       * comprehensive error reporting when all attempts are exhausted.
       * 
       * @param {Function} fn - Async function to execute with retries
       * @description Function receives (context, attempt) as parameters
       * 
       * @param {Object} [context={}] - Context object passed to function
       * @param {string} [context.url] - URL for error reporting
       * @param {string} [context.method] - HTTP method for error reporting
       * @param {boolean} [context.verbose] - Enable retry attempt logging
       * 
       * @returns {Promise<any>} Promise resolving to function result
       * @description Resolves with function result or rejects with RetryError
       * 
       * @throws {RetryError} When all retry attempts are exhausted
       * @throws {Error} When error is not retryable (passes through original error)
       * 
       * @example
       * const result = await strategy.execute(async (context, attempt) => {
       *   console.log(`Attempt ${attempt + 1}`);
       *   const response = await fetch(context.url);
       *   if (!response.ok) {
       *     throw new Error(`HTTP ${response.status}`);
       *   }
       *   return response.json();
       * }, { url: 'https://api.example.com/data' });
       * 
       * @since 2.0.0
       */
      async execute(fn, context = {}) {
        let lastError;
        let attempt = 0;
        while (attempt <= this.maxRetries) {
          try {
            const result = await fn(context, attempt);
            return result;
          } catch (error) {
            lastError = error;
            attempt++;
            if (attempt > this.maxRetries) {
              throw new RetryError(`All ${this.maxRetries} retry attempts failed`, {
                maxRetries: this.maxRetries,
                lastError,
                url: context.url,
                method: context.method
              });
            }
            if (!this.shouldRetry(error, attempt - 1)) {
              throw error;
            }
            const delay = this.calculateDelay(attempt - 1, error);
            if (context.verbose) {
              console.log(`Retry attempt ${attempt}/${this.maxRetries + 1} after ${delay}ms delay. Error: ${error.message}`);
            }
            await this.delay(delay);
          }
        }
        throw new RetryError(`All ${this.maxRetries} retry attempts failed`, {
          maxRetries: this.maxRetries,
          lastError,
          url: context.url,
          method: context.method
        });
      }
      /**
       * Create delay promise
       * 
       * @description
       * Creates a promise that resolves after the specified delay.
       * Used internally for implementing retry delays.
       * 
       * @param {number} ms - Milliseconds to delay
       * @description Must be a non-negative number
       * 
       * @returns {Promise<void>} Promise that resolves after delay
       * @description Promise resolves with no value after timeout
       * 
       * @example
       * await strategy.delay(1000); // Wait 1 second
       * console.log('Delay completed');
       * 
       * @since 2.0.0
       */
      delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
      /**
       * Parse Retry-After header value
       * 
       * @description
       * Parses HTTP Retry-After header values which can be either a number
       * of seconds or an HTTP-date. Handles both formats and validates input.
       * 
       * @param {string} retryAfterHeader - Retry-After header value
       * @description Can be seconds ('120') or HTTP-date ('Wed, 21 Oct 2015 07:28:00 GMT')
       * 
       * @returns {number|null} Seconds to wait, or null if invalid
       * @description Returns null for invalid or missing values
       * 
       * @example
       * strategy.parseRetryAfter('120');    // 120 (seconds)
       * strategy.parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT'); // calculated seconds
       * strategy.parseRetryAfter('invalid'); // null
       * strategy.parseRetryAfter('');        // null
       * 
       * @since 2.0.0
       */
      parseRetryAfter(retryAfterHeader) {
        if (!retryAfterHeader) return null;
        const seconds = parseInt(retryAfterHeader, 10);
        if (!isNaN(seconds) && seconds >= 0) {
          return seconds;
        }
        try {
          const date = new Date(retryAfterHeader);
          if (isNaN(date.getTime())) {
            return null;
          }
          const now = /* @__PURE__ */ new Date();
          const secondsUntil = Math.max(0, Math.floor((date - now) / 1e3));
          return secondsUntil;
        } catch (error) {
          return null;
        }
      }
      /**
       * Create a rate limit error from response headers
       * 
       * @description
       * Creates a specialized RateLimitError with parsed rate limit information
       * from HTTP response headers. Extracts retry timing and quota information.
       * 
       * @param {Object} headers - HTTP response headers
       * @param {string} [headers['retry-after']] - Retry-After header
       * @param {string} [headers['x-ratelimit-limit']] - Rate limit quota
       * @param {string} [headers['x-ratelimit-remaining']] - Remaining quota
       * @param {string} [headers['x-rate-limit-limit']] - Alternative rate limit header
       * @param {string} [headers['x-rate-limit-remaining']] - Alternative remaining header
       * 
       * @param {number} statusCode - HTTP status code (typically 429)
       * @description Status code for the rate limit response
       * 
       * @returns {RateLimitError} Specialized rate limit error
       * @description Error with parsed rate limit metadata
       * 
       * @example
       * const headers = {
       *   'retry-after': '60',
       *   'x-ratelimit-limit': '1000',
       *   'x-ratelimit-remaining': '0'
       * };
       * const error = strategy.createRateLimitError(headers, 429);
       * console.log(error.retryAfter); // 60
       * console.log(error.limit);      // 1000
       * 
       * @since 2.0.0
       */
      createRateLimitError(headers, statusCode) {
        const retryAfter = this.parseRetryAfter(headers["retry-after"]);
        const limit = headers["x-ratelimit-limit"] || headers["x-rate-limit-limit"];
        const remaining = headers["x-ratelimit-remaining"] || headers["x-rate-limit-remaining"];
        return new RateLimitError("Rate limit exceeded", {
          statusCode,
          retryAfter,
          limit: limit ? parseInt(limit, 10) : null,
          remaining: remaining ? parseInt(remaining, 10) : null
        });
      }
      /**
       * Get retry strategy configuration statistics
       * 
       * @description
       * Returns the current configuration of the retry strategy for
       * debugging and monitoring purposes.
       * 
       * @returns {Object} Retry strategy statistics
       * @property {number} maxRetries - Maximum retry attempts
       * @property {number} baseDelay - Base delay in milliseconds
       * @property {number} maxDelay - Maximum delay in milliseconds
       * @property {number} exponentialBase - Exponential backoff multiplier
       * @property {number} jitterFactor - Jitter factor (0-1)
       * @property {number[]} retryOn - HTTP status codes that trigger retries
       * @property {boolean} useStaticDelay - Whether using static delays
       * 
       * @example
       * const stats = strategy.getStats();
       * console.log(`Max retries: ${stats.maxRetries}`);
       * console.log(`Retry on: ${stats.retryOn.join(', ')}`);
       * 
       * @since 2.0.0
       */
      getStats() {
        return {
          maxRetries: this.maxRetries,
          baseDelay: this.baseDelay,
          maxDelay: this.maxDelay,
          exponentialBase: this.exponentialBase,
          jitterFactor: this.jitterFactor,
          retryOn: this.retryOn,
          useStaticDelay: this.useStaticDelay
        };
      }
    };
    retry_strategy_default = RetryStrategy;
  }
});

// lib/cookie-jar.js
var import_tough_cookie, AkCookieJar, cookie_jar_default;
var init_cookie_jar = __esm({
  "lib/cookie-jar.js"() {
    "use strict";
    import_tough_cookie = require("tough-cookie");
    AkCookieJar = class {
      constructor(options = {}) {
        this.jar = new import_tough_cookie.CookieJar(options.store, options);
        this.enabled = options.enabled !== false;
        this.rejectPublicSuffixes = options.rejectPublicSuffixes !== false;
        this.allowSpecialUseDomain = options.allowSpecialUseDomain || false;
      }
      /**
       * Set a cookie from a Set-Cookie header
       * @param {string} cookieString - Cookie string from Set-Cookie header
       * @param {string} url - URL where the cookie was set
       * @returns {Promise<Cookie|null>} The cookie that was set
       */
      async setCookie(cookieString, url) {
        if (!this.enabled) return null;
        try {
          return await this.jar.setCookie(cookieString, url);
        } catch (error) {
          console.warn(`Failed to set cookie: ${error.message}`);
          return null;
        }
      }
      /**
       * Set multiple cookies from Set-Cookie headers
       * @param {string[]} cookieStrings - Array of cookie strings
       * @param {string} url - URL where the cookies were set
       * @returns {Promise<Cookie[]>} Array of cookies that were set
       */
      async setCookies(cookieStrings, url) {
        if (!this.enabled || !Array.isArray(cookieStrings)) return [];
        const cookies = [];
        for (const cookieString of cookieStrings) {
          const cookie = await this.setCookie(cookieString, url);
          if (cookie) cookies.push(cookie);
        }
        return cookies;
      }
      /**
       * Get cookies for a URL as a Cookie header value
       * @param {string} url - URL to get cookies for
       * @returns {Promise<string>} Cookie header value
       */
      async getCookieString(url) {
        if (!this.enabled) return "";
        try {
          return await this.jar.getCookieString(url);
        } catch (error) {
          console.warn(`Failed to get cookies: ${error.message}`);
          return "";
        }
      }
      /**
       * Get cookies for a URL as Cookie objects
       * @param {string} url - URL to get cookies for
       * @returns {Promise<Cookie[]>} Array of cookies
       */
      async getCookies(url) {
        if (!this.enabled) return [];
        try {
          return await this.jar.getCookies(url);
        } catch (error) {
          console.warn(`Failed to get cookies: ${error.message}`);
          return [];
        }
      }
      /**
       * Remove cookies that match the criteria
       * @param {string} domain - Domain to remove cookies from
       * @param {string} path - Path to remove cookies from
       * @param {string} name - Name of cookie to remove
       * @returns {Promise<number>} Number of cookies removed
       */
      async removeCookies(domain, path2, name) {
        if (!this.enabled) return 0;
        try {
          const cookies = await this.jar.getCookies(`http://${domain}${path2 || "/"}`);
          let removed = 0;
          for (const cookie of cookies) {
            if (!name || cookie.key === name) {
              await this.jar.store.removeCookie(cookie.domain, cookie.path, cookie.key);
              removed++;
            }
          }
          return removed;
        } catch (error) {
          console.warn(`Failed to remove cookies: ${error.message}`);
          return 0;
        }
      }
      /**
       * Clear all cookies
       * @returns {Promise<void>}
       */
      async clear() {
        if (!this.enabled) return;
        try {
          const store = this.jar.store;
          if (store.removeAllCookies) {
            return await new Promise((resolve, reject) => {
              store.removeAllCookies((err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          } else {
            const domains = await this.getAllDomains();
            for (const domain of domains) {
              await this.removeCookies(domain, "/", null);
            }
          }
        } catch (error) {
          console.warn(`Failed to clear cookies: ${error.message}`);
        }
      }
      /**
       * Get all domains that have cookies
       * @returns {Promise<string[]>} Array of domains
       */
      async getAllDomains() {
        if (!this.enabled) return [];
        try {
          const domains = /* @__PURE__ */ new Set();
          const allCookies = await this.getAllCookies();
          for (const cookie of allCookies) {
            domains.add(cookie.domain);
          }
          return Array.from(domains);
        } catch (error) {
          console.warn(`Failed to get domains: ${error.message}`);
          return [];
        }
      }
      /**
       * Get all cookies from the jar
       * @returns {Promise<Cookie[]>} Array of all cookies
       */
      async getAllCookies() {
        if (!this.enabled) return [];
        try {
          const cookies = [];
          const store = this.jar.store;
          if (store.getAllCookies) {
            return await new Promise((resolve, reject) => {
              store.getAllCookies((err, allCookies) => {
                if (err) reject(err);
                else resolve(allCookies || []);
              });
            });
          }
          return cookies;
        } catch (error) {
          console.warn(`Failed to get all cookies: ${error.message}`);
          return [];
        }
      }
      /**
       * Export cookies to JSON
       * @returns {Promise<Object>} Serialized cookies
       */
      async serialize() {
        if (!this.enabled) return {};
        try {
          return await new Promise((resolve, reject) => {
            this.jar.serialize((err, serialized) => {
              if (err) reject(err);
              else resolve(serialized);
            });
          });
        } catch (error) {
          console.warn(`Failed to serialize cookies: ${error.message}`);
          return {};
        }
      }
      /**
       * Import cookies from JSON
       * @param {Object} serialized - Serialized cookies
       * @returns {Promise<void>}
       */
      async deserialize(serialized) {
        if (!this.enabled || !serialized) return;
        try {
          this.jar = await import_tough_cookie.CookieJar.deserialize(serialized);
        } catch (error) {
          console.warn(`Failed to deserialize cookies: ${error.message}`);
        }
      }
      /**
       * Process response headers to extract and store cookies
       * @param {Object} headers - Response headers
       * @param {string} url - URL of the response
       * @returns {Promise<Cookie[]>} Cookies that were set
       */
      async processResponseHeaders(headers, url) {
        if (!this.enabled || !headers) return [];
        const setCookieHeaders = [];
        if (headers["set-cookie"]) {
          if (Array.isArray(headers["set-cookie"])) {
            setCookieHeaders.push(...headers["set-cookie"]);
          } else {
            setCookieHeaders.push(headers["set-cookie"]);
          }
        }
        if (setCookieHeaders.length === 0) return [];
        return await this.setCookies(setCookieHeaders, url);
      }
      /**
       * Add cookies to request headers
       * @param {Object} headers - Request headers object
       * @param {string} url - URL of the request
       * @returns {Promise<Object>} Modified headers
       */
      async addCookiesToHeaders(headers, url) {
        if (!this.enabled) return headers;
        const cookieString = await this.getCookieString(url);
        if (cookieString) {
          headers = { ...headers };
          headers["Cookie"] = cookieString;
        }
        return headers;
      }
      /**
       * Get cookie statistics
       * @returns {Promise<Object>} Cookie statistics
       */
      async getStats() {
        if (!this.enabled) return { enabled: false, count: 0, domains: 0 };
        const allCookies = await this.getAllCookies();
        const domains = await this.getAllDomains();
        return {
          enabled: true,
          count: allCookies.length,
          domains: domains.length,
          domainList: domains
        };
      }
      /**
       * Enable or disable the cookie jar
       * @param {boolean} enabled - Whether to enable cookies
       */
      setEnabled(enabled) {
        this.enabled = enabled;
      }
      /**
       * Check if cookies are enabled
       * @returns {boolean} True if enabled
       */
      isEnabled() {
        return this.enabled;
      }
    };
    cookie_jar_default = AkCookieJar;
  }
});

// lib/form-data-handler.js
var import_form_data, import_fs2, import_path, FormDataHandler, form_data_handler_default;
var init_form_data_handler = __esm({
  "lib/form-data-handler.js"() {
    "use strict";
    import_form_data = __toESM(require("form-data"), 1);
    import_fs2 = require("fs");
    import_path = require("path");
    init_errors();
    FormDataHandler = class {
      constructor(options = {}) {
        this.maxFileSize = options.maxFileSize || 100 * 1024 * 1024;
        this.allowedMimeTypes = options.allowedMimeTypes || null;
        this.encoding = options.encoding || "utf8";
      }
      /**
       * Create FormData from various input types
       * @param {Object|Array|FormData} data - Data to convert to FormData
       * @param {Object} options - Options for form data creation
       * @returns {FormData} FormData instance
       */
      createFormData(data, options = {}) {
        const form = new import_form_data.default();
        if (data instanceof import_form_data.default) {
          return data;
        }
        if (Array.isArray(data)) {
          data.forEach((item, index) => {
            this.appendToForm(form, `item_${index}`, item);
          });
        } else if (typeof data === "object" && data !== null) {
          Object.entries(data).forEach(([key, value]) => {
            this.appendToForm(form, key, value);
          });
        } else {
          form.append("data", String(data));
        }
        return form;
      }
      /**
       * Append a value to FormData with proper handling
       * @param {FormData} form - FormData instance
       * @param {string} key - Field key
       * @param {any} value - Value to append
       */
      appendToForm(form, key, value) {
        if (value === null || value === void 0) {
          form.append(key, "");
          return;
        }
        if (this.isFileObject(value)) {
          this.appendFile(form, key, value);
          return;
        }
        if (typeof value === "string" && this.isFilePath(value)) {
          this.appendFilePath(form, key, value);
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            this.appendToForm(form, `${key}[${index}]`, item);
          });
          return;
        }
        if (typeof value === "object") {
          Object.entries(value).forEach(([nestedKey, nestedValue]) => {
            this.appendToForm(form, `${key}[${nestedKey}]`, nestedValue);
          });
          return;
        }
        form.append(key, String(value));
      }
      /**
       * Append a file object to FormData
       * @param {FormData} form - FormData instance
       * @param {string} key - Field key
       * @param {Object} fileObj - File object
       */
      appendFile(form, key, fileObj) {
        const options = {
          filename: fileObj.filename || fileObj.name || "file",
          contentType: fileObj.contentType || fileObj.type || "application/octet-stream"
        };
        if (fileObj.stream) {
          form.append(key, fileObj.stream, options);
        } else if (fileObj.buffer) {
          form.append(key, fileObj.buffer, options);
        } else if (fileObj.data) {
          form.append(key, fileObj.data, options);
        } else {
          throw new ValidationError(`Invalid file object for key "${key}"`, { field: key, value: fileObj });
        }
      }
      /**
       * Append a file path to FormData
       * @param {FormData} form - FormData instance
       * @param {string} key - Field key
       * @param {string} filePath - Path to file
       */
      appendFilePath(form, key, filePath) {
        try {
          const stats = (0, import_fs2.statSync)(filePath);
          if (!stats.isFile()) {
            throw new ValidationError(`Path is not a file: ${filePath}`, { field: key, value: filePath });
          }
          if (stats.size > this.maxFileSize) {
            throw new ValidationError(`File too large: ${filePath} (${stats.size} bytes, max: ${this.maxFileSize})`, {
              field: key,
              value: filePath
            });
          }
          const stream = (0, import_fs2.createReadStream)(filePath);
          const filename = (0, import_path.basename)(filePath);
          form.append(key, stream, {
            filename,
            contentType: this.getMimeType(filePath)
          });
        } catch (error) {
          if (error instanceof ValidationError) {
            throw error;
          }
          throw new ValidationError(`Failed to read file: ${filePath}`, { field: key, value: filePath });
        }
      }
      /**
       * Check if a value is a file object
       * @param {any} value - Value to check
       * @returns {boolean} True if file object
       */
      isFileObject(value) {
        if (!value || typeof value !== "object") return false;
        return value.stream || value.buffer || value.data || value.filename && (value.content || value.data);
      }
      /**
       * Check if a string is a file path
       * @param {string} value - Value to check
       * @returns {boolean} True if file path
       */
      isFilePath(value) {
        if (typeof value !== "string") return false;
        return (value.includes("/") || value.includes("\\")) && !value.includes("\n");
      }
      /**
       * Get MIME type for a file path
       * @param {string} filePath - File path
       * @returns {string} MIME type
       */
      getMimeType(filePath) {
        const ext = filePath.toLowerCase().split(".").pop();
        const mimeTypes = {
          "txt": "text/plain",
          "html": "text/html",
          "css": "text/css",
          "js": "application/javascript",
          "json": "application/json",
          "xml": "application/xml",
          "pdf": "application/pdf",
          "jpg": "image/jpeg",
          "jpeg": "image/jpeg",
          "png": "image/png",
          "gif": "image/gif",
          "svg": "image/svg+xml",
          "mp4": "video/mp4",
          "mp3": "audio/mpeg",
          "wav": "audio/wav",
          "zip": "application/zip",
          "tar": "application/x-tar",
          "gz": "application/gzip"
        };
        return mimeTypes[ext] || "application/octet-stream";
      }
      /**
       * Convert FormData to headers and body for fetch
       * @param {FormData} form - FormData instance
       * @returns {Promise<Object>} Headers and body
       */
      async getFormRequestData(form) {
        return new Promise((resolve, reject) => {
          const headers = form.getHeaders();
          form.getLength((err, length) => {
            if (err) {
              reject(err);
              return;
            }
            if (length) {
              headers["Content-Length"] = length;
            }
            resolve({
              headers,
              body: form
            });
          });
        });
      }
      /**
       * Validate form data before sending
       * @param {FormData} form - FormData to validate
       * @param {Object} options - Validation options
       * @returns {Promise<boolean>} True if valid
       */
      async validateFormData(form, options = {}) {
        const maxSize = options.maxSize || this.maxFileSize;
        return new Promise((resolve, reject) => {
          form.getLength((err, length) => {
            if (err) {
              reject(new ValidationError("Failed to calculate form data length", { value: form }));
              return;
            }
            if (length > maxSize) {
              reject(new ValidationError(`Form data too large: ${length} bytes (max: ${maxSize})`, {
                value: length,
                limit: maxSize
              }));
              return;
            }
            resolve(true);
          });
        });
      }
      /**
       * Create multipart form data from mixed content
       * @param {Object} data - Data object with mixed content types
       * @param {Object} options - Options
       * @returns {FormData} FormData instance
       */
      createMixedFormData(data, options = {}) {
        const form = new import_form_data.default();
        const files = {};
        const regularData = {};
        Object.entries(data).forEach(([key, value]) => {
          if (this.isFileObject(value) || typeof value === "string" && this.isFilePath(value)) {
            files[key] = value;
          } else {
            regularData[key] = value;
          }
        });
        if (options.jsonData && Object.keys(regularData).length > 0) {
          form.append("data", JSON.stringify(regularData), {
            contentType: "application/json"
          });
        } else {
          Object.entries(regularData).forEach(([key, value]) => {
            this.appendToForm(form, key, value);
          });
        }
        Object.entries(files).forEach(([key, value]) => {
          this.appendToForm(form, key, value);
        });
        return form;
      }
      /**
       * Get statistics about form data
       * @param {FormData} form - FormData instance
       * @returns {Promise<Object>} Statistics
       */
      async getFormStats(form) {
        return new Promise((resolve, reject) => {
          form.getLength((err, length) => {
            if (err) {
              reject(err);
              return;
            }
            resolve({
              contentLength: length,
              boundary: form.getBoundary(),
              headers: form.getHeaders()
            });
          });
        });
      }
    };
    form_data_handler_default = FormDataHandler;
  }
});

// lib/http-client.js
var import_https, import_http, import_url, import_querystring, HttpClient, http_client_default;
var init_http_client = __esm({
  "lib/http-client.js"() {
    "use strict";
    import_https = require("https");
    import_http = require("http");
    import_url = require("url");
    import_querystring = __toESM(require("querystring"), 1);
    init_errors();
    init_retry_strategy();
    init_cookie_jar();
    init_form_data_handler();
    HttpClient = class {
      constructor(options = {}) {
        this.options = {
          timeout: options.timeout || 6e4,
          keepAlive: options.keepAlive !== false,
          maxSockets: options.maxSockets || 256,
          maxFreeSockets: options.maxFreeSockets || 256,
          freeSocketTimeout: options.freeSocketTimeout || 3e4,
          ...options
        };
        this.httpsAgent = new import_https.Agent({
          keepAlive: this.options.keepAlive,
          maxSockets: this.options.maxSockets,
          maxFreeSockets: this.options.maxFreeSockets,
          timeout: this.options.freeSocketTimeout,
          rejectUnauthorized: this.options.rejectUnauthorized !== false
        });
        this.httpAgent = new import_http.Agent({
          keepAlive: this.options.keepAlive,
          maxSockets: this.options.maxSockets,
          maxFreeSockets: this.options.maxFreeSockets,
          timeout: this.options.freeSocketTimeout
        });
        this.retryStrategy = new retry_strategy_default(options.retry || {});
        this.cookieJar = new cookie_jar_default(options.cookies || {});
        this.formDataHandler = new form_data_handler_default(options.formData || {});
        this.supportedMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
      }
      /**
       * Make an HTTP request with all features
       * @param {Object} config - Request configuration
       * @returns {Promise<Object>} Response object
       */
      async request(config) {
        const {
          url,
          method = "GET",
          data,
          headers = {},
          searchParams,
          bodyParams,
          timeout = this.options.timeout,
          responseHeaders = false,
          transform,
          clone = false,
          dryRun = false,
          verbose = false
        } = config;
        if (!this.supportedMethods.includes(method.toUpperCase())) {
          throw new AkFetchError(`Unsupported HTTP method: ${method}`, {
            method,
            url,
            code: "UNSUPPORTED_METHOD"
          });
        }
        const context = {
          url,
          method: method.toUpperCase(),
          verbose,
          config
        };
        return await this.retryStrategy.execute(async (ctx, attempt) => {
          return await this.executeRequest({
            ...config,
            method: method.toUpperCase(),
            attempt
          });
        }, context);
      }
      /**
       * Execute a single HTTP request
       * @param {Object} config - Request configuration
       * @returns {Promise<Object>} Response object
       */
      async executeRequest(config) {
        const {
          url,
          method,
          data,
          headers = {},
          searchParams,
          bodyParams,
          timeout,
          responseHeaders = false,
          transform,
          clone = false,
          dryRun = false,
          verbose = false,
          attempt = 0
        } = config;
        let requestUrl = new import_url.URL(url);
        if (searchParams) {
          Object.entries(searchParams).forEach(([key, value]) => {
            requestUrl.searchParams.set(key, value);
          });
        }
        let requestHeaders = { ...headers };
        if (!requestHeaders["User-Agent"]) {
          requestHeaders["User-Agent"] = "ak-fetch/1.0";
        }
        requestHeaders = await this.cookieJar.addCookiesToHeaders(requestHeaders, requestUrl.toString());
        let requestBody = null;
        let processedData = data;
        if (data && ["POST", "PUT", "PATCH"].includes(method)) {
          if (clone) {
            processedData = JSON.parse(JSON.stringify(data));
          }
          if (transform && typeof transform === "function") {
            if (Array.isArray(processedData)) {
              processedData = processedData.map(transform);
            } else {
              processedData = transform(processedData);
            }
          }
          if (requestHeaders["Content-Type"] === "application/x-www-form-urlencoded") {
            let payload = processedData;
            if (bodyParams) {
              if (bodyParams.dataKey) {
                payload = { [bodyParams.dataKey]: JSON.stringify(processedData), ...bodyParams };
                delete payload.dataKey;
              } else {
                payload = { ...bodyParams, ...processedData };
              }
            }
            requestBody = import_querystring.default.stringify(payload);
          } else if (requestHeaders["Content-Type"] && requestHeaders["Content-Type"].startsWith("multipart/form-data")) {
            const formData = this.formDataHandler.createFormData(processedData);
            const formRequestData = await this.formDataHandler.getFormRequestData(formData);
            requestHeaders = { ...requestHeaders, ...formRequestData.headers };
            requestBody = formRequestData.body;
          } else {
            if (!requestHeaders["Content-Type"]) {
              requestHeaders["Content-Type"] = "application/json";
            }
            if (bodyParams) {
              const payload = { [bodyParams.dataKey || "data"]: processedData, ...bodyParams };
              if (bodyParams.dataKey) delete payload.dataKey;
              requestBody = JSON.stringify(payload);
            } else {
              requestBody = JSON.stringify(processedData);
            }
          }
        }
        if (dryRun) {
          if (dryRun === "curl") {
            return this.generateCurlCommand(requestUrl, method, requestHeaders, requestBody);
          }
          return {
            url: requestUrl.toString(),
            method,
            headers: requestHeaders,
            body: requestBody
          };
        }
        const agent = requestUrl.protocol === "https:" ? this.httpsAgent : this.httpAgent;
        const fetchOptions = {
          method,
          headers: requestHeaders,
          body: requestBody,
          agent,
          timeout,
          redirect: "follow",
          compress: true
        };
        if (["GET", "HEAD", "OPTIONS"].includes(method)) {
          delete fetchOptions.body;
        }
        try {
          const response = await this.fetchWithTimeout(requestUrl, fetchOptions, timeout);
          await this.cookieJar.processResponseHeaders(
            Object.fromEntries(response.headers.entries()),
            requestUrl.toString()
          );
          if (response.status === 429) {
            throw this.retryStrategy.createRateLimitError(
              Object.fromEntries(response.headers.entries()),
              response.status
            );
          }
          if (!response.ok) {
            const errorBody = await this.getResponseBody(response);
            throw new AkFetchError(`HTTP ${response.status}: ${response.statusText}`, {
              statusCode: response.status,
              url: requestUrl.toString(),
              method,
              body: errorBody,
              headers: Object.fromEntries(response.headers.entries())
            });
          }
          const responseBody = await this.getResponseBody(response);
          const result = {
            data: responseBody,
            status: response.status,
            statusText: response.statusText,
            url: requestUrl.toString(),
            method
          };
          if (responseHeaders) {
            result.headers = Object.fromEntries(response.headers.entries());
          }
          return result;
        } catch (error) {
          if (error instanceof AkFetchError) {
            throw error;
          }
          if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
            throw new NetworkError(`Network error: ${error.message}`, {
              code: error.code,
              url: requestUrl.toString(),
              method
            });
          }
          if (error.name === "AbortError" || error.code === "ETIMEDOUT") {
            throw new TimeoutError(`Request timeout after ${timeout}ms`, {
              timeout,
              url: requestUrl.toString(),
              method
            });
          }
          if (error.code && error.code.startsWith("UNABLE_TO_VERIFY_LEAF_SIGNATURE")) {
            throw new SSLError(`SSL verification failed: ${error.message}`, {
              code: error.code,
              url: requestUrl.toString(),
              method
            });
          }
          throw new AkFetchError(`Request failed: ${error.message}`, {
            code: error.code,
            url: requestUrl.toString(),
            method,
            originalError: error
          });
        }
      }
      /**
       * Fetch with timeout support
       * @param {URL} url - Request URL
       * @param {Object} options - Fetch options
       * @param {number} timeout - Timeout in milliseconds
       * @returns {Promise<Response>} Fetch response
       */
      async fetchWithTimeout(url, options, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          return response;
        } finally {
          clearTimeout(timeoutId);
        }
      }
      /**
       * Get response body with proper parsing
       * @param {Response} response - Fetch response
       * @returns {Promise<any>} Parsed response body
       */
      async getResponseBody(response) {
        const contentType = response.headers.get("content-type");
        if (!contentType) {
          return await response.text();
        }
        if (contentType.includes("application/json")) {
          try {
            return await response.json();
          } catch (error) {
            return await response.text();
          }
        }
        if (contentType.includes("text/")) {
          return await response.text();
        }
        return await response.arrayBuffer();
      }
      /**
       * Generate curl command for dry run
       * @param {URL} url - Request URL
       * @param {string} method - HTTP method
       * @param {Object} headers - Request headers
       * @param {string} body - Request body
       * @returns {string} Curl command
       */
      generateCurlCommand(url, method, headers, body) {
        let curlCommand = `curl -X ${method} "${url}"`;
        Object.entries(headers).forEach(([key, value]) => {
          curlCommand += ` \\
  -H "${key}: ${value}"`;
        });
        if (body) {
          curlCommand += ` \\
  -d '${body}'`;
        }
        return curlCommand;
      }
      /**
       * Get HTTP client statistics
       * @returns {Object} Statistics
       */
      getStats() {
        return {
          httpsAgent: {
            maxSockets: this.httpsAgent.maxSockets,
            maxFreeSockets: this.httpsAgent.maxFreeSockets,
            sockets: Object.keys(this.httpsAgent.sockets).length,
            freeSockets: Object.keys(this.httpsAgent.freeSockets).length
          },
          httpAgent: {
            maxSockets: this.httpAgent.maxSockets,
            maxFreeSockets: this.httpAgent.maxFreeSockets,
            sockets: Object.keys(this.httpAgent.sockets).length,
            freeSockets: Object.keys(this.httpAgent.freeSockets).length
          },
          retryStrategy: this.retryStrategy.getStats(),
          cookieJar: this.cookieJar.getStats()
        };
      }
      /**
       * Close HTTP client and clean up resources
       */
      destroy() {
        this.httpsAgent.destroy();
        this.httpAgent.destroy();
      }
    };
    http_client_default = HttpClient;
  }
});

// lib/circular-buffer.js
var CircularBuffer, circular_buffer_default;
var init_circular_buffer = __esm({
  "lib/circular-buffer.js"() {
    "use strict";
    CircularBuffer = class {
      /**
       * Create a new circular buffer
       * 
       * @param {number} [maxSize=1000] - Maximum number of items to store
       * @description Buffer will start overwriting oldest items when this size is reached
       * 
       * @example
       * const buffer = new CircularBuffer(100);
       * // Buffer can hold up to 100 items
       * 
       * @example
       * const responseBuffer = new CircularBuffer(500);
       * // Dedicated buffer for storing HTTP responses
       * 
       * @since 2.0.0
       */
      constructor(maxSize = 1e3) {
        this.maxSize = maxSize;
        this.buffer = new Array(maxSize);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
        this.isFull = false;
      }
      /**
       * Add an item to the buffer
       * 
       * @description
       * Adds an item to the buffer. If the buffer is full, overwrites the oldest
       * item. Maintains circular behavior with O(1) insertion time.
       * 
       * @param {any} item - Item to add to the buffer
       * @description Can be any type of data (objects, primitives, etc.)
       * 
       * @example
       * buffer.push({ id: 1, data: 'test' });
       * buffer.push('string value');
       * buffer.push([1, 2, 3]);
       * 
       * @since 2.0.0
       */
      push(item) {
        this.buffer[this.head] = item;
        if (this.isFull) {
          this.tail = (this.tail + 1) % this.maxSize;
        }
        this.head = (this.head + 1) % this.maxSize;
        if (this.head === this.tail) {
          this.isFull = true;
        }
        if (this.size < this.maxSize) {
          this.size++;
        }
      }
      /**
       * Get all items from the buffer in insertion order
       * 
       * @description
       * Returns all items currently in the buffer in the order they were inserted.
       * For full buffers, starts with the oldest item and ends with the newest.
       * 
       * @returns {Array<unknown>} All items in the buffer
       * @description Array ordered from oldest to newest item
       * 
       * @example
       * buffer.push('first');
       * buffer.push('second');
       * buffer.push('third');
       * console.log(buffer.toArray()); // ['first', 'second', 'third']
       * 
       * @example
       * // When buffer wraps around
       * const smallBuffer = new CircularBuffer(2);
       * smallBuffer.push('old');
       * smallBuffer.push('newer');
       * smallBuffer.push('newest'); // overwrites 'old'
       * console.log(smallBuffer.toArray()); // ['newer', 'newest']
       * 
       * @since 2.0.0
       */
      toArray() {
        if (this.size === 0) return [];
        const result = [];
        if (this.isFull) {
          for (let i = 0; i < this.maxSize; i++) {
            const index = (this.tail + i) % this.maxSize;
            result.push(this.buffer[index]);
          }
        } else {
          for (let i = 0; i < this.head; i++) {
            result.push(this.buffer[i]);
          }
        }
        return result;
      }
      /**
       * Get the current number of items in the buffer
       * 
       * @description
       * Returns the actual number of items currently stored in the buffer.
       * Will be less than or equal to maxSize.
       * 
       * @returns {number} Current number of items
       * @description Range: 0 to maxSize
       * 
       * @example
       * const buffer = new CircularBuffer(10);
       * console.log(buffer.getSize()); // 0
       * buffer.push('item1');
       * console.log(buffer.getSize()); // 1
       * 
       * @since 2.0.0
       */
      getSize() {
        return this.size;
      }
      /**
       * Check if buffer has reached maximum capacity
       * 
       * @description
       * Returns true when the buffer contains maxSize items. Once full,
       * new items will overwrite the oldest items.
       * 
       * @returns {boolean} True if buffer is at maximum capacity
       * @description False if buffer can still accept items without overwriting
       * 
       * @example
       * const buffer = new CircularBuffer(3);
       * console.log(buffer.isBufferFull()); // false
       * buffer.push('a');
       * buffer.push('b');
       * buffer.push('c');
       * console.log(buffer.isBufferFull()); // true
       * 
       * @since 2.0.0
       */
      isBufferFull() {
        return this.isFull;
      }
      /**
       * Clear all items from the buffer
       * 
       * @description
       * Removes all items from the buffer and resets it to initial state.
       * Helps with garbage collection by clearing object references.
       * 
       * @example
       * buffer.push('item1');
       * buffer.push('item2');
       * console.log(buffer.getSize()); // 2
       * buffer.clear();
       * console.log(buffer.getSize()); // 0
       * 
       * @since 2.0.0
       */
      clear() {
        this.head = 0;
        this.tail = 0;
        this.size = 0;
        this.isFull = false;
        this.buffer.fill(null);
      }
      /**
       * Get memory usage and buffer statistics
       * 
       * @description
       * Returns detailed information about buffer capacity, usage, and efficiency.
       * Useful for monitoring and debugging memory usage patterns.
       * 
       * @returns {Object} Buffer statistics object
       * @property {number} maxSize - Maximum buffer capacity
       * @property {number} currentSize - Current number of items
       * @property {boolean} isFull - Whether buffer is at capacity
       * @property {number} memoryUtilization - Percentage of capacity used (0-100)
       * 
       * @example
       * const stats = buffer.getMemoryStats();
       * console.log(`Buffer: ${stats.currentSize}/${stats.maxSize} (${stats.memoryUtilization}%)`);
       * if (stats.isFull) {
       *   console.log('Buffer is full, oldest items will be overwritten');
       * }
       * 
       * @since 2.0.0
       */
      getMemoryStats() {
        return {
          maxSize: this.maxSize,
          currentSize: this.size,
          isFull: this.isFull,
          memoryUtilization: this.size / this.maxSize * 100
        };
      }
      /**
       * Resize the buffer capacity
       * 
       * @description
       * Changes the buffer capacity and preserves existing items up to the new limit.
       * Creates a new internal buffer and migrates data. If shrinking, keeps the
       * most recent items.
       * 
       * @param {number} newSize - New maximum buffer size
       * @description Must be a positive integer
       * 
       * @throws {Error} When newSize is not positive
       * 
       * @example
       * const buffer = new CircularBuffer(5);
       * // Add some items...
       * buffer.resize(10); // Increase capacity to 10
       * 
       * @example
       * // Shrinking buffer preserves most recent items
       * const buffer = new CircularBuffer(10);
       * // Fill with 10 items...
       * buffer.resize(5); // Keeps 5 most recent items
       * 
       * @since 2.0.0
       */
      resize(newSize) {
        if (newSize <= 0) {
          throw new Error("Buffer size must be positive");
        }
        const currentItems = this.toArray();
        this.maxSize = newSize;
        this.buffer = new Array(newSize);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
        this.isFull = false;
        const itemsToAdd = Math.min(currentItems.length, newSize);
        for (let i = 0; i < itemsToAdd; i++) {
          this.push(currentItems[i]);
        }
      }
      /**
       * Get the most recent N items from the buffer
       * 
       * @description
       * Returns the N most recently added items. If N exceeds buffer size,
       * returns all available items.
       * 
       * @param {number} n - Number of recent items to retrieve
       * @description Must be a non-negative integer
       * 
       * @returns {Array<unknown>} Array of the N most recent items
       * @description Ordered from oldest to newest within the selection
       * 
       * @example
       * buffer.push('a');
       * buffer.push('b');
       * buffer.push('c');
       * buffer.push('d');
       * console.log(buffer.getLast(2)); // ['c', 'd']
       * 
       * @example
       * // Requesting more items than available
       * console.log(buffer.getLast(10)); // Returns all 4 items: ['a', 'b', 'c', 'd']
       * 
       * @since 2.0.0
       */
      getLast(n) {
        const allItems = this.toArray();
        return allItems.slice(-n);
      }
      /**
       * Get the oldest N items from the buffer
       * 
       * @description
       * Returns the N oldest items currently in the buffer. If N exceeds buffer size,
       * returns all available items.
       * 
       * @param {number} n - Number of oldest items to retrieve
       * @description Must be a non-negative integer
       * 
       * @returns {Array<unknown>} Array of the N oldest items
       * @description Ordered from oldest to newest within the selection
       * 
       * @example
       * buffer.push('a');
       * buffer.push('b');
       * buffer.push('c');
       * buffer.push('d');
       * console.log(buffer.getFirst(2)); // ['a', 'b']
       * 
       * @example
       * // After buffer wraps around
       * const smallBuffer = new CircularBuffer(3);
       * smallBuffer.push('old1');
       * smallBuffer.push('old2');
       * smallBuffer.push('old3');
       * smallBuffer.push('new1'); // overwrites 'old1'
       * console.log(smallBuffer.getFirst(2)); // ['old2', 'old3']
       * 
       * @since 2.0.0
       */
      getFirst(n) {
        const allItems = this.toArray();
        return allItems.slice(0, n);
      }
    };
    circular_buffer_default = CircularBuffer;
  }
});

// lib/stream-processors.js
var import_stream, import_fs3, import_promises, StreamProcessors, stream_processors_default;
var init_stream_processors = __esm({
  "lib/stream-processors.js"() {
    "use strict";
    import_stream = require("stream");
    import_fs3 = require("fs");
    import_promises = require("stream/promises");
    init_errors();
    StreamProcessors = class {
      constructor(options = {}) {
        this.highWaterMark = options.highWaterMark || 16384;
        this.maxMemoryUsage = options.maxMemoryUsage || 1024 * 1024 * 1024;
      }
      /**
       * Transform JSONL to JSON objects
       * @param {Object} options - Transform options
       * @returns {Transform} Transform stream
       */
      createJSONLTransform(options = {}) {
        let buffer = "";
        const highWaterMark = options.highWaterMark || this.highWaterMark;
        return new import_stream.Transform({
          readableObjectMode: true,
          highWaterMark,
          transform(chunk, encoding, callback) {
            buffer += chunk.toString();
            let lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine) {
                try {
                  this.push(JSON.parse(trimmedLine));
                } catch (error) {
                  this.emit("error", new Error(`Invalid JSON line: ${trimmedLine}`));
                  return;
                }
              }
            }
            callback();
          },
          flush(callback) {
            if (buffer.trim()) {
              try {
                this.push(JSON.parse(buffer));
              } catch (error) {
                this.emit("error", new Error(`Invalid JSON in buffer: ${buffer}`));
                return;
              }
            }
            callback();
          }
        });
      }
      /**
       * Transform objects to JSONL format
       * @param {Object} options - Transform options
       * @returns {Transform} Transform stream
       */
      createJSONLStringifyTransform(options = {}) {
        return new import_stream.Transform({
          writableObjectMode: true,
          readableObjectMode: false,
          transform(chunk, encoding, callback) {
            try {
              const jsonString = JSON.stringify(chunk) + "\n";
              callback(null, jsonString);
            } catch (error) {
              callback(new Error(`Failed to stringify object: ${error.message}`));
            }
          }
        });
      }
      /**
       * Transform objects to CSV format
       * @param {Object} options - Transform options
       * @returns {Transform} Transform stream
       */
      createCSVTransform(options = {}) {
        let isFirstRow = true;
        let headers = options.headers || null;
        return new import_stream.Transform({
          writableObjectMode: true,
          readableObjectMode: false,
          transform(chunk, encoding, callback) {
            try {
              if (isFirstRow && !headers) {
                headers = Object.keys(chunk);
                const headerRow = headers.join(",") + "\n";
                this.push(headerRow);
              }
              const processedChunk = { ...chunk };
              for (const key in processedChunk) {
                if (typeof processedChunk[key] === "object" && processedChunk[key] !== null) {
                  processedChunk[key] = JSON.stringify(processedChunk[key]);
                }
              }
              const row = headers.map((header) => {
                const value = processedChunk[header] || "";
                const stringValue = String(value).replace(/"/g, '""');
                return `"${stringValue}"`;
              }).join(",") + "\n";
              isFirstRow = false;
              callback(null, row);
            } catch (error) {
              callback(new Error(`Failed to create CSV row: ${error.message}`));
            }
          }
        });
      }
      /**
       * Batch objects into arrays
       * @param {number} batchSize - Size of each batch
       * @param {Object} options - Batch options
       * @returns {Transform} Transform stream
       */
      createBatchTransform(batchSize, options = {}) {
        let batch = [];
        const flushIncomplete = options.flushIncomplete !== false;
        return new import_stream.Transform({
          objectMode: true,
          transform(chunk, encoding, callback) {
            batch.push(chunk);
            if (batch.length >= batchSize) {
              callback(null, batch);
              batch = [];
            } else {
              callback();
            }
          },
          flush(callback) {
            if (batch.length > 0 && flushIncomplete) {
              callback(null, batch);
            } else {
              callback();
            }
          }
        });
      }
      /**
       * Memory monitoring transform
       * @param {Object} options - Memory options
       * @returns {Transform} Transform stream
       */
      createMemoryMonitorTransform(options = {}) {
        const maxMemory = options.maxMemory || this.maxMemoryUsage;
        const checkInterval = options.checkInterval || 100;
        let itemCount = 0;
        return new import_stream.Transform({
          objectMode: true,
          transform(chunk, encoding, callback) {
            itemCount++;
            if (itemCount % checkInterval === 0) {
              const memUsage = process.memoryUsage();
              if (memUsage.heapUsed > maxMemory) {
                callback(new MemoryError(`Memory usage exceeded limit: ${memUsage.heapUsed} > ${maxMemory}`, {
                  memoryUsage: memUsage,
                  limit: maxMemory
                }));
                return;
              }
            }
            callback(null, chunk);
          }
        });
      }
      /**
       * Create a backpressure-aware transform
       * @param {Function} transformFn - Transform function
       * @param {Object} options - Transform options
       * @returns {Transform} Transform stream
       */
      createBackpressureTransform(transformFn, options = {}) {
        const maxBuffer = options.maxBuffer || 100;
        let bufferCount = 0;
        return new import_stream.Transform({
          objectMode: true,
          highWaterMark: maxBuffer,
          transform(chunk, encoding, callback) {
            bufferCount++;
            try {
              const result = transformFn(chunk);
              if (result instanceof Promise) {
                result.then((data) => {
                  bufferCount--;
                  callback(null, data);
                }).catch((error) => {
                  bufferCount--;
                  callback(error);
                });
              } else {
                bufferCount--;
                callback(null, result);
              }
            } catch (error) {
              bufferCount--;
              callback(error);
            }
          }
        });
      }
      /**
       * Create a rate-limited transform
       * @param {number} maxPerSecond - Maximum items per second
       * @param {Object} options - Rate limit options
       * @returns {Transform} Transform stream
       */
      createRateLimitTransform(maxPerSecond, options = {}) {
        const intervalMs = 1e3 / maxPerSecond;
        let lastProcessTime = 0;
        return new import_stream.Transform({
          objectMode: true,
          async transform(chunk, encoding, callback) {
            const now = Date.now();
            const timeSinceLastProcess = now - lastProcessTime;
            if (timeSinceLastProcess < intervalMs) {
              const delay = intervalMs - timeSinceLastProcess;
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
            lastProcessTime = Date.now();
            callback(null, chunk);
          }
        });
      }
      /**
       * Create a stream that writes to multiple outputs
       * @param {Array} outputs - Array of writable streams
       * @param {Object} options - Tee options
       * @returns {Writable} Writable stream
       */
      createTeeStream(outputs, options = {}) {
        return new import_stream.Writable({
          objectMode: options.objectMode || false,
          write(chunk, encoding, callback) {
            let completed = 0;
            const totalOutputs = outputs.length;
            if (totalOutputs === 0) {
              callback();
              return;
            }
            let hasError = false;
            outputs.forEach((output) => {
              output.write(chunk, encoding, (error) => {
                if (error && !hasError) {
                  hasError = true;
                  callback(error);
                  return;
                }
                completed++;
                if (completed === totalOutputs && !hasError) {
                  callback();
                }
              });
            });
          }
        });
      }
      /**
       * Stream data to file with format selection
       * @param {string} filePath - Output file path
       * @param {string} format - Output format (json, csv, ndjson)
       * @param {Object} options - Stream options
       * @returns {Promise<string>} File path when complete
       */
      async streamToFile(dataStream, filePath, format = "json", options = {}) {
        const writeStream = (0, import_fs3.createWriteStream)(filePath, { encoding: "utf8" });
        try {
          switch (format.toLowerCase()) {
            case "json":
              await this.streamJSON(dataStream, writeStream, options);
              break;
            case "csv":
              await this.streamCSV(dataStream, writeStream, options);
              break;
            case "ndjson":
            case "jsonl":
              await this.streamNDJSON(dataStream, writeStream, options);
              break;
            default:
              throw new Error(`Unsupported format: ${format}`);
          }
          return filePath;
        } catch (error) {
          writeStream.destroy();
          throw error;
        }
      }
      /**
       * Stream data as JSON array
       * @param {Readable} dataStream - Input stream
       * @param {Writable} writeStream - Output stream
       * @param {Object} options - Options
       */
      async streamJSON(dataStream, writeStream, options = {}) {
        writeStream.write("[");
        let isFirst = true;
        const transformStream = new import_stream.Transform({
          objectMode: true,
          transform(chunk, encoding, callback) {
            const prefix = isFirst ? "" : ",";
            isFirst = false;
            callback(null, prefix + JSON.stringify(chunk, null, options.indent));
          }
        });
        await (0, import_promises.pipeline)(dataStream, transformStream, writeStream, { end: false });
        writeStream.write("]");
        await new Promise((resolve, reject) => {
          writeStream.end();
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });
      }
      /**
       * Stream data as CSV
       * @param {Readable} dataStream - Input stream
       * @param {Writable} writeStream - Output stream
       * @param {Object} options - Options
       */
      async streamCSV(dataStream, writeStream, options = {}) {
        const csvTransform = this.createCSVTransform(options);
        await (0, import_promises.pipeline)(dataStream, csvTransform, writeStream);
      }
      /**
       * Stream data as NDJSON
       * @param {Readable} dataStream - Input stream
       * @param {Writable} writeStream - Output stream
       * @param {Object} options - Options
       */
      async streamNDJSON(dataStream, writeStream, options = {}) {
        const ndjsonTransform = this.createJSONLStringifyTransform(options);
        await (0, import_promises.pipeline)(dataStream, ndjsonTransform, writeStream);
      }
      /**
       * Get unique keys from a stream of objects
       * @param {Readable} dataStream - Input stream
       * @returns {Promise<Array>} Array of unique keys
       */
      async getUniqueKeys(dataStream) {
        const keysSet = /* @__PURE__ */ new Set();
        const keyExtractor = new import_stream.Writable({
          objectMode: true,
          write(chunk, encoding, callback) {
            if (chunk && typeof chunk === "object") {
              Object.keys(chunk).forEach((key) => keysSet.add(key));
            }
            callback();
          }
        });
        await (0, import_promises.pipeline)(dataStream, keyExtractor);
        return Array.from(keysSet);
      }
    };
    stream_processors_default = StreamProcessors;
  }
});

// lib/presets.js
function truncate(str) {
  return str.length > MAX_STR_LEN ? str.substring(0, MAX_STR_LEN) : str;
}
function mixpanelEventTransform(record) {
  const validOperations = ["$set", "$set_once", "$add", "$union", "$append", "$remove", "$unset"];
  const specialProps = [
    "name",
    "first_name",
    "last_name",
    "email",
    "phone",
    "avatar",
    "created",
    "insert_id",
    "city",
    "region",
    "lib_version",
    "os",
    "os_version",
    "browser",
    "browser_version",
    "app_build_number",
    "app_version_string",
    "device",
    "screen_height",
    "screen_width",
    "screen_dpi",
    "current_url",
    "initial_referrer",
    "initial_referring_domain",
    "referrer",
    "referring_domain",
    "search_engine",
    "manufacturer",
    "brand",
    "model",
    "watch_model",
    "carrier",
    "radio",
    "wifi",
    "bluetooth_enabled",
    "bluetooth_version",
    "has_nfc",
    "has_telephone",
    "google_play_services",
    "duration",
    "country",
    "country_code"
  ];
  const outsideProps = ["distinct_id", "group_id", "token", "group_key", "ip"];
  if (!record.properties) {
    record.properties = { ...record };
    for (const key of Object.keys(record)) {
      if (key !== "properties" && key !== "event") {
        delete record[key];
      }
    }
  }
  if (record.properties.timestamp && !record.properties.time) {
    record.properties.time = record.properties.timestamp;
    delete record.properties.timestamp;
  }
  if (record.properties.time && Number.isNaN(Number(record.properties.time))) {
    record.properties.time = import_dayjs.default.utc(record.properties.time).valueOf();
  }
  if (!record.properties.$insert_id) {
    try {
      const tuple = [
        record.event,
        record.properties.distinct_id || "",
        record.properties.time
      ].join("-");
      record.properties.$insert_id = import_murmurhash.default.v3(tuple).toString();
    } catch {
      record.properties.$insert_id = String(record.properties.distinct_id);
    }
  }
  if (record.properties.user_id && !record.properties.distinct_id) {
    record.properties.distinct_id = record.properties.user_id;
  }
  ["user_id", "device_id", "source"].forEach((orig) => {
    if (record.properties[orig]) {
      record.properties[`$${orig}`] = record.properties[orig];
      delete record.properties[orig];
    }
  });
  for (const key of Object.keys(record.properties)) {
    if (specialProps.includes(key)) {
      if (key === "country") {
        record.properties.mp_country_code = record.properties[key];
      } else {
        record.properties[`$${key}`] = record.properties[key];
      }
      delete record.properties[key];
    }
  }
  ["distinct_id", "$user_id", "$device_id"].forEach((k) => {
    if (record.properties[k] != null) {
      record.properties[k] = String(record.properties[k]);
    }
  });
  for (const [k, v] of Object.entries(record.properties)) {
    if (typeof v === "string") {
      record.properties[k] = truncate(v);
    }
  }
  delete record.properties.event;
  return record;
}
function getAvailablePresets() {
  return Object.keys(PRESET_REGISTRY);
}
function getPresetTransform(presetName) {
  if (!presetName || typeof presetName !== "string") {
    throw new Error("Preset name must be a non-empty string");
  }
  const transform = PRESET_REGISTRY[presetName.toLowerCase()];
  if (!transform) {
    const available = getAvailablePresets().join(", ");
    throw new Error(`Invalid preset '${presetName}'. Available presets: ${available}`);
  }
  return transform;
}
function applyPresetTransform(record, presetName, errorHandler) {
  try {
    const transform = getPresetTransform(presetName);
    return transform(record);
  } catch (error) {
    if (errorHandler && typeof errorHandler === "function") {
      errorHandler(error, record);
      return record;
    }
    throw error;
  }
}
var import_murmurhash, import_dayjs, import_utc, import_json_stable_stringify, MAX_STR_LEN, PRESET_REGISTRY;
var init_presets = __esm({
  "lib/presets.js"() {
    "use strict";
    import_murmurhash = __toESM(require("murmurhash"), 1);
    import_dayjs = __toESM(require("dayjs"), 1);
    import_utc = __toESM(require("dayjs/plugin/utc"), 1);
    import_json_stable_stringify = __toESM(require("json-stable-stringify"), 1);
    import_dayjs.default.extend(import_utc.default);
    MAX_STR_LEN = 255;
    PRESET_REGISTRY = {
      "mixpanel": mixpanelEventTransform
      // Future presets will be added here:
      // 'amplitude': amplitudeTransform,
      // 'pendo': pendoTransform,
    };
  }
});

// index.js
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
async function main(PARAMS) {
  validateInput(PARAMS);
  if (Array.isArray(PARAMS)) {
    return await processMultipleConfigs(PARAMS);
  }
  return await processSingleConfig(PARAMS);
}
function validateInput(PARAMS) {
  if (!PARAMS) {
    throw new ValidationError("No parameters provided");
  }
  if (Array.isArray(PARAMS)) {
    if (PARAMS.length === 0) {
      throw new ValidationError("Empty configuration array provided");
    }
    PARAMS.forEach((config, index) => {
      if (!config.url) {
        throw new ValidationError(`No URL provided for config at index ${index}`);
      }
    });
  } else {
    if (!PARAMS.url) {
      throw new ValidationError("No URL provided");
    }
  }
}
async function processMultipleConfigs(configs) {
  const startTime = Date.now();
  const firstConfig = configs[0];
  const concurrency = firstConfig?.concurrency || 10;
  const delay = firstConfig?.delay || 0;
  const verbose = firstConfig?.verbose !== false;
  const logFile = firstConfig?.logFile;
  const format = firstConfig?.format || "json";
  const hook = firstConfig?.hook;
  const logger = createLogger({
    verbose,
    showThroughput: true,
    logPrefix: "\u{1F30D}"
  });
  logger.start("Processing multiple endpoints", {
    // @ts-ignore
    count: configs.length,
    concurrency,
    delay: delay ? `${delay}ms` : "none"
  });
  const queue = new import_run_queue.default({ maxConcurrency: concurrency });
  const results = [];
  let reqCount = 0;
  let errorCount = 0;
  const totalCount = configs.length;
  for (const config of configs) {
    queue.add(0, async () => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      try {
        reqCount++;
        const result = await processSingleConfig(config, false);
        if (Array.isArray(result)) {
          results.push(...result);
        } else {
          results.push(result);
        }
        logger.progress(reqCount, totalCount);
      } catch (error) {
        errorCount++;
        logger.error(`Config ${reqCount} failed:`, error.message);
        results.push({ error: error.message, config: sanitizeConfig(config) });
        logger.progress(reqCount, totalCount);
      }
    });
  }
  await queue.run();
  const endTime = Date.now();
  const duration = endTime - startTime;
  const finalResults = typeof hook === "function" ? hook(results) : results;
  if (logFile) {
    logger.fileOperation("Writing", logFile, format);
    await writeLogFile(logFile, finalResults, format, verbose);
  }
  const finalStats = {
    responses: finalResults,
    duration,
    clockTime: prettyTime(duration),
    reqCount,
    rowCount: reqCount,
    rps: Math.floor(reqCount / (duration / 1e3)),
    errors: errorCount,
    configCount: totalCount
  };
  logger.complete(finalStats);
  return {
    responses: finalResults,
    duration,
    clockTime: prettyTime(duration),
    reqCount,
    rowCount: totalCount,
    rps: Math.floor(reqCount / (duration / 1e3)),
    errors: errorCount,
    configCount: totalCount
  };
}
async function processSingleConfig(config, isMainJob = true) {
  const startTime = Date.now();
  const processedConfig = setDefaults(config);
  validateConfig(processedConfig);
  const logger = createLogger({
    verbose: processedConfig.verbose,
    showThroughput: true,
    showMemory: processedConfig.verbose && isMainJob
  });
  if (processedConfig.shell) {
    processedConfig.headers = await executeShellCommand(processedConfig.shell, processedConfig.headers);
  }
  if (isMainJob) {
    logger.start("Starting HTTP request job", sanitizeConfig(processedConfig));
  }
  if (processedConfig.dryRun) {
    if (processedConfig.dryRun === "curl") {
      return await handleCurlGeneration(processedConfig, logger, isMainJob);
    } else {
      return await handleDryRun(processedConfig, logger, isMainJob);
    }
  }
  if (processedConfig.noBatch) {
    const result2 = await executeSingleRequest(processedConfig, logger);
    if (isMainJob) {
      logger.complete(result2);
    }
    return result2;
  }
  const stream = await createDataStream(processedConfig);
  const [responses, reqCount, rowCount, errorCount] = await processDataStream(stream, processedConfig, logger);
  const endTime = Date.now();
  const duration = endTime - startTime;
  const rps = Math.floor(reqCount / (duration / 1e3));
  const result = {
    responses,
    duration,
    clockTime: prettyTime(duration),
    reqCount,
    rowCount,
    rps,
    errors: errorCount || 0,
    stats: getMemoryStats()
  };
  if (processedConfig.logFile && isMainJob) {
    logger.fileOperation("Writing", processedConfig.logFile, processedConfig.format);
    if (processedConfig.verbose === void 0) processedConfig.verbose = false;
    await writeLogFile(
      processedConfig.logFile,
      responses,
      processedConfig.format,
      processedConfig.verbose
    );
  }
  if (isMainJob) {
    logger.complete(result);
  }
  return result;
}
function setDefaults(config) {
  const defaults = {
    batchSize: 1,
    concurrency: 10,
    maxTasks: 25,
    delay: 0,
    verbose: false,
    retries: 3,
    retryDelay: 1e3,
    retryOn: [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
    timeout: 6e4,
    keepAlive: true,
    method: "POST",
    debug: false,
    highWaterMark: 16384,
    storeResponses: true,
    responseHeaders: false,
    forceGC: false,
    clone: false,
    noBatch: false,
    format: (
      /** @type {"json"|"csv"|"ndjson"} */
      "json"
    ),
    enableCookies: false,
    maxResponseBuffer: 1e3,
    useStaticRetryDelay: false,
    enableConnectionPooling: true,
    dryRun: false,
    headers: {},
    searchParams: null,
    bodyParams: null,
    transform: null,
    shell: null,
    ...config
  };
  if (defaults.retries === null && !config.hasOwnProperty("storeResponses")) {
    defaults.storeResponses = false;
  }
  return defaults;
}
function validateConfig(config) {
  if (!config.url) {
    throw new ConfigurationError("URL is required");
  }
  const method = config.method || "POST";
  const batchSize = config.batchSize ?? 1;
  const concurrency = config.concurrency ?? 10;
  const timeout = config.timeout ?? 6e4;
  if (!config.data && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    throw new ConfigurationError(`${method} request requires data`);
  }
  if (batchSize < 0) {
    throw new ConfigurationError("batchSize must be non-negative");
  }
  if (concurrency < 1) {
    throw new ConfigurationError("concurrency must be at least 1");
  }
  if (timeout < 1e3) {
    throw new ConfigurationError("timeout must be at least 1000ms");
  }
  if (config.transform !== null && config.transform !== void 0 && typeof config.transform !== "function") {
    throw new ConfigurationError("transform must be a function or null");
  }
}
async function executeShellCommand(shellConfig, headers = {}) {
  try {
    const commandOutput = (0, import_child_process.execSync)(shellConfig.command, { encoding: "utf8" }).trim();
    const headerName = shellConfig.header || "Authorization";
    const prefix = shellConfig.prefix || "Bearer";
    return {
      ...headers,
      [headerName]: `${prefix} ${commandOutput}`
    };
  } catch (error) {
    throw new ConfigurationError(`Shell command failed: ${error.message}`);
  }
}
async function executeSingleRequest(config, logger) {
  const httpClientConfig = {
    timeout: config.timeout ?? 6e4,
    enableConnectionPooling: config.enableConnectionPooling ?? true,
    keepAlive: config.keepAlive ?? true,
    concurrency: config.concurrency ?? 10,
    retries: config.retries ?? 3,
    retryDelay: config.retryDelay ?? 1e3,
    retryOn: config.retryOn ?? [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
    retryHandler: config.retryHandler || void 0,
    useStaticRetryDelay: config.useStaticRetryDelay ?? false,
    enableCookies: config.enableCookies ?? false,
    maxFileSize: config.maxFileSize ?? void 0,
    // Include required properties for BatchRequestConfig compatibility
    url: config.url,
    data: config.data,
    method: config.method ?? "POST",
    headers: config.headers ?? {}
  };
  const httpClient = createHttpClient(httpClientConfig);
  try {
    if (logger && logger.isVerbose()) {
      logger.info("Executing single request (no batching)");
    }
    const response = await httpClient.request(config);
    const endTime = Date.now();
    const startTime = endTime;
    const duration = endTime - startTime;
    const result = {
      responses: [response],
      duration,
      clockTime: prettyTime(duration),
      reqCount: 1,
      rowCount: Array.isArray(config.data) ? config.data.length : 1,
      rps: 0,
      errors: 0,
      stats: getMemoryStats()
    };
    return result;
  } finally {
    httpClient.destroy();
  }
}
async function createDataStream(config) {
  const { data, highWaterMark } = config;
  const streamProcessors = new stream_processors_default({ highWaterMark });
  if (data instanceof import_stream2.Readable) {
    return data.readableObjectMode ? data : data.pipe(streamProcessors.createJSONLTransform());
  }
  if (typeof data === "string") {
    if ((0, import_fs4.existsSync)(import_path2.default.resolve(data))) {
      const filePath = import_path2.default.resolve(data);
      const fileExt = import_path2.default.extname(filePath).toLowerCase();
      if (fileExt === ".json") {
        const fileContent = require("fs").readFileSync(filePath, "utf8");
        const jsonData = JSON.parse(fileContent);
        return import_stream2.Readable.from(Array.isArray(jsonData) ? jsonData : [jsonData]);
      } else {
        return (0, import_fs4.createReadStream)(filePath, { highWaterMark }).pipe(streamProcessors.createJSONLTransform());
      }
    } else if ((0, import_ak_tools3.isJSONStr)(data)) {
      const parsed = JSON.parse(data);
      return import_stream2.Readable.from(Array.isArray(parsed) ? parsed : [parsed]);
    } else if (data.split("\n").every((line) => line.trim() === "" || (0, import_ak_tools3.isJSONStr)(line))) {
      return import_stream2.Readable.from(data.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line)));
    } else {
      throw new ValidationError("Invalid data format");
    }
  }
  if (Array.isArray(data)) {
    return import_stream2.Readable.from(data);
  }
  if (typeof data === "object" && data !== null) {
    return import_stream2.Readable.from([data]);
  }
  const method = config.method || "POST";
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    return import_stream2.Readable.from([null]);
  }
  throw new ValidationError("No valid data source provided");
}
async function processDataStream(stream, config, logger) {
  const {
    batchSize = 1,
    concurrency = 10,
    maxTasks = 25,
    delay = 0,
    maxResponseBuffer = 1e3,
    maxMemoryUsage,
    storeResponses = true,
    forceGC = false
  } = config;
  let queue = new import_run_queue.default({ maxConcurrency: concurrency });
  const responseBuffer = storeResponses ? new circular_buffer_default(maxResponseBuffer) : null;
  const streamProcessors = new stream_processors_default({ maxMemoryUsage });
  const httpClientConfig = {
    timeout: config.timeout ?? 6e4,
    enableConnectionPooling: config.enableConnectionPooling ?? true,
    keepAlive: config.keepAlive ?? true,
    concurrency: config.concurrency ?? 10,
    retries: config.retries ?? 3,
    retryDelay: config.retryDelay ?? 1e3,
    retryOn: config.retryOn ?? [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
    retryHandler: config.retryHandler || void 0,
    useStaticRetryDelay: config.useStaticRetryDelay ?? false,
    enableCookies: config.enableCookies ?? false,
    maxFileSize: config.maxFileSize ?? void 0,
    // Required properties for BatchRequestConfig compatibility
    url: config.url,
    data: config.data,
    method: config.method ?? "POST",
    headers: config.headers ?? {}
  };
  const httpClient = createHttpClient(httpClientConfig);
  let reqCount = 0;
  let rowCount = 0;
  let errorCount = 0;
  let batch = [];
  let isStreamPaused = false;
  if (maxMemoryUsage) {
    stream = stream.pipe(streamProcessors.createMemoryMonitorTransform());
  }
  stream.on("error", (error) => {
    logger.error("Stream error:", error.message);
  });
  stream.on("end", () => {
    if (logger.isVerbose()) {
      logger.info(`Stream ended: processed ${(0, import_ak_tools3.comma)(rowCount)} records, ${(0, import_ak_tools3.comma)(reqCount)} requests`);
    }
  });
  for await (const data of stream) {
    if (data !== null) {
      let processedData = data;
      if (config.clone) {
        processedData = typeof data === "object" && data !== null ? JSON.parse(JSON.stringify(data)) : data;
      }
      if (config.preset) {
        try {
          processedData = applyPresetTransform(processedData, config.preset, config.errorHandler);
        } catch (error) {
          logger.error(`Preset transform error (${config.preset}): ${error.message}`);
          if (config.errorHandler && typeof config.errorHandler === "function") {
            config.errorHandler(error, processedData);
          } else {
            throw error;
          }
        }
      }
      if (typeof config.transform === "function") {
        try {
          const transformed = config.transform(processedData);
          if (transformed !== void 0) {
            processedData = transformed;
            if (!config.clone && typeof data === "object" && data !== null && !Array.isArray(data) && typeof transformed === "object" && !Array.isArray(transformed)) {
              Object.assign(data, transformed);
            }
          }
        } catch (error) {
          logger.error(`Transform error: ${error.message}`);
          if (config.errorHandler && typeof config.errorHandler === "function") {
            config.errorHandler(error, processedData);
          } else {
            throw error;
          }
        }
      }
      batch.push(processedData);
      rowCount++;
    }
    if (batch.length >= batchSize || data === null && batch.length > 0) {
      addBatchToQueue(batch);
      batch = [];
    }
    if (queue.queued >= maxTasks && !isStreamPaused) {
      stream.pause();
      isStreamPaused = true;
      await queue.run();
      queue = new import_run_queue.default({ maxConcurrency: concurrency });
      stream.resume();
      isStreamPaused = false;
    }
  }
  if (batch.length > 0) {
    addBatchToQueue(batch);
  }
  if (queue.queued > 0) {
    await queue.run();
  }
  cleanup();
  httpClient.destroy();
  const responses = responseBuffer ? responseBuffer.toArray() : [];
  if (forceGC && global.gc) {
    global.gc();
  }
  return [responses, reqCount, rowCount, errorCount];
  function addBatchToQueue(currentBatch) {
    const batchData = currentBatch.slice();
    queue.add(0, async () => {
      try {
        const requestConfig = {
          ...config,
          data: batchData.length === 1 ? batchData[0] : batchData
        };
        const response = await httpClient.request(requestConfig);
        if (responseBuffer) {
          responseBuffer.push(response);
        }
        reqCount++;
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        logger.progress(reqCount, Math.ceil(rowCount / (batchSize || 1)), rowCount);
        if (config.responseHandler && typeof config.responseHandler === "function") {
          config.responseHandler(response);
        }
      } catch (error) {
        errorCount++;
        logger.error("Batch processing failed:", error.message);
        if (config.errorHandler && typeof config.errorHandler === "function") {
          config.errorHandler(error);
        } else {
          if (responseBuffer) {
            const errorDetails = {
              error: error.message,
              batch: batchData
            };
            if (error.statusCode) errorDetails.statusCode = error.statusCode;
            if (error.body) errorDetails.body = error.body;
            if (error.url) errorDetails.url = error.url;
            if (error.method) errorDetails.method = error.method;
            if (error.timestamp) errorDetails.timestamp = error.timestamp;
            responseBuffer.push(errorDetails);
          }
        }
      }
    });
  }
  function cleanup() {
    if (stream && typeof stream.destroy === "function") {
      stream.removeAllListeners();
      stream.destroy();
    }
  }
}
function createHttpClient(config) {
  const concurrency = config.concurrency ?? 10;
  const clientOptions = {
    timeout: config.timeout,
    keepAlive: config.enableConnectionPooling ? config.keepAlive : false,
    maxSockets: concurrency * 2,
    maxFreeSockets: concurrency,
    retry: {
      maxRetries: config.retries,
      baseDelay: config.retryDelay,
      retryOn: config.retryOn,
      retryHandler: config.retryHandler,
      useStaticDelay: config.useStaticRetryDelay,
      staticRetryDelay: config.retryDelay
    },
    cookies: {
      enabled: config.enableCookies
    },
    formData: {
      maxFileSize: config.maxFileSize
    }
  };
  return new http_client_default(clientOptions);
}
async function writeLogFile(filePath, data, format, verbose) {
  try {
    await (0, import_ak_tools3.makeExist)(filePath);
    const streamProcessors = new stream_processors_default();
    const dataStream = import_stream2.Readable.from(Array.isArray(data) ? data : [data]);
    await streamProcessors.streamToFile(dataStream, filePath, format);
    if (verbose) {
      const logger = createLogger({ verbose });
      logger.success(`Log written to ${filePath}`);
    }
  } catch (error) {
    const logger = createLogger({ verbose: true });
    logger.error(`Failed to write log file: ${error.message}`);
  }
}
function sanitizeConfig(config) {
  const sanitized = { ...config };
  delete sanitized.data;
  if (sanitized.headers) {
    const sensitiveHeaders = ["authorization", "cookie", "x-api-key"];
    sanitized.headers = { ...sanitized.headers };
    Object.keys(sanitized.headers).forEach((key) => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized.headers[key] = "[REDACTED]";
      }
    });
  }
  return sanitized;
}
function getMemoryStats() {
  const memUsage = process.memoryUsage();
  return {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
    // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
    // MB
    external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
    // MB
    rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100
    // MB
  };
}
async function handleCurlGeneration(config, logger, isMainJob) {
  const startTime = Date.now();
  if (logger.isVerbose()) {
    logger.info("Generating curl commands - no actual requests will be made");
  }
  const stream = await createDataStream(config);
  let rowCount = 0;
  const curlCommands = [];
  for await (const data of stream) {
    if (data !== null) {
      rowCount++;
      let processedData = data;
      if (typeof config.transform === "function") {
        try {
          if (config.clone) {
            processedData = typeof data === "object" && data !== null ? JSON.parse(JSON.stringify(data)) : data;
          }
          const transformed = config.transform(processedData);
          if (transformed !== void 0) {
            processedData = transformed;
          }
        } catch (error) {
          logger.error(`Transform error in curl generation: ${error.message}`);
          throw error;
        }
      }
      const curlCommand = generateCurlCommand(config, processedData);
      curlCommands.push(curlCommand);
    }
  }
  const endTime = Date.now();
  const duration = endTime - startTime;
  const result = {
    responses: curlCommands,
    duration,
    clockTime: prettyTime(duration),
    reqCount: 0,
    // No actual requests made
    rowCount,
    rps: 0,
    errors: 0,
    stats: getMemoryStats()
  };
  if (isMainJob) {
    logger.complete(result);
  }
  return result;
}
function generateCurlCommand(config, data) {
  const parts = ["curl"];
  if (config.method && config.method !== "GET") {
    parts.push(`-X ${config.method}`);
  }
  if (config.headers) {
    Object.entries(config.headers).forEach(([key, value]) => {
      parts.push(`-H "${key}: ${value}"`);
    });
  }
  if (["POST", "PUT", "PATCH"].includes(config.method?.toUpperCase()) && data) {
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    parts.push(`-d '${payload}'`);
    const hasContentType = config.headers && Object.keys(config.headers).some((key) => key.toLowerCase() === "content-type");
    if (!hasContentType) {
      parts.push(`-H "Content-Type: application/json"`);
    }
  }
  let url = config.url;
  if (config.searchParams) {
    const params = new URLSearchParams(config.searchParams);
    url += `?${params.toString()}`;
  }
  parts.push(`"${url}"`);
  return parts.join(" ");
}
async function handleDryRun(config, logger, isMainJob) {
  const startTime = Date.now();
  if (logger.isVerbose()) {
    logger.info("Running in dry run mode - no actual requests will be made");
  }
  const stream = await createDataStream(config);
  let rowCount = 0;
  const responses = [];
  for await (const data of stream) {
    if (data !== null) {
      rowCount++;
      let processedData = data;
      if (config.clone) {
        processedData = typeof data === "object" && data !== null ? JSON.parse(JSON.stringify(data)) : data;
      }
      if (config.preset) {
        try {
          processedData = applyPresetTransform(processedData, config.preset, config.errorHandler);
        } catch (error) {
          logger.error(`Preset transform error in dry run (${config.preset}): ${error.message}`);
          if (config.errorHandler && typeof config.errorHandler === "function") {
            config.errorHandler(error, processedData);
          } else {
            throw error;
          }
        }
      }
      if (typeof config.transform === "function") {
        try {
          const transformed = config.transform(processedData);
          if (transformed !== void 0) {
            processedData = transformed;
            if (!config.clone && typeof data === "object" && data !== null && !Array.isArray(data) && typeof transformed === "object" && !Array.isArray(transformed)) {
              Object.assign(data, transformed);
            }
          }
        } catch (error) {
          logger.error(`Transform error in dry run: ${error.message}`);
          if (config.errorHandler && typeof config.errorHandler === "function") {
            config.errorHandler(error, processedData);
          } else {
            throw error;
          }
        }
      }
      if (config.preset || config.transform) {
        responses.push(processedData);
        if ((config.showData || config.showSample) && logger.isVerbose()) {
          const maxRecords = config.showSample ? 3 : 100;
          if (responses.length <= maxRecords) {
            logger.info(`Transformed record ${responses.length}:`, JSON.stringify(processedData, null, 2));
          } else if (responses.length === maxRecords + 1) {
            logger.info(`... (showing only first ${maxRecords} transformed records)`);
          }
        }
      }
    }
  }
  const reqCount = config.batchSize > 0 ? Math.ceil(rowCount / config.batchSize) : Math.max(1, rowCount);
  const endTime = Date.now();
  const duration = endTime - startTime;
  const result = {
    responses,
    duration,
    clockTime: prettyTime(duration),
    reqCount: 0,
    // No actual requests made
    rowCount,
    rps: 0,
    errors: 0,
    stats: getMemoryStats()
  };
  if (isMainJob) {
    logger.complete(result);
  }
  return result;
}
function prettyTime(milliseconds) {
  const totalSeconds = milliseconds / 1e3;
  const levels = [
    [Math.floor(totalSeconds / 31536e3), "years"],
    [Math.floor(totalSeconds % 31536e3 / 86400), "days"],
    [Math.floor(totalSeconds % 31536e3 % 86400 / 3600), "hours"],
    [Math.floor(totalSeconds % 31536e3 % 86400 % 3600 / 60), "minutes"]
  ];
  const seconds = parseFloat((totalSeconds % 60).toFixed(2));
  levels.push([seconds, "seconds"]);
  let result = "";
  for (let i = 0; i < levels.length; i++) {
    if (levels[i][0] == 0 || i === levels.length - 1 && levels[i][0] == 0) continue;
    const unit = levels[i][0] === 1 ? String(levels[i][1]).slice(0, -1) : levels[i][1];
    result += ` ${levels[i][0]} ${unit}`;
  }
  return result.trim() || "0 seconds";
}
var import_run_queue, import_ak_tools3, import_child_process, import_stream2, import_path2, import_fs4, import_dotenv, import_meta2, index_default;
var init_index = __esm({
  "index.js"() {
    import_run_queue = __toESM(require("run-queue"), 1);
    import_ak_tools3 = require("ak-tools");
    init_cli();
    import_child_process = require("child_process");
    import_stream2 = require("stream");
    import_path2 = __toESM(require("path"), 1);
    import_fs4 = require("fs");
    import_dotenv = require("dotenv");
    init_http_client();
    init_circular_buffer();
    init_stream_processors();
    init_logger();
    init_presets();
    init_errors();
    import_meta2 = {};
    (0, import_dotenv.config)({ debug: false, override: false });
    if (import_meta2.url === `file://${process.argv[1]}`) {
      cli_default().then((params) => {
        return main(params).then((results) => ({ params, results }));
      }).then(({ params, results }) => {
        if (params.verbose) {
          const logger = createLogger({ verbose: true });
          logger.log("\n\u{1F4CB} Final Results Summary:");
          logger.log((0, import_ak_tools3.json)(results));
        }
      }).catch((error) => {
        const logger = createLogger({ verbose: true });
        logger.error("Operation failed:", error.message);
        if (error.stack && process.env.NODE_ENV === "development") {
          console.error("\nStack trace:");
          console.error(error.stack);
        }
        process.exit(1);
      }).finally(() => {
        process.exit(0);
      });
    }
    index_default = main;
  }
});
init_index();
