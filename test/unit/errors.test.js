// @ts-nocheck
/**
 * Unit tests for Error classes
 */

import {
    AkFetchError,
    NetworkError,
    TimeoutError,
    RetryError,
    ValidationError,
    RateLimitError,
    ConfigurationError,
    SSLError,
    MemoryError
} from '../../lib/errors.js';

describe('Error Classes', () => {
    describe('AkFetchError', () => {
        test('should create error with basic message', () => {
            const error = new AkFetchError('Test error');
            
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('AkFetchError');
            expect(error.timestamp).toBeDefined();
            expect(error.retryCount).toBe(0);
        });

        test('should create error with options', () => {
            const options = {
                code: 'TEST_CODE',
                statusCode: 500,
                url: 'https://example.com',
                method: 'POST',
                retryCount: 2
            };
            
            const error = new AkFetchError('Test error', options);
            
            expect(error.code).toBe('TEST_CODE');
            expect(error.statusCode).toBe(500);
            expect(error.url).toBe('https://example.com');
            expect(error.method).toBe('POST');
            expect(error.retryCount).toBe(2);
        });

        test('should have proper error prototype chain', () => {
            const error = new AkFetchError('Test');
            
            expect(error instanceof Error).toBe(true);
            expect(error instanceof AkFetchError).toBe(true);
            expect(Error.captureStackTrace).toHaveBeenCalled;
        });

        test('should include timestamp', () => {
            const beforeCreate = Date.now();
            const error = new AkFetchError('Test');
            const afterCreate = Date.now();
            
            const timestamp = new Date(error.timestamp).getTime();
            expect(timestamp).toBeGreaterThanOrEqual(beforeCreate);
            expect(timestamp).toBeLessThanOrEqual(afterCreate);
        });
    });

    describe('NetworkError', () => {
        test('should create network error with correct type', () => {
            const error = new NetworkError('Connection failed', {
                code: 'ECONNREFUSED',
                url: 'https://example.com'
            });
            
            expect(error.type).toBe('NETWORK_ERROR');
            expect(error.code).toBe('ECONNREFUSED');
            expect(error.url).toBe('https://example.com');
            expect(error instanceof AkFetchError).toBe(true);
            expect(error instanceof NetworkError).toBe(true);
        });
    });

    describe('TimeoutError', () => {
        test('should create timeout error with timeout value', () => {
            const error = new TimeoutError('Request timed out', {
                timeout: 5000,
                url: 'https://example.com'
            });
            
            expect(error.type).toBe('TIMEOUT_ERROR');
            expect(error.timeout).toBe(5000);
            expect(error.url).toBe('https://example.com');
            expect(error instanceof AkFetchError).toBe(true);
            expect(error instanceof TimeoutError).toBe(true);
        });
    });

    describe('RetryError', () => {
        test('should create retry error with retry information', () => {
            const lastError = new Error('Last attempt failed');
            const error = new RetryError('All retries failed', {
                maxRetries: 3,
                lastError,
                url: 'https://example.com'
            });
            
            expect(error.type).toBe('RETRY_ERROR');
            expect(error.maxRetries).toBe(3);
            expect(error.lastError).toBe(lastError);
            expect(error.url).toBe('https://example.com');
            expect(error instanceof AkFetchError).toBe(true);
            expect(error instanceof RetryError).toBe(true);
        });
    });

    describe('ValidationError', () => {
        test('should create validation error with field information', () => {
            const error = new ValidationError('Invalid field value', {
                field: 'username',
                value: ''
            });
            
            expect(error.type).toBe('VALIDATION_ERROR');
            expect(error.field).toBe('username');
            expect(error.value).toBe('');
            expect(error instanceof AkFetchError).toBe(true);
            expect(error instanceof ValidationError).toBe(true);
        });
    });

    describe('RateLimitError', () => {
        test('should create rate limit error with limit information', () => {
            const error = new RateLimitError('Rate limit exceeded', {
                statusCode: 429,
                retryAfter: 60,
                limit: 100,
                remaining: 0
            });
            
            expect(error.type).toBe('RATE_LIMIT_ERROR');
            expect(error.statusCode).toBe(429);
            expect(error.retryAfter).toBe(60);
            expect(error.limit).toBe(100);
            expect(error.remaining).toBe(0);
            expect(error instanceof AkFetchError).toBe(true);
            expect(error instanceof RateLimitError).toBe(true);
        });
    });

    describe('ConfigurationError', () => {
        test('should create configuration error with parameter information', () => {
            const error = new ConfigurationError('Invalid configuration', {
                parameter: 'batchSize',
                code: 'INVALID_BATCH_SIZE'
            });
            
            expect(error.type).toBe('CONFIGURATION_ERROR');
            expect(error.parameter).toBe('batchSize');
            expect(error.code).toBe('INVALID_BATCH_SIZE');
            expect(error instanceof AkFetchError).toBe(true);
            expect(error instanceof ConfigurationError).toBe(true);
        });
    });

    describe('SSLError', () => {
        test('should create SSL error with certificate information', () => {
            const error = new SSLError('SSL verification failed', {
                code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
                certificate: 'cert-info'
            });
            
            expect(error.type).toBe('SSL_ERROR');
            expect(error.code).toBe('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
            expect(error.certificate).toBe('cert-info');
            expect(error instanceof AkFetchError).toBe(true);
            expect(error instanceof SSLError).toBe(true);
        });
    });

    describe('MemoryError', () => {
        test('should create memory error with usage information', () => {
            const memoryUsage = {
                heapUsed: 1000000,
                heapTotal: 2000000
            };
            
            const error = new MemoryError('Memory limit exceeded', {
                memoryUsage,
                limit: 1500000
            });
            
            expect(error.type).toBe('MEMORY_ERROR');
            expect(error.memoryUsage).toBe(memoryUsage);
            expect(error.limit).toBe(1500000);
            expect(error instanceof AkFetchError).toBe(true);
            expect(error instanceof MemoryError).toBe(true);
        });
    });

    describe('Error serialization', () => {
        test('should serialize error properties correctly', () => {
            const error = new NetworkError('Connection failed', {
                code: 'ECONNREFUSED',
                statusCode: 0,
                url: 'https://example.com',
                method: 'GET',
                retryCount: 1
            });
            
            const serialized = JSON.stringify(error);
            const parsed = JSON.parse(serialized);
            
            expect(parsed.message).toBe('Connection failed');
            expect(parsed.name).toBe('NetworkError');
            expect(parsed.type).toBe('NETWORK_ERROR');
            expect(parsed.code).toBe('ECONNREFUSED');
            expect(parsed.url).toBe('https://example.com');
            expect(parsed.retryCount).toBe(1);
        });

        test('should handle errors without options', () => {
            const error = new AkFetchError('Simple error');
            
            const serialized = JSON.stringify(error);
            const parsed = JSON.parse(serialized);
            
            expect(parsed.message).toBe('Simple error');
            expect(parsed.retryCount).toBe(0);
            expect(parsed.timestamp).toBeDefined();
        });
    });

    describe('Error inheritance', () => {
        test('should maintain proper instanceof relationships', () => {
            const errors = [
                new NetworkError('Network error'),
                new TimeoutError('Timeout error'),
                new RetryError('Retry error'),
                new ValidationError('Validation error'),
                new RateLimitError('Rate limit error'),
                new ConfigurationError('Configuration error'),
                new SSLError('SSL error'),
                new MemoryError('Memory error')
            ];
            
            errors.forEach(error => {
                expect(error instanceof Error).toBe(true);
                expect(error instanceof AkFetchError).toBe(true);
                expect(error.name).toBeTruthy();
                expect(error.type).toBeTruthy();
            });
        });

        test('should have unique error names', () => {
            const errors = [
                new AkFetchError('Base error'),
                new NetworkError('Network error'),
                new TimeoutError('Timeout error'),
                new RetryError('Retry error'),
                new ValidationError('Validation error'),
                new RateLimitError('Rate limit error'),
                new ConfigurationError('Configuration error'),
                new SSLError('SSL error'),
                new MemoryError('Memory error')
            ];
            
            const names = errors.map(e => e.name);
            const uniqueNames = [...new Set(names)];
            
            expect(names).toHaveLength(uniqueNames.length);
        });

        test('should have unique error types', () => {
            const errors = [
                new NetworkError('Network error'),
                new TimeoutError('Timeout error'),
                new RetryError('Retry error'),
                new ValidationError('Validation error'),
                new RateLimitError('Rate limit error'),
                new ConfigurationError('Configuration error'),
                new SSLError('SSL error'),
                new MemoryError('Memory error')
            ];
            
            const types = errors.map(e => e.type);
            const uniqueTypes = [...new Set(types)];
            
            expect(types).toHaveLength(uniqueTypes.length);
        });
    });

    describe('Stack trace', () => {
        test('should capture stack trace correctly', () => {
            const error = new AkFetchError('Test error');
            
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('AkFetchError: Test error');
            expect(error.stack).toContain(__filename);
        });

        test('should not include constructor in stack trace', () => {
            const error = new NetworkError('Network error');
            
            expect(error.stack).toBeDefined();
            // Stack trace should start from where error was created, not constructor
            expect(error.stack.split('\n')[1]).toContain(__filename);
        });
    });
});