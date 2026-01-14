// @ts-nocheck
/**
 * Integration tests for async error handlers
 */

import main from '../../index.js';
import { vi } from 'vitest';

describe('Async Error Handlers', () => {
    const testUrl = 'https://httpbin.org';

    describe('Async errorHandler', () => {
        test('async errorHandler should complete before continuing', async () => {
            let handlerCompleted = false;
            let handlerStarted = false;

            const config = {
                url: `${testUrl}/status/400`,
                method: 'POST',
                data: [{ test: 'data' }],
                noBatch: true,
                timeout: 5000,
                retries: 0,
                errorHandler: async (error) => {
                    handlerStarted = true;
                    // Simulate async operation
                    await new Promise(r => setTimeout(r, 100));
                    handlerCompleted = true;
                }
            };

            await expect(main(config)).rejects.toThrow();
            expect(handlerStarted).toBe(true);
            expect(handlerCompleted).toBe(true);
        });

        test('sync errorHandler should still work', async () => {
            let errorCaptured = null;

            const config = {
                url: `${testUrl}/status/400`,
                method: 'POST',
                data: [{ test: 'data' }],
                noBatch: true,
                timeout: 5000,
                retries: 0,
                errorHandler: (error) => {
                    errorCaptured = error;
                }
            };

            await expect(main(config)).rejects.toThrow();
            expect(errorCaptured).toBeDefined();
            expect(errorCaptured.statusCode).toBe(400);
        });

        test('errorHandler errors should be caught and logged', async () => {
            const originalConsoleError = console.error;
            const consoleErrorSpy = vi.fn();
            console.error = consoleErrorSpy;

            const config = {
                url: `${testUrl}/status/500`,
                method: 'POST',
                data: [{ test: 'data' }],
                noBatch: true,
                timeout: 5000,
                retries: 0,
                errorHandler: async (error) => {
                    throw new Error('Handler error');
                }
            };

            try {
                await expect(main(config)).rejects.toThrow();

                // Check that the handler error was logged
                expect(consoleErrorSpy).toHaveBeenCalled();
                const errorCall = consoleErrorSpy.mock.calls.find(
                    call => call[0] === 'Error in errorHandler:'
                );
                expect(errorCall).toBeDefined();
                expect(errorCall[1].message).toBe('Handler error');
            } finally {
                console.error = originalConsoleError;
            }
        });
    });

    describe('Async retryHandler', () => {
        test('async retryHandler should work correctly', async () => {
            let asyncCheckCalled = false;
            let attemptCount = 0;

            const config = {
                url: `${testUrl}/status/500`,
                method: 'POST',
                data: [{ test: 'data' }],
                retries: 2,
                retryDelay: 100,
                retryHandler: async (error, attempt) => {
                    asyncCheckCalled = true;
                    attemptCount++;
                    // Simulate async check
                    await new Promise(r => setTimeout(r, 50));
                    return attempt < 1; // Only retry once
                }
            };

            const result = await main(config);
            // In batch mode, errors are stored in responses, not thrown
            expect(result.errors).toBeGreaterThan(0);
            expect(asyncCheckCalled).toBe(true);
            expect(attemptCount).toBeGreaterThan(0);
        });

        test('sync retryHandler should still work', async () => {
            let handlerCalled = false;
            let capturedAttempt = null;

            const config = {
                url: `${testUrl}/status/500`,
                method: 'POST',
                data: [{ test: 'data' }],
                retries: 1,
                retryDelay: 100,
                retryHandler: (error, attempt) => {
                    handlerCalled = true;
                    capturedAttempt = attempt;
                    return false; // Don't retry
                }
            };

            const result = await main(config);
            expect(result.errors).toBeGreaterThan(0);
            expect(handlerCalled).toBe(true);
            expect(capturedAttempt).toBe(0);
        });

        test('async retryHandler with Promise.resolve should work', async () => {
            let handlerCalled = false;

            const config = {
                url: `${testUrl}/status/500`,
                method: 'POST',
                data: [{ test: 'data' }],
                retries: 2,
                retryDelay: 100,
                retryHandler: (error, attempt) => {
                    handlerCalled = true;
                    // Return a Promise directly
                    return Promise.resolve(attempt < 1);
                }
            };

            const result = await main(config);
            expect(result.errors).toBeGreaterThan(0);
            expect(handlerCalled).toBe(true);
        });
    });

    describe('Combined async handlers', () => {
        test('both async errorHandler and retryHandler should work together', async () => {
            let errorHandlerCalled = false;
            let retryHandlerCalled = false;
            let retryCount = 0;

            const config = {
                url: `${testUrl}/status/503`,
                method: 'POST',
                data: [{ test: 'data' }],
                retries: 2,
                retryDelay: 100,
                errorHandler: async (error) => {
                    await new Promise(r => setTimeout(r, 30));
                    errorHandlerCalled = true;
                },
                retryHandler: async (error, attempt) => {
                    await new Promise(r => setTimeout(r, 30));
                    retryHandlerCalled = true;
                    retryCount++;
                    return attempt < 1;
                }
            };

            const result = await main(config);
            expect(result.errors).toBeGreaterThan(0);
            expect(errorHandlerCalled).toBe(true);
            expect(retryHandlerCalled).toBe(true);
            expect(retryCount).toBeGreaterThan(0);
        });
    });
});