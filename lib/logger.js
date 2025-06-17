/**
 * Friendly logging system with progress tracking and throughput measurement
 * Provides clean, informative output while respecting verbose settings
 */

const readline = require('readline');
const { comma } = require('ak-tools');

/**
 * Logger class for ak-fetch operations
 * Handles progress display, timing, and throughput calculations
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
     * @param {string} message - Operation description
     * @param {Object} config - Configuration details
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
     * @param {Object} config - Configuration object
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
     * @param {number} completed - Completed items
     * @param {number} total - Total items
     * @param {number} records - Records processed
     * @param {Object} options - Additional options
     */
    progress(completed, total = 0, records = 0, options = {}) {
        if (!this.verbose) return;
        
        const now = Date.now();
        
        // Throttle progress updates for performance
        if (now - this.lastProgressUpdate < this.progressUpdateInterval) {
            return;
        }
        
        this.lastProgressUpdate = now;
        
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
     * @param {Object} results - Final results
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
     * @param {...any} args - Arguments to log
     */
    log(...args) {
        if (!this.verbose) return;
        this.originalLog(...args);
    }

    /**
     * Log error messages (always shown regardless of verbose setting)
     * @param {...any} args - Arguments to log
     */
    error(...args) {
        this.originalError('❌', ...args);
    }

    /**
     * Log warning messages (always shown regardless of verbose setting)
     * @param {...any} args - Arguments to log
     */
    warn(...args) {
        this.originalWarn('⚠️', ...args);
    }

    /**
     * Log info messages with icon
     * @param {...any} args - Arguments to log
     */
    info(...args) {
        if (!this.verbose) return;
        this.originalLog('ℹ️', ...args);
    }

    /**
     * Log success messages with icon
     * @param {...any} args - Arguments to log
     */
    success(...args) {
        if (!this.verbose) return;
        this.originalLog('✅', ...args);
    }

    /**
     * Log file operation messages
     * @param {string} operation - Operation type (reading, writing, etc.)
     * @param {string} filename - File name
     * @param {string} format - File format
     */
    fileOperation(operation, filename, format = '') {
        if (!this.verbose) return;
        const formatStr = format ? ` (${format})` : '';
        this.originalLog(`📁 ${operation}: ${filename}${formatStr}`);
    }

    /**
     * Create ASCII progress bar
     * @param {number} percent - Percentage complete (0-100)
     * @returns {string} Progress bar string
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
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration
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
     * @param {string} str - camelCase string
     * @returns {string} Title Case string
     */
    camelToTitle(str) {
        return str
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    /**
     * Temporarily disable logging
     */
    silence() {
        this.verbose = false;
    }

    /**
     * Re-enable logging
     */
    unsilence() {
        this.verbose = true;
    }

    /**
     * Check if logger is in verbose mode
     * @returns {boolean} True if verbose
     */
    isVerbose() {
        return this.verbose;
    }

    /**
     * Create a child logger with inherited settings
     * @param {Object} options - Options to override
     * @returns {AkLogger} New logger instance
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
 * @param {Object} options - Logger options
 * @returns {AkLogger} Logger instance
 */
function createLogger(options = {}) {
    return new AkLogger(options);
}

module.exports = {
    AkLogger,
    createLogger
};