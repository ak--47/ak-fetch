/**
 * Friendly logging system with progress tracking and throughput measurement
 * 
 * @description
 * Provides clean, informative output while respecting verbose settings.
 * Features progress bars, timing, throughput calculations, and memory monitoring.
 * Designed for command-line interfaces with real-time progress updates.
 * 
 * @module Logger
 * @since 2.0.0
 * @version 2.0.0
 */

const readline = require('readline');
const { comma } = require('ak-tools');

/**
 * Logger class for ak-fetch operations
 * 
 * @description
 * Main logger class that handles progress display, timing, and throughput calculations.
 * Provides methods for different log levels, progress tracking, and formatted output.
 * Respects verbose settings and provides clean CLI output.
 * 
 * @class AkLogger
 * @since 2.0.0
 */
class AkLogger {
    constructor(options = {}) {
        this.verbose = options.verbose !== false;
        this.startTime = null;
        this.lastProgressUpdate = 0;
        this.progressUpdateInterval = options.progressUpdateInterval || 250; // ms
        this.showThroughput = options.showThroughput !== false;
        this.showMemory = options.showMemory || false;
        this.progressBarWidth = options.progressBarWidth || 30;
        this.logPrefix = options.logPrefix || '🚀';
        this.progressActive = false;
        
        // Store original console methods
        this.originalLog = console.log;
        this.originalError = console.error;
        this.originalWarn = console.warn;
        
        // Bind methods to preserve context
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
        
        console.log(`\n${this.logPrefix} ${message}`);
        
        if (config && Object.keys(config).length > 0) {
            this.logConfig(config);
        }
        
        console.log(''); // Add spacing
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
            method = 'POST',
            batchSize,
            concurrency,
            retries,
            timeout,
            data,
            ...otherConfig
        } = config;
        
        console.log('📋 Configuration:');
        console.log(`   URL: ${url}`);
        console.log(`   Method: ${method.toUpperCase()}`);
        
        if (Array.isArray(data)) {
            console.log(`   Records: ${comma(data.length)}`);
        } else if (typeof data === 'string') {
            console.log(`   Data Source: ${data}`);
        }
        
        if (batchSize) {
            console.log(`   Batch Size: ${comma(batchSize)}`);
        }
        
        if (concurrency) {
            console.log(`   Concurrency: ${concurrency}`);
        }
        
        if (retries !== undefined) {
            console.log(`   Retries: ${retries === null ? 'Fire-and-forget' : retries}`);
        }
        
        if (timeout) {
            console.log(`   Timeout: ${this.formatDuration(timeout)}`);
        }
        
        // Log additional interesting config
        const interestingKeys = ['enableCookies', 'enableConnectionPooling', 'useStaticRetryDelay'];
        const additionalConfig = {};
        
        interestingKeys.forEach(key => {
            if (otherConfig[key] !== undefined) {
                additionalConfig[key] = otherConfig[key];
            }
        });
        
