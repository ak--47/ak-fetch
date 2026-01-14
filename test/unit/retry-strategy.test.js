// @ts-nocheck
/**
 * Unit tests for RetryStrategy
 */

import { vi } from 'vitest';
import RetryStrategy from '../../lib/retry-strategy.js';
import { RetryError, RateLimitError } from '../../lib/errors.js';

describe('RetryStrategy', () => {
    let retryStrategy;

    beforeEach(() => {
        retryStrategy = new RetryStrategy({
            maxRetries: 3,
            baseDelay: 100,
            maxDelay: 5000,
            exponentialBase: 2,
            jitterFactor: 0.1
        });
    });

    describe('constructor', () => {
        test('should create with default options', () => {
            const strategy = new RetryStrategy();
            
            expect(strategy.maxRetries).toBe(3);
            expect(strategy.baseDelay).toBe(1000);
            expect(strategy.retryOn).toContain(429);
            expect(strategy.retryOn).toContain(500);
        });

        test('should create with custom options', () => {
            const strategy = new RetryStrategy({
                maxRetries: 5,
                baseDelay: 2000,
                retryOn: [503, 504]
            });
            
            expect(strategy.maxRetries).toBe(5);
            expect(strategy.baseDelay).toBe(2000);
            expect(strategy.retryOn).toEqual([503, 504]);
        });
    });

    describe('calculateDelay', () => {
        test('should calculate exponential backoff', () => {
            const delay0 = retryStrategy.calculateDelay(0);
            const delay1 = retryStrategy.calculateDelay(1);
            const delay2 = retryStrategy.calculateDelay(2);
            
            expect(delay0).toBeGreaterThanOrEqual(100);
            expect(delay0).toBeLessThanOrEqual(110); // base + jitter
            
            expect(delay1).toBeGreaterThanOrEqual(200);
            expect(delay1).toBeLessThanOrEqual(220);
            
            expect(delay2).toBeGreaterThanOrEqual(400);
            expect(delay2).toBeLessThanOrEqual(440);
        });

        test('should respect max delay', () => {
            const strategy = new RetryStrategy({
                baseDelay: 1000,
                maxDelay: 2000,
                exponentialBase: 2
            });
            
            const delay = strategy.calculateDelay(10); // Would be huge without max
            expect(delay).toBeLessThanOrEqual(2000);
        });

        test('should use static delay when configured', () => {
            const strategy = new RetryStrategy({
                useStaticDelay: true,
                staticRetryDelay: 500
            });
            
            expect(strategy.calculateDelay(0)).toBe(500);
            expect(strategy.calculateDelay(1)).toBe(500);
            expect(strategy.calculateDelay(5)).toBe(500);
        });

        test('should respect Retry-After header', () => {
            const error = { retryAfter: 2 }; // 2 seconds
            const delay = retryStrategy.calculateDelay(0, error);
            
            expect(delay).toBe(2000); // Should convert to milliseconds
        });

        test('should cap Retry-After to maxDelay', () => {
            const error = { retryAfter: 10 }; // 10 seconds
            const delay = retryStrategy.calculateDelay(0, error);
            
            expect(delay).toBe(5000); // Should be capped at maxDelay
        });
    });

    describe('shouldRetry', () => {
        test('should not retry when max attempts reached', async () => {
            const error = { statusCode: 500 };
            
            expect(await retryStrategy.shouldRetry(error, 3)).toBe(false);
            expect(await retryStrategy.shouldRetry(error, 4)).toBe(false);
        });

        test('should retry on configured status codes', async () => {
            expect(await retryStrategy.shouldRetry({ statusCode: 429 }, 0)).toBe(true);
            expect(await retryStrategy.shouldRetry({ statusCode: 500 }, 1)).toBe(true);
            expect(await retryStrategy.shouldRetry({ statusCode: 502 }, 2)).toBe(true);
        });

        test('should not retry on non-retryable status codes', async () => {
            expect(await retryStrategy.shouldRetry({ statusCode: 400 }, 0)).toBe(false);
            expect(await retryStrategy.shouldRetry({ statusCode: 401 }, 0)).toBe(false);
            expect(await retryStrategy.shouldRetry({ statusCode: 404 }, 0)).toBe(false);
        });

        test('should retry on network errors', async () => {
            expect(await retryStrategy.shouldRetry({ code: 'ENOTFOUND' }, 0)).toBe(true);
            expect(await retryStrategy.shouldRetry({ code: 'ECONNRESET' }, 1)).toBe(true);
            expect(await retryStrategy.shouldRetry({ name: 'NetworkError' }, 2)).toBe(true);
        });

        test('should retry on timeout errors', async () => {
            expect(await retryStrategy.shouldRetry({ code: 'ETIMEDOUT' }, 0)).toBe(true);
            expect(await retryStrategy.shouldRetry({ name: 'TimeoutError' }, 1)).toBe(true);
        });

        test('should use custom retry handler', async () => {
            const customHandler = vi.fn().mockReturnValue(true);
            const strategy = new RetryStrategy({ retryHandler: customHandler });

            const error = { statusCode: 418 }; // I'm a teapot
            const result = await strategy.shouldRetry(error, 1);

            expect(customHandler).toHaveBeenCalledWith(error, 1);
            expect(result).toBe(true);
        });

        test('should support async retry handler', async () => {
            const asyncHandler = vi.fn().mockImplementation(async (error, attempt) => {
                await new Promise(r => setTimeout(r, 10));
                return error.statusCode === 500;
            });

            const strategy = new RetryStrategy({ retryHandler: asyncHandler });
            const error = { statusCode: 500 };

            const result = await strategy.shouldRetry(error, 0);
            expect(result).toBe(true);
            expect(asyncHandler).toHaveBeenCalledWith(error, 0);
        });

        test('should maintain backward compatibility with sync retry handler', async () => {
            const syncHandler = vi.fn().mockReturnValue(false);
            const strategy = new RetryStrategy({ retryHandler: syncHandler });

            const result = await strategy.shouldRetry({ statusCode: 400 }, 0);
            expect(result).toBe(false);
            expect(syncHandler).toHaveBeenCalledWith({ statusCode: 400 }, 0);
        });
    });

    describe('isNetworkError', () => {
        test('should identify network error codes', () => {
            expect(retryStrategy.isNetworkError({ code: 'ENOTFOUND' })).toBe(true);
            expect(retryStrategy.isNetworkError({ code: 'ECONNRESET' })).toBe(true);
            expect(retryStrategy.isNetworkError({ code: 'ECONNREFUSED' })).toBe(true);
        });

        test('should identify network error types', () => {
            expect(retryStrategy.isNetworkError({ name: 'NetworkError' })).toBe(true);
            expect(retryStrategy.isNetworkError({ type: 'NETWORK_ERROR' })).toBe(true);
        });

        test('should not identify non-network errors', () => {
            expect(retryStrategy.isNetworkError({ code: 'INVALID' })).toBe(false);
            expect(retryStrategy.isNetworkError({ statusCode: 500 })).toBe(false);
        });
    });

    describe('execute', () => {
        test('should succeed on first try', async () => {
            const fn = vi.fn().mockResolvedValue('success');
            const context = { url: 'http://test.com' };
            
            const result = await retryStrategy.execute(fn, context);
            
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith(context, 0);
        });

        test('should retry on retryable errors', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce({ statusCode: 500 })
                .mockRejectedValueOnce({ statusCode: 502 })
                .mockResolvedValue('success');
            
            const result = await retryStrategy.execute(fn);
            
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        test('should fail after max retries', async () => {
            const error = { statusCode: 500 };
            const fn = vi.fn().mockRejectedValue(error);
            
            try {
                await retryStrategy.execute(fn);
                // Should not reach here
                expect(true).toBe(false);
            } catch (thrownError) {
                expect(thrownError).toBeInstanceOf(RetryError);
                expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries
            }
        });

        test('should not retry on non-retryable errors', async () => {
            const error = { statusCode: 400 };
            const fn = vi.fn().mockRejectedValue(error);
            
            await expect(retryStrategy.execute(fn)).rejects.toMatchObject({ statusCode: 400 });
            expect(fn).toHaveBeenCalledTimes(1);
        });

        test('should include delay between retries', async () => {
            const strategy = new RetryStrategy({ baseDelay: 50, maxRetries: 2 });
            const fn = vi.fn()
                .mockRejectedValueOnce({ statusCode: 500 })
                .mockResolvedValue('success');
            
            const startTime = Date.now();
            await strategy.execute(fn);
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeGreaterThanOrEqual(45); // Should have some delay
            expect(fn).toHaveBeenCalledTimes(2);
        });

        test('should log retry attempts when verbose', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
            const fn = vi.fn()
                .mockRejectedValueOnce({ statusCode: 500, message: 'Server Error' })
                .mockResolvedValue('success');
            
            const context = { verbose: true, url: 'http://test.com' };
            await retryStrategy.execute(fn, context);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Retry attempt 1/4')
            );
            
            consoleSpy.mockRestore();
        });
    });

    describe('parseRetryAfter', () => {
        test('should parse seconds', () => {
            expect(retryStrategy.parseRetryAfter('5')).toBe(5);
            expect(retryStrategy.parseRetryAfter('120')).toBe(120);
        });

        test('should parse HTTP date', () => {
            const futureDate = new Date(Date.now() + 5000).toUTCString();
            const seconds = retryStrategy.parseRetryAfter(futureDate);
            
            expect(seconds).toBeGreaterThanOrEqual(4);
            expect(seconds).toBeLessThanOrEqual(6);
        });

        test('should handle invalid values', () => {
            expect(retryStrategy.parseRetryAfter('invalid')).toBeNull();
            expect(retryStrategy.parseRetryAfter('')).toBeNull();
            expect(retryStrategy.parseRetryAfter(null)).toBeNull();
        });

        test('should handle past dates', () => {
            const pastDate = new Date(Date.now() - 5000).toUTCString();
            const seconds = retryStrategy.parseRetryAfter(pastDate);
            
            expect(seconds).toBe(0);
        });
    });

    describe('createRateLimitError', () => {
        test('should create rate limit error with headers', () => {
            const headers = {
                'retry-after': '60',
                'x-ratelimit-limit': '100',
                'x-ratelimit-remaining': '0'
            };
            
            const error = retryStrategy.createRateLimitError(headers, 429);
            
            expect(error).toBeInstanceOf(RateLimitError);
            expect(error.statusCode).toBe(429);
            expect(error.retryAfter).toBe(60);
            expect(error.limit).toBe(100);
            expect(error.remaining).toBe(0);
        });

        test('should handle missing headers', () => {
            const error = retryStrategy.createRateLimitError({}, 429);
            
            expect(error).toBeInstanceOf(RateLimitError);
            expect(error.retryAfter).toBeNull();
            expect(error.limit).toBeNull();
            expect(error.remaining).toBeNull();
        });
    });

    describe('getStats', () => {
        test('should return configuration statistics', () => {
            const stats = retryStrategy.getStats();
            
            expect(stats).toEqual({
                maxRetries: 3,
                baseDelay: 100,
                maxDelay: 5000,
                exponentialBase: 2,
                jitterFactor: 0.1,
                retryOn: expect.arrayContaining([408, 429, 500, 502, 503, 504]),
                useStaticDelay: false
            });
        });
    });

    describe('delay', () => {
        test('should create delay promise', async () => {
            const startTime = Date.now();
            await retryStrategy.delay(50);
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeGreaterThanOrEqual(45);
        });
    });
});