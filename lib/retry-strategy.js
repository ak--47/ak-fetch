/**
 * Retry strategy with exponential backoff and jitter
 */

const { RetryError, RateLimitError } = require('./errors');

class RetryStrategy {
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
     * Calculate delay for the next retry
     * @param {number} attempt - Current attempt number (0-based)
     * @param {Object} error - Error that occurred
     * @returns {number} Delay in milliseconds
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
     * @param {Error} error - Error that occurred
     * @param {number} attempt - Current attempt number (0-based)
     * @returns {boolean} True if should retry
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
     * @param {Error} error - Error to check
     * @returns {boolean} True if network error
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
     * @param {Function} fn - Function to execute
     * @param {Object} context - Context for the function
     * @returns {Promise} Result of the function
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
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Parse Retry-After header
     * @param {string} retryAfterHeader - Retry-After header value
     * @returns {number|null} Seconds to wait, or null if invalid
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
     * @param {Object} headers - Response headers
     * @param {number} statusCode - HTTP status code
     * @returns {RateLimitError} Rate limit error
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
     * Get retry statistics
     * @returns {Object} Retry statistics
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