        if (Object.keys(additionalConfig).length > 0) {
            console.log(`   Features: ${Object.entries(additionalConfig)
                .filter(([, value]) => value)
                .map(([key]) => this.camelToTitle(key))
                .join(', ')}`);
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
        
        // Throttle progress updates for performance
        if (now - this.lastProgressUpdate < this.progressUpdateInterval) {
            return;
        }
        
        this.lastProgressUpdate = now;
        this.progressActive = true;
        
        // Clear current line and move cursor to beginning
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
        
        const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
        const progressBar = this.createProgressBar(percent);
        
        let message = `${progressBar} ${percent}%`;
        
        if (total > 0) {
            message += ` | ${comma(completed)}/${comma(total)} batches`;
        } else {
            message += ` | ${comma(completed)} requests`;
        }
        
        if (records > 0) {
            message += ` | ${comma(records)} records`;
        }
        
        // Add throughput if enabled and we have timing data
        if (this.showThroughput && this.startTime && completed > 0) {
            const elapsed = (now - this.startTime) / 1000;
            const rps = Math.floor(completed / elapsed);
            if (rps > 0) {
                message += ` | ${comma(rps)} req/s`;
            }
            
            if (records > 0) {
                const recordsPerSec = Math.floor(records / elapsed);
                if (recordsPerSec > 0) {
                    message += ` (${comma(recordsPerSec)} rec/s)`;
                }
            }
        }
        
        // Add memory usage if enabled
        if (this.showMemory) {
            const memUsage = process.memoryUsage();
            const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            message += ` | ${heapMB}MB`;
        }
        
        // Add ETA if we have enough data
        if (this.startTime && total > 0 && completed > 0 && percent < 100) {
            const elapsed = now - this.startTime;
            const rate = completed / elapsed;
            const remaining = total - completed;
            const eta = remaining / rate;
            
            if (eta > 0 && eta < 86400000) { // Less than 24 hours
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
        
        // Clear progress line
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
        
        const {
            reqCount = 0,
            rowCount = 0,
            duration = 0,
            rps = 0,
            errors = 0
        } = results;
        
        const emoji = errors > 0 ? '⚠️' : '✅';
        
        console.log(`${emoji} Completed: ${comma(reqCount)} requests`);
        
        if (rowCount > 0) {
            console.log(`   📊 Processed: ${comma(rowCount)} records`);
        }
        
        if (duration > 0) {
            console.log(`   ⏱️  Duration: ${this.formatDuration(duration)}`);
        }
        
        if (rps > 0) {
            console.log(`   🚄 Throughput: ${comma(rps)} requests/second`);
            
            if (rowCount > 0) {
                const recordsPerSec = Math.floor(rowCount / (duration / 1000));
                console.log(`   📈 Records/sec: ${comma(recordsPerSec)}`);
            }
        }
        
        if (errors > 0) {
            console.log(`   ❌ Errors: ${comma(errors)}`);
        }
        
        // Show memory stats if enabled
        if (this.showMemory && results.stats) {
            console.log(`   💾 Memory: ${results.stats.heapUsed}MB heap, ${results.stats.rss}MB RSS`);
        }
        
        console.log(''); // Add spacing
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
        this.originalError('❌', ...args);
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
        this.originalWarn('⚠️', ...args);
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
        
        // If progress is active, clear the line first and add newline after
        if (this.progressActive) {
            readline.cursorTo(process.stdout, 0);
            readline.clearLine(process.stdout, 0);
            this.originalLog('ℹ️', ...args);
            this.progressActive = false; // Reset progress state
        } else {
            this.originalLog('ℹ️', ...args);
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
        this.originalLog('✅', ...args);
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
    fileOperation(operation, filename, format = '') {
        if (!this.verbose) return;
        const formatStr = format ? ` (${format})` : '';
        this.originalLog(`📁 ${operation}: ${filename}${formatStr}`);
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
        const filled = Math.floor((percent / 100) * this.progressBarWidth);
        const empty = this.progressBarWidth - filled;
        
        const filledBar = '█'.repeat(filled);
        const emptyBar = '░'.repeat(empty);
        
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
        if (ms < 1000) {
            return `${Math.round(ms)}ms`;
        }
        
        const seconds = ms / 1000;
        
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
        return str
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
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
        return new AkLogger({
            verbose: this.verbose,
            showThroughput: this.showThroughput,
            showMemory: this.showMemory,
            progressBarWidth: this.progressBarWidth,
            logPrefix: this.logPrefix,
            ...options
        });
    }
}

/**
 * Create a new logger instance
 * 
 * @description
 * Factory function to create a new AkLogger instance with specified options.
 * Provides a convenient way to create loggers without using 'new' keyword.
 * 
 * @param {Object} [options={}] - Logger configuration options
 * @param {boolean} [options.verbose=true] - Enable verbose output
 * @param {number} [options.progressUpdateInterval=250] - Progress update throttle (ms)
 * @param {boolean} [options.showThroughput=true] - Show throughput in progress
 * @param {boolean} [options.showMemory=false] - Show memory usage
 * @param {number} [options.progressBarWidth=30] - Width of progress bar
 * @param {string} [options.logPrefix='🚀'] - Emoji prefix for operations
 * 
 * @returns {AkLogger} Configured logger instance
 * @description Ready-to-use logger with specified configuration
 * 
 * @example
 * const logger = createLogger({
 *   verbose: true,
 *   showThroughput: true,
 *   showMemory: true,
 *   logPrefix: '📡'
 * });
 * 
 * @example
 * // Simple logger with defaults
 * const logger = createLogger();
 * logger.start('Processing data');
 * 
 * @since 2.0.0
 */
function createLogger(options = {}) {
    return new AkLogger(options);
}

module.exports = {
    AkLogger,
    createLogger
};