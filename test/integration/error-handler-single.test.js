// @ts-nocheck
/**
 * Integration tests for errorHandler in single request mode
 */

import akFetch from '../../index.js';

describe('Single Request Error Handling', () => {
    // Use httpbin.org which provides reliable error endpoints
    const testUrl = 'https://httpbin.org';

    describe('errorHandler callback', () => {
        test('should call errorHandler on 400 error in single request mode', async () => {
            let errorHandlerCalled = false;
            let capturedError = null;

            const config = {
                url: `${testUrl}/status/400`,
                method: 'POST',
                data: { test: 'data' },
                noBatch: true,
                timeout: 5000,
                errorHandler: (error) => {
                    errorHandlerCalled = true;
                    capturedError = error;
                }
            };

            await expect(akFetch(config)).rejects.toThrow('HTTP 400');
            
            expect(errorHandlerCalled).toBe(true);
            expect(capturedError).toBeDefined();
            expect(capturedError.statusCode).toBe(400);
            expect(capturedError.body).toBeDefined();
        }, 15000);

        test('should still throw error after calling errorHandler', async () => {
            let errorHandlerCalled = false;

            const config = {
                url: `${testUrl}/status/400`,
                method: 'POST',
                data: { test: 'data' },
                noBatch: true,
                timeout: 5000,
                errorHandler: () => {
                    errorHandlerCalled = true;
                }
            };

            await expect(akFetch(config)).rejects.toThrow('HTTP 400');
            expect(errorHandlerCalled).toBe(true);
        }, 15000);

        test('should include response body in error when errorHandler is called', async () => {
            let capturedError = null;

            const config = {
                url: `${testUrl}/status/400`,
                method: 'POST',
                data: { test: 'data' },
                noBatch: true,
                timeout: 5000,
                errorHandler: (error) => {
                    capturedError = error;
                }
            };

            await expect(akFetch(config)).rejects.toThrow();
            
            expect(capturedError).toBeDefined();
            expect(capturedError.body).toBeDefined();
            expect(capturedError.headers).toBeDefined();
            expect(capturedError.statusCode).toBe(400);
            expect(capturedError.url).toContain('/status/400');
            expect(capturedError.method).toBe('POST');
        }, 15000);
    });

    describe('error handling without errorHandler', () => {
        test('should still include response body in thrown error', async () => {
            const config = {
                url: `${testUrl}/status/400`,
                method: 'POST',
                data: { test: 'data' },
                noBatch: true,
                timeout: 5000
            };

            try {
                await akFetch(config);
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error.statusCode).toBe(400);
                expect(error.body).toBeDefined();
                expect(error.headers).toBeDefined();
                expect(error.url).toContain('/status/400');
                expect(error.method).toBe('POST');
            }
        }, 15000);
    });
});