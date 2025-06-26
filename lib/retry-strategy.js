/**
 * Retry strategy with exponential backoff and jitter
 * 
 * @description
 * Advanced retry strategy implementation with exponential backoff, jitter,
 * and adaptive rate limiting. Supports custom retry conditions, Retry-After
 * header parsing, and comprehensive error handling.
 * 
 * @module RetryStrategy
 * @since 2.0.0
 * @version 2.0.0
 */

const { RetryError, RateLimitError } = require('./errors');

/**
 * Retry strategy class with exponential backoff and intelligent retry logic
 * 
 * @description
 * Implements sophisticated retry logic with exponential backoff, jitter,
 * network error detection, and Retry-After header parsing. Provides
 * configurable retry conditions and comprehensive error handling.
 * 
 * @class RetryStrategy
 * @since 2.0.0
 */
class RetryStrategy {
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
        this.baseDelay = options.baseDelay || 1000;
        this.maxDelay = options.maxDelay || 30000;
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
        // Use static delay if configured
        if (this.useStaticDelay) {
            return this.staticRetryDelay;
        }

        // Check for Retry-After header
        if (error && error.retryAfter) {
            return Math.min(error.retryAfter * 1000, this.maxDelay);
        }

        // Exponential backoff with jitter
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
        // Check attempt limit
        if (attempt >= this.maxRetries) {
            return false;
        }

        // Custom retry handler takes precedence
        if (this.retryHandler && typeof this.retryHandler === 'function') {
            return this.retryHandler(error, attempt);
        }

        // Network errors
        if (this.retryOnNetworkError && this.isNetworkError(error)) {
            return true;
        }

        // HTTP status codes
        if (error.statusCode && this.retryOn.includes(error.statusCode)) {
            return true;
        }

        // Timeout errors
        if (error.code === 'ETIMEDOUT' || error.name === 'TimeoutError') {
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
            'ENOTFOUND',
            'ECONNRESET',
            'ECONNREFUSED',
            'ECONNABORTED',
            'EHOSTUNREACH',
            'ENETUNREACH',
            'EAI_AGAIN'
        ];

        return networkErrorCodes.includes(error.code) || 
               error.name === 'NetworkError' ||
               error.type === 'NETWORK_ERROR';
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
                
                // If we've exhausted all attempts, throw RetryError
                if (attempt > this.maxRetries) {
                    throw new RetryError(`All ${this.maxRetries} retry attempts failed`, {
                        maxRetries: this.maxRetries,
                        lastError,
                        url: context.url,
                        method: context.method
                    });
                }
                
                // Check if we should retry this error
                if (!this.shouldRetry(error, attempt - 1)) {
                    throw error;
                }

                // Calculate delay for next attempt
                const delay = this.calculateDelay(attempt - 1, error);
                
                // Log retry attempt if verbose
                if (context.verbose) {
                    console.log(`Retry attempt ${attempt}/${this.maxRetries + 1} after ${delay}ms delay. Error: ${error.message}`);
                }

                // Wait before retry
                await this.delay(delay);
            }
        }

        // This should never be reached, but just in case
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
        return new Promise(resolve => setTimeout(resolve, ms));
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

        // Try parsing as seconds
        const seconds = parseInt(retryAfterHeader, 10);
        if (!isNaN(seconds) && seconds >= 0) {
            return seconds;
        }

        // Try parsing as HTTP date
        try {
            const date = new Date(retryAfterHeader);
            if (isNaN(date.getTime())) {
                return null;
            }
            const now = new Date();
            const secondsUntil = Math.max(0, Math.floor((date - now) / 1000));
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
        const retryAfter = this.parseRetryAfter(headers['retry-after']);
        const limit = headers['x-ratelimit-limit'] || headers['x-rate-limit-limit'];
        const remaining = headers['x-ratelimit-remaining'] || headers['x-rate-limit-remaining'];

        return new RateLimitError('Rate limit exceeded', {
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
}

module.exports = RetryStrategy;