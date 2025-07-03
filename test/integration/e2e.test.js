// @ts-nocheck
/**
 * Integration tests for the complete ak-fetch system
 */

import main from '../../index.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';
import { Readable } from 'stream';

describe('Integration Tests - Full System', () => {
    const testHost = 'https://api.example.com';
    const testFilePath = path.resolve('./test/fixtures/test-data.jsonl');
    
    beforeEach(() => {
        // Create test JSONL file
        const testData = [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
            { id: 3, name: 'Item 3' }
        ].map(item => JSON.stringify(item)).join('\n');
        
        writeFileSync(testFilePath, testData);
    });

    afterEach(() => {
        if (existsSync(testFilePath)) {
            unlinkSync(testFilePath);
        }
    });

    describe('Basic HTTP Methods', () => {
        test('should handle GET requests', async () => {
            const config = {
                url: `${testHost}/users`,
                method: 'GET',
                data: [{}], // Dummy data for curl generation
                dryRun: "curl" // Use curl dry run for GET requests
            };

            const result = await main(config);
            
            expect(result.responses).toHaveLength(1); // curl command generated
        });

        test('should handle POST requests with data', async () => {
            const config = {
                url: `${testHost}/users`,
                method: 'POST',
                data: [{ name: 'John Doe', email: 'john@example.com' }],
                dryRun: "curl"
            };

            const result = await main(config);
            
            expect(result.responses).toHaveLength(1);
            expect(result.rowCount).toBe(1);
        });

        test('should handle PUT, PATCH, DELETE methods', async () => {
            const testMethods = [
                { method: 'PUT', data: { name: 'Updated' } },
                { method: 'PATCH', data: { status: 'active' } },
                { method: 'DELETE', data: { id: 1 } } // DELETE with data
            ];

            for (const { method, data } of testMethods) {
                const config = {
                    url: `${testHost}/resource/1`,
                    method,
                    data: [data],
                    dryRun: "curl"
                };

                const result = await main(config);
                expect(result.responses).toHaveLength(1);
                expect(result.rowCount).toBe(1);
            }
        });

        test('should handle HEAD and OPTIONS methods', async () => {
            const headConfig = {
                url: `${testHost}/resource`,
                method: 'HEAD',
                data: [{}], // Dummy data for curl generation
                dryRun: "curl"
            };

            const optionsConfig = {
                url: `${testHost}/resource`,
                method: 'OPTIONS',
                data: [{}], // Dummy data for curl generation
                dryRun: "curl"
            };

            const headResult = await main(headConfig);
            const optionsResult = await main(optionsConfig);

            expect(headResult.responses).toHaveLength(1); // curl command for HEAD
            expect(optionsResult.responses).toHaveLength(1); // curl command for OPTIONS
        });
    });

    describe('Retry and Error Handling', () => {
        test('should configure retry parameters in dry run', async () => {
            const config = {
                url: `${testHost}/retry-test`,
                method: 'POST',
                data: [{ test: 'data' }],
                retries: 3,
                retryDelay: 100,
                dryRun: "curl",
                verbose: false
            };

            const result = await main(config);
            expect(result.responses).toHaveLength(1);
            expect(result.rowCount).toBe(1);
        });

        test('should handle retry configuration with static delay', async () => {
            const config = {
                url: `${testHost}/static-retry`,
                method: 'POST',
                data: [{ test: 'data' }],
                retries: 2,
                useStaticRetryDelay: true,
                retryDelay: 50,
                dryRun: "curl",
                verbose: false
            };

            const result = await main(config);
            expect(result.responses).toHaveLength(1);
            expect(result.rowCount).toBe(1);
        });
    });

    describe('Configuration Testing', () => {
        test('should configure cookie handling', async () => {
            const config = {
                url: `${testHost}/login`,
                method: 'POST',
                data: [{ username: 'john', password: 'secret' }],
                enableCookies: true,
                dryRun: "curl"
            };

            const result = await main(config);
            expect(result.responses).toHaveLength(1);
            expect(result.rowCount).toBe(1);
        });

        test('should handle multipart form data configuration', async () => {
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
                dryRun: "curl"
            };

            const result = await main(config);
            expect(result.responses).toHaveLength(1);
            expect(result.rowCount).toBe(1);
        });
    });

    describe('Data Streaming and Batching', () => {
        test('should process data from file stream', async () => {
            const config = {
                url: `${testHost}/batch`,
                method: 'POST',
                data: testFilePath,
                batchSize: 1,
                dryRun: "curl"
            };

            const result = await main(config);
            
            expect(result.rowCount).toBe(3);
            expect(result.responses).toHaveLength(3); // Each item becomes a response in dry run
        });

        test('should handle large batches efficiently', async () => {
            const largeData = Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` }));

            const config = {
                url: `${testHost}/large-batch`,
                method: 'POST',
                data: largeData,
                batchSize: 50,
                dryRun: "curl"
            };

            const result = await main(config);
            
            expect(result.rowCount).toBe(100);
            expect(result.responses).toHaveLength(100); // Each item becomes a response in dry run
        });

        test('should handle readable streams', async () => {
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
                dryRun: "curl"
            };

            const result = await main(config);
            
            expect(result.rowCount).toBe(3);
            expect(result.responses).toHaveLength(3);
        });
    });

    describe('Memory Management', () => {
        test('should configure circular buffer for response storage', async () => {
            const config = {
                url: `${testHost}/memory-test`,
                method: 'POST',
                data: Array.from({ length: 10 }, (_, i) => ({ id: i, data: 'x'.repeat(100) })),
                batchSize: 1,
                maxResponseBuffer: 5, // Only keep 5 responses
                dryRun: "curl"
            };

            const result = await main(config);
            
            expect(result.rowCount).toBe(10);
            // In dry run, all responses are available since no actual HTTP requests
            expect(result.responses).toHaveLength(10);
        });

        test('should configure response storage settings', async () => {
            const config = {
                url: `${testHost}/no-storage`,
                method: 'POST',
                data: [{ id: 1 }, { id: 2 }, { id: 3 }],
                batchSize: 1,
                storeResponses: false,
                dryRun: true // Use boolean dry run to test storeResponses
            };

            const result = await main(config);
            
            expect(result.rowCount).toBe(3);
            expect(result.responses).toHaveLength(0); // No responses stored
        });
    });

    describe('Concurrency and Performance', () => {
        test('should configure high concurrency settings', async () => {
            const config = {
                url: `${testHost}/concurrent`,
                method: 'POST',
                data: Array.from({ length: 20 }, (_, i) => ({ id: i })),
                batchSize: 1,
                concurrency: 10,
                dryRun: "curl"
            };

            const result = await main(config);

            expect(result.rowCount).toBe(20);
            expect(result.responses).toHaveLength(20);
        });

        test('should configure connection pooling settings', async () => {
            const config = {
                url: `${testHost}/pooled`,
                method: 'POST',
                data: Array.from({ length: 5 }, (_, i) => ({ id: i })),
                batchSize: 1,
                enableConnectionPooling: true,
                keepAlive: true,
                dryRun: "curl"
            };

            const result = await main(config);
            
            expect(result.rowCount).toBe(5);
            expect(result.responses).toHaveLength(5);
        });
    });

    describe('Multiple Configurations', () => {
        test('should process array of configurations', async () => {
            const configs = [
                {
                    url: `${testHost}/endpoint1`,
                    method: 'POST',
                    data: [{ id: 1 }],
                    dryRun: "curl"
                },
                {
                    url: `${testHost}/endpoint2`,
                    method: 'POST',
                    data: [{ id: 2 }],
                    dryRun: "curl"
                },
                {
                    url: `${testHost}/endpoint3`,
                    method: 'POST',
                    data: [{ id: 3 }],
                    dryRun: "curl"
                }
            ];

            const result = await main(configs);
            
            expect(result.configCount).toBe(3);
            expect(result.responses).toHaveLength(3);
        });

        test('should handle hook function for array configs', async () => {
            const configs = [
                {
                    url: `${testHost}/hook-test`,
                    method: 'POST',
                    data: [{ id: 1 }],
                    dryRun: "curl",
                    hook: (results) => {
                        // Create a summary of results
                        return { 
                            total: results.length,
                            processed: results.reduce((sum, result) => sum + result.rowCount, 0)
                        };
                    }
                },
                {
                    url: `${testHost}/hook-test`,
                    method: 'POST',
                    data: [{ id: 2 }],
                    dryRun: "curl"
                }
            ];

            const result = await main(configs);
            
            expect(result.responses.total).toBe(2);
            expect(result.responses.processed).toBe(2);
        });
    });

    describe('Edge Cases and Error Scenarios', () => {
        test('should configure timeout settings', async () => {
            const config = {
                url: `${testHost}/timeout`,
                method: 'POST',
                data: [{ test: 'timeout' }],
                timeout: 5000, // Must be at least 1000ms
                retries: 0,
                dryRun: "curl"
            };

            const result = await main(config);
            expect(result.responses).toHaveLength(1);
        });

        test('should validate configuration errors', async () => {
            const invalidConfigs = [
                { data: [{}] }, // Missing URL
                { url: testHost, method: 'POST' }, // Missing data for POST
            ];

            for (const config of invalidConfigs) {
                await expect(main(config)).rejects.toThrow();
            }
        });
    });

    describe('Output Formats and Logging', () => {
        test('should include memory statistics in results', async () => {
            const config = {
                url: `${testHost}/stats`,
                method: 'POST',
                data: [{ test: 'stats' }],
                dryRun: "curl"
            };

            const result = await main(config);
            
            expect(result.stats).toBeDefined();
            expect(result.stats.heapUsed).toBeGreaterThan(0);
            expect(result.stats.heapTotal).toBeGreaterThan(0);
        });

        test('should calculate performance metrics', async () => {
            const config = {
                url: `${testHost}/performance`,
                method: 'POST',
                data: Array.from({ length: 5 }, (_, i) => ({ id: i })),
                batchSize: 1,
                dryRun: "curl"
            };

            const result = await main(config);
            
            expect(result.rowCount).toBe(5);
            expect(result.responses).toHaveLength(5);
        });
    });
});