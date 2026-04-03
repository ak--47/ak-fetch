/**
 * Custom error classes for ak-fetch
 */

class AkFetchError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = this.constructor.name;
        /** @type {string|undefined} */
        this.type = undefined;
        this.code = options.code;
        this.statusCode = options.statusCode;
        this.url = options.url;
        this.method = options.method;
        this.body = options.body;
        this.headers = options.headers;
        this.retryCount = options.retryCount || 0;
        this.timestamp = new Date().toISOString();
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
            body: this.body,
            headers: this.headers,
            retryCount: this.retryCount,
            timestamp: this.timestamp
        };
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

    toJSON() {
        return {
            ...super.toJSON(),
            timeout: this.timeout
        };
    }
}

class RetryError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            statusCode: options.statusCode ?? options.lastError?.statusCode,
            body: options.body ?? options.lastError?.body,
        });
        this.type = 'RETRY_ERROR';
        this.maxRetries = options.maxRetries;
        this.lastError = options.lastError;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            maxRetries: this.maxRetries,
            lastError: this.lastError ? {
                message: this.lastError.message,
                name: this.lastError.name,
                ...(typeof this.lastError.toJSON === 'function' ? this.lastError.toJSON() : {})
            } : undefined
        };
    }
}

class ValidationError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'VALIDATION_ERROR';
        this.field = options.field;
        this.value = options.value;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            field: this.field,
            value: this.value
        };
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

    toJSON() {
        return {
            ...super.toJSON(),
            retryAfter: this.retryAfter,
            limit: this.limit,
            remaining: this.remaining
        };
    }
}

class ConfigurationError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'CONFIGURATION_ERROR';
        this.parameter = options.parameter;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            parameter: this.parameter
        };
    }
}

class SSLError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'SSL_ERROR';
        this.certificate = options.certificate;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            certificate: this.certificate
        };
    }
}

class MemoryError extends AkFetchError {
    constructor(message, options = {}) {
        super(message, options);
        this.type = 'MEMORY_ERROR';
        this.memoryUsage = options.memoryUsage;
        this.limit = options.limit;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            memoryUsage: this.memoryUsage,
            limit: this.limit
        };
    }
}

export {
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