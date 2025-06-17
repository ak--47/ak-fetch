/**
 * Custom error classes for ak-fetch
 */

class AkFetchError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = options.code;
        this.statusCode = options.statusCode;
        this.url = options.url;
        this.method = options.method;
        this.retryCount = options.retryCount || 0;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}

class NetworkError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'NETWORK_ERROR';
    }
}

class TimeoutError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'TIMEOUT_ERROR';
        this.timeout = options.timeout;
    }
}

class RetryError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'RETRY_ERROR';
        this.maxRetries = options.maxRetries;
        this.lastError = options.lastError;
    }
}

class ValidationError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'VALIDATION_ERROR';
        this.field = options.field;
        this.value = options.value;
    }
}

class RateLimitError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'RATE_LIMIT_ERROR';
        this.retryAfter = options.retryAfter;
        this.limit = options.limit;
        this.remaining = options.remaining;
    }
}

class ConfigurationError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'CONFIGURATION_ERROR';
        this.parameter = options.parameter;
    }
}

class SSLError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'SSL_ERROR';
        this.certificate = options.certificate;
    }
}

class MemoryError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'MEMORY_ERROR';
        this.memoryUsage = options.memoryUsage;
        this.limit = options.limit;
    }
}

module.exports = {
    AkFetchError,
    NetworkError,
    TimeoutError,
    RetryError,
    ValidationError,
    RateLimitError,
    ConfigurationError,
    SSLError,
    MemoryError
};