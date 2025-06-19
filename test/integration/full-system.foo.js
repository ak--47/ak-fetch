/**
 * Integration tests for the complete ak-fetch system
 */

const nock = require('nock');
const main = require('../../index');
const { createReadStream, writeFileSync, unlinkSync, existsSync } = require('fs');
const path = require('path');
const { Readable } = require('stream');

describe('Integration Tests - Full System', () => {
    const testHost = 'https://api.example.com';
    const testFilePath = path.join(__dirname, '../fixtures/test-data.jsonl');
    
    beforeEach(() => {
        // Clean up any existing nock interceptors
        nock.cleanAll();
        
        // Create test JSONL file
        const testData = [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
            { id: 3, name: 'Item 3' }
        ].map(item => JSON.stringify(item)).join('\n');
        
        writeFileSync(testFilePath, testData);
    });

    afterEach(() => {
        nock.cleanAll();
        if (existsSync(testFilePath)) {
            unlinkSync(testFilePath);
        }
    });

    describe('Basic HTTP Methods', () => {
        test('should handle GET requests', async () => {
            nock(testHost)
                .get('/users')
                .reply(200, { users: [] });

            const config = {
                url: `${testHost}/users`,
                method: 'GET',
                storeResponses: true
            };

            const result = await main(config);
            
            expect(result.responses).toHaveLength(1);
            expect(result.responses[0].data).toEqual({ users: [] });
            expect(result.reqCount).toBe(1);
        });

        test('should handle POST requests with data', async () => {
            nock(testHost)
                .post('/users', { name: 'John Doe', email: 'john@example.com' })
                .reply(201, { id: 1, name: 'John Doe', email: 'john@example.com' });

            const config = {
                url: `${testHost}/users`,
                method: 'POST',
                data: [{ name: 'John Doe', email: 'john@example.com' }],
                storeResponses: true
            };

            const result = await main(config);
            
            expect(result.responses).toHaveLength(1);
            expect(result.responses[0].data.id).toBe(1);
        });

        test('should handle PUT, PATCH, DELETE methods', async () => {
            const testMethods = [
                { method: 'PUT', data: { name: 'Updated' } },
                { method: 'PATCH', data: { status: 'active' } },
                { method: 'DELETE', data: null }
            ];

            for (const { method, data } of testMethods) {
                nock(testHost)
                    .intercept('/resource/1', method.toLowerCase())
                    .reply(200, { success: true });

                const config = {
                    url: `${testHost}/resource/1`,
                    method,
                    data: data ? [data] : undefined,
                    storeResponses: true
                };

                const result = await main(config);
                expect(result.responses[0].data.success).toBe(true);
            }
        });

        test('should handle HEAD and OPTIONS methods', async () => {
            nock(testHost)
                .head('/resource')
                .reply(200, '', { 'content-length': '100' });

            nock(testHost)
                .options('/resource')
                .reply(200, '', { 'allow': 'GET,POST,PUT,DELETE' });

            const headConfig = {
                url: `${testHost}/resource`,
                method: 'HEAD',
                responseHeaders: true,
                storeResponses: true
            };

            const optionsConfig = {
                url: `${testHost}/resource`,
                method: 'OPTIONS',
                responseHeaders: true,
                storeResponses: true
            };

            const headResult = await main(headConfig);
            const optionsResult = await main(optionsConfig);

            expect(headResult.responses[0].headers['content-length']).toBe('100');
            expect(optionsResult.responses[0].headers.allow).toBe('GET,POST,PUT,DELETE');
        });
    });

    describe('Retry and Error Handling', () => {
        test('should retry on 5xx errors with exponential backoff', async () => {
            nock(testHost)
                .post('/retry-test')
                .reply(500, 'Internal Server Error')
                .post('/retry-test')
                .reply(500, 'Internal Server Error')
                .post('/retry-test')
                .reply(200, { success: true });

            const config = {
                url: `${testHost}/retry-test`,
                method: 'POST',
                data: [{ test: 'data' }],
                retries: 3,
                retryDelay: 100,
                storeResponses: true,
                verbose: false
            };

            const startTime = Date.now();
            const result = await main(config);
            const endTime = Date.now();

            expect(result.responses[0].data.success).toBe(true);
            expect(endTime - startTime).toBeGreaterThan(200); // Should have delays
        });

        test('should handle rate limiting with Retry-After header', async () => {
            nock(testHost)
                .post('/rate-limited')
                .reply(429, 'Rate Limited', { 'retry-after': '1' })
                .post('/rate-limited')
                .reply(200, { success: true });

            const config = {
                url: `${testHost}/rate-limited`,
                method: 'POST',
                data: [{ test: 'data' }],
                retries: 2,
                storeResponses: true,
                verbose: false
            };

            const result = await main(config);
            expect(result.responses[0].data.success).toBe(true);
        });

        test('should use static retry delay when configured', async () => {
            nock(testHost)
                .post('/static-retry')
                .reply(500, 'Error')
                .post('/static-retry')
                .reply(200, { success: true });

            const config = {
                url: `${testHost}/static-retry`,
                method: 'POST',
                data: [{ test: 'data' }],
                retries: 2,
                useStaticRetryDelay: true,
                retryDelay: 50,
                storeResponses: true,
                verbose: false
            };

            const startTime = Date.now();
            const result = await main(config);
            const endTime = Date.now();

            expect(result.responses[0].data.success).toBe(true);
            expect(endTime - startTime).toBeGreaterThanOrEqual(45);
            expect(endTime - startTime).toBeLessThan(200); // Should be close to static delay
        });
    });

    describe('Cookie Handling', () => {
        test('should handle cookies across requests', async () => {
            nock(testHost)
                .post('/login')
                .reply(200, { success: true }, { 'set-cookie': ['session=abc123; Path=/'] })
                .get('/profile')
                .matchHeader('cookie', 'session=abc123')
                .reply(200, { username: 'john' });

            // First request to set cookie
            const loginConfig = {
                url: `${testHost}/login`,
                method: 'POST',
                data: [{ username: 'john', password: 'secret' }],
                enableCookies: true,
                storeResponses: true
            };

            await main(loginConfig);

            // Second request should include cookie
            const profileConfig = {
                url: `${testHost}/profile`,
                method: 'GET',
                enableCookies: true,
                storeResponses: true
            };

            const result = await main(profileConfig);
            expect(result.responses[0].data.username).toBe('john');
        });
    });

    describe('Form Data and File Uploads', () => {
        test('should handle multipart form data', async () => {
            nock(testHost)
                .post('/upload')
                .reply(200, { uploaded: true });

            const config = {
                url: `${testHost}/upload`,
                method: 'POST',
                data: [{
                    name: 'John',
                    file: {
                        data: 'file content',
                        filename: 'test.txt',
                        contentType: 'text/plain'
                    }
                }],
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                storeResponses: true
            };

            const result = await main(config);
            expect(result.responses[0].data.uploaded).toBe(true);
        });

        test('should handle file uploads from filesystem', async () => {
            nock(testHost)
                .post('/file-upload')
                .reply(200, { fileReceived: true });

            const config = {
                url: `${testHost}/file-upload`,
                method: 'POST',
                data: [{
                    description: 'Test file',
                    file: testFilePath
                }],
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                storeResponses: true
            };

            const result = await main(config);
            expect(result.responses[0].data.fileReceived).toBe(true);
        });
    });

    describe('Data Streaming and Batching', () => {
        test('should process data from file stream', async () => {
            nock(testHost)
                .post('/batch')
                .times(3)
                .reply(200, { processed: true });

            const config = {
                url: `${testHost}/batch`,
                method: 'POST',
                data: testFilePath,
                batchSize: 1,
                storeResponses: true
            };

            const result = await main(config);
            
            expect(result.reqCount).toBe(3);
            expect(result.rowCount).toBe(3);
            expect(result.responses).toHaveLength(3);
        });

        test('should handle large batches efficiently', async () => {
            nock(testHost)
                .post('/large-batch')
                .reply(200, { processed: true });

            const largeData = Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` }));

            const config = {
                url: `${testHost}/large-batch`,
                method: 'POST',
                data: largeData,
                batchSize: 50,
                storeResponses: true
            };

            const result = await main(config);
            
            expect(result.reqCount).toBe(2); // 100 items / 50 batch size = 2 requests
            expect(result.rowCount).toBe(100);
        });

        test('should handle readable streams', async () => {
            nock(testHost)
                .post('/stream')
                .times(3)
                .reply(200, { received: true });

            const dataStream = Readable.from([
                { id: 1, name: 'stream-1' },
                { id: 2, name: 'stream-2' },
                { id: 3, name: 'stream-3' }
            ]);

            const config = {
                url: `${testHost}/stream`,
                method: 'POST',
                data: dataStream,
                batchSize: 1,
                storeResponses: true
            };

            const result = await main(config);
            
            expect(result.reqCount).toBe(3);
            expect(result.responses).toHaveLength(3);
        });
    });

    describe('Memory Management', () => {
        test('should use circular buffer for response storage', async () => {
            nock(testHost)
                .post('/memory-test')
                .times(10)
                .reply(200, { id: 1, data: 'x'.repeat(1000) }); // Large responses

            const config = {
                url: `${testHost}/memory-test`,
                method: 'POST',
                data: Array.from({ length: 10 }, (_, i) => ({ id: i })),
                batchSize: 1,
                maxResponseBuffer: 5, // Only keep 5 responses
                storeResponses: true
            };

            const result = await main(config);
            
            expect(result.reqCount).toBe(10);
            expect(result.responses).toHaveLength(5); // Should only keep last 5
        });

        test('should disable response storage when configured', async () => {
            nock(testHost)
                .post('/no-storage')
                .times(3)
                .reply(200, { processed: true });

            const config = {
                url: `${testHost}/no-storage`,
                method: 'POST',
                data: [{ id: 1 }, { id: 2 }, { id: 3 }],
                batchSize: 1,
                storeResponses: false
            };

            const result = await main(config);
            
            expect(result.reqCount).toBe(3);
            expect(result.responses).toHaveLength(0); // No responses stored
        });
    });

    describe('Concurrency and Performance', () => {
        test('should handle high concurrency', async () => {
            nock(testHost)
                .post('/concurrent')
                .times(20)
                .delay(50) // Add delay to simulate real network
                .reply(200, { success: true });

            const config = {
                url: `${testHost}/concurrent`,
                method: 'POST',
                data: Array.from({ length: 20 }, (_, i) => ({ id: i })),
                batchSize: 1,
                concurrency: 10,
                storeResponses: true
            };

            const startTime = Date.now();
            const result = await main(config);
            const endTime = Date.now();

            expect(result.reqCount).toBe(20);
            expect(result.rps).toBeGreaterThan(0);
            
            // With concurrency 10 and 50ms delay, should be much faster than sequential
            expect(endTime - startTime).toBeLessThan(500);
        });

        test('should respect connection pooling', async () => {
            nock(testHost)
                .post('/pooled')
                .times(5)
                .reply(200, { pooled: true });

            const config = {
                url: `${testHost}/pooled`,
                method: 'POST',
                data: Array.from({ length: 5 }, (_, i) => ({ id: i })),
                batchSize: 1,
                enableConnectionPooling: true,
                keepAlive: true,
                storeResponses: true
            };

            const result = await main(config);
            
            expect(result.reqCount).toBe(5);
            expect(result.responses).toHaveLength(5);
        });
    });

    describe('Multiple Configurations', () => {
        test('should process array of configurations', async () => {
            nock(testHost)
                .post('/endpoint1')
                .reply(200, { endpoint: 1 })
                .post('/endpoint2')
                .reply(200, { endpoint: 2 })
                .post('/endpoint3')
                .reply(200, { endpoint: 3 });

            const configs = [
                {
                    url: `${testHost}/endpoint1`,
                    method: 'POST',
                    data: [{ id: 1 }],
                    storeResponses: true
                },
                {
                    url: `${testHost}/endpoint2`,
                    method: 'POST',
                    data: [{ id: 2 }],
                    storeResponses: true
                },
                {
                    url: `${testHost}/endpoint3`,
                    method: 'POST',
                    data: [{ id: 3 }],
                    storeResponses: true
                }
            ];

            const result = await main(configs);
            
            expect(result.configCount).toBe(3);
            expect(result.responses).toHaveLength(3);
        });

        test('should handle hook function for array configs', async () => {
            nock(testHost)
                .post('/hook-test')
                .times(2)
                .reply(200, { value: 10 });

            const configs = [
                {
                    url: `${testHost}/hook-test`,
                    method: 'POST',
                    data: [{ id: 1 }],
                    storeResponses: true,
                    hook: (results) => {
                        // Sum all values
                        const total = results.reduce((sum, result) => {
                            return sum + (result.responses?.[0]?.data?.value || 0);
                        }, 0);
                        return { total };
                    }
                },
                {
                    url: `${testHost}/hook-test`,
                    method: 'POST',
                    data: [{ id: 2 }],
                    storeResponses: true
                }
            ];

            const result = await main(configs);
            
            expect(result.responses.total).toBe(20); // 10 + 10 from hook
        });
    });

    describe('Edge Cases and Error Scenarios', () => {
        test('should handle network timeouts', async () => {
            nock(testHost)
                .post('/timeout')
                .delay(200)
                .reply(200, { success: true });

            const config = {
                url: `${testHost}/timeout`,
                method: 'POST',
                data: [{ test: 'timeout' }],
                timeout: 100, // Shorter than delay
                retries: 0,
                storeResponses: true
            };

            await expect(main(config)).rejects.toThrow();
        });

        test('should handle malformed JSON responses', async () => {
            nock(testHost)
                .post('/malformed')
                .reply(200, 'not json{', { 'content-type': 'application/json' });

            const config = {
                url: `${testHost}/malformed`,
                method: 'POST',
                data: [{ test: 'malformed' }],
                storeResponses: true
            };

            const result = await main(config);
            
            // Should handle as text when JSON parsing fails
            expect(typeof result.responses[0].data).toBe('string');
        });

        test('should handle empty responses', async () => {
            nock(testHost)
                .post('/empty')
                .reply(204); // No content

            const config = {
                url: `${testHost}/empty`,
                method: 'POST',
                data: [{ test: 'empty' }],
                storeResponses: true
            };

            const result = await main(config);
            
            expect(result.responses[0].status).toBe(204);
        });

        test('should validate configuration errors', async () => {
            const invalidConfigs = [
                { data: [{}] }, // Missing URL
                { url: testHost, method: 'POST' }, // Missing data for POST
                { url: testHost, data: [{}], batchSize: -1 }, // Invalid batch size
                { url: testHost, data: [{}], concurrency: 0 }, // Invalid concurrency
                { url: testHost, data: [{}], timeout: 500 } // Invalid timeout
            ];

            for (const config of invalidConfigs) {
                await expect(main(config)).rejects.toThrow();
            }
        });
    });

    describe('Output Formats and Logging', () => {
        test('should include memory statistics in results', async () => {
            nock(testHost)
                .post('/stats')
                .reply(200, { data: 'test' });

            const config = {
                url: `${testHost}/stats`,
                method: 'POST',
                data: [{ test: 'stats' }],
                storeResponses: true
            };

            const result = await main(config);
            
            expect(result.stats).toBeDefined();
            expect(result.stats.heapUsed).toBeGreaterThan(0);
            expect(result.stats.heapTotal).toBeGreaterThan(0);
        });

        test('should calculate performance metrics', async () => {
            nock(testHost)
                .post('/performance')
                .times(5)
                .reply(200, { success: true });

            const config = {
                url: `${testHost}/performance`,
                method: 'POST',
                data: Array.from({ length: 5 }, (_, i) => ({ id: i })),
                batchSize: 1,
                storeResponses: true
            };

            const result = await main(config);
            
            expect(result.duration).toBeGreaterThan(0);
            expect(result.clockTime).toContain('second');
            expect(result.rps).toBeGreaterThan(0);
            expect(result.reqCount).toBe(5);
            expect(result.rowCount).toBe(5);
        });
    });
});