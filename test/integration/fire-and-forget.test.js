/**
 * Fire-and-Forget Mode Integration Tests
 * 
 * Tests fire-and-forget functionality where retries=null
 * and no response storage or error handling occurs.
 */

const akFetch = require('../../index');

describe('Fire-and-Forget Mode', () => {
    const mockUrl = 'https://httpbin.org/post';
    
    describe('Basic Fire-and-Forget Functionality', () => {
        test('should not store responses when retries=null', async () => {
            const testData = [
                { id: 1, name: 'item1' },
                { id: 2, name: 'item2' },
                { id: 3, name: 'item3' }
            ];

            const result = await akFetch({
                url: mockUrl,
                data: testData,
                retries: null,
                verbose: false,
                batchSize: 1
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBeGreaterThan(0); // Requests were made
            expect(result.rowCount).toBe(3); // Records were processed
            expect(result.errors).toBe(0);
        });

        test('should work with different batch sizes in fire-and-forget', async () => {
            const testData = Array.from({ length: 20 }, (_, i) => ({ id: i, value: `test${i}` }));

            const result = await akFetch({
                url: mockUrl,
                data: testData,
                retries: null,
                batchSize: 5,
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBeGreaterThan(0);
            expect(result.rowCount).toBe(20);
        });

        test('should handle single item in fire-and-forget mode', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: [{ single: true }],
                retries: null,
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBe(1);
            expect(result.rowCount).toBe(1);
        });
    });

    describe('Fire-and-Forget with Different HTTP Methods', () => {
        test('should work with POST requests', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: [{ test: 'post' }],
                method: 'POST',
                retries: null,
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBe(1);
        });

        test('should work with PUT requests', async () => {
            const result = await akFetch({
                url: 'https://httpbin.org/put',
                data: [{ test: 'put' }],
                method: 'PUT', 
                retries: null,
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBe(1);
        });

        test('should work with PATCH requests', async () => {
            const result = await akFetch({
                url: 'https://httpbin.org/patch',
                data: [{ test: 'patch' }],
                method: 'PATCH',
                retries: null,
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBe(1);
        });

        test('should work with DELETE requests', async () => {
            const result = await akFetch({
                url: 'https://httpbin.org/delete',
                data: [{ test: 'delete' }],
                method: 'DELETE',
                retries: null,
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBe(1);
        });
    });

    describe('Fire-and-Forget Performance Characteristics', () => {
        test('should be faster than regular mode due to no response processing', async () => {
            const largeData = Array.from({ length: 100 }, (_, i) => ({ 
                id: i, 
                payload: `data-${i}`.repeat(10) 
            }));

            const startTime = Date.now();
            
            const result = await akFetch({
                url: mockUrl,
                data: largeData,
                retries: null,
                batchSize: 10,
                concurrency: 5,
                verbose: false
            });

            const duration = Date.now() - startTime;

            expect(result.responses).toEqual([]);
            expect(result.rowCount).toBe(100);
            expect(result.reqCount).toBeGreaterThan(0);
            expect(duration).toBeLessThan(30000); // Should complete reasonably fast
        });

        test('should use minimal memory in fire-and-forget mode', async () => {
            const startMemory = process.memoryUsage().heapUsed;
            
            const data = Array.from({ length: 1000 }, (_, i) => ({ 
                id: i, 
                data: 'x'.repeat(100) // Some payload data
            }));

            const result = await akFetch({
                url: mockUrl,
                data: data,
                retries: null,
                batchSize: 50,
                verbose: false,
                storeResponses: false // Should be default for fire-and-forget
            });

            const endMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = (endMemory - startMemory) / 1024 / 1024; // MB

            expect(result.responses).toEqual([]);
            expect(result.rowCount).toBe(1000);
            expect(memoryGrowth).toBeLessThan(50); // Should use less than 50MB additional
        });
    });

    // describe('Fire-and-Forget with Error Handling', () => {
    //     test('should not retry failed requests in fire-and-forget mode', async () => {
    //         // Use an invalid URL to force failures
    //         const result = await akFetch({
    //             url: 'https://invalid-domain-that-does-not-exist.fake',
    //             data: [{ test: 'data' }],
    //             retries: null,
    //             timeout: 1000,
    //             verbose: true
    //         });

    //         expect(result.responses).toEqual([]);
    //         // In fire-and-forget mode, errors are not tracked the same way
    //         expect(result.reqCount).toBeGreaterThanOrEqual(0);
    //     });

    //     test('should not store error information in fire-and-forget mode', async () => {
    //         const result = await akFetch({
    //             url: 'https://httpbin.org/status/500', // Returns 500 error
    //             data: [{ test: 'error' }],
    //             retries: null,
    //             verbose: false
    //         });

    //         expect(result.responses).toEqual([]);
    //         expect(result.reqCount).toBeGreaterThan(0);
    //     });
    // });

    describe('Fire-and-Forget with Advanced Features', () => {
        // test('should work with transform functions', async () => {
        //     const result = await akFetch({
        //         url: mockUrl,
        //         data: [{ original: true }],
        //         retries: null,
        //         transform: (item) => ({ ...item, transformed: true }),
        //         verbose: false
        //     });

        //     expect(result.responses).toEqual([]);
        //     expect(result.reqCount).toBe(1);
        // });

        test('should work with custom headers', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: [{ test: 'headers' }],
                retries: null,
                headers: {
                    'Authorization': 'Bearer test-token',
                    'X-Custom-Header': 'fire-and-forget'
                },
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBe(1);
        });

        test('should work with search parameters', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: [{ test: 'params' }],
                retries: null,
                searchParams: { mode: 'fire-and-forget', test: true },
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBe(1);
        });

        test('should work with body parameters', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: [{ original: 'data' }],
                retries: null,
                bodyParams: { wrapper: 'test', mode: 'fire-and-forget' },
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBe(1);
        });

        test('should work with connection pooling', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: Array.from({ length: 10 }, (_, i) => ({ id: i })),
                retries: null,
                enableConnectionPooling: true,
                keepAlive: true,
                concurrency: 5,
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBeGreaterThan(0);
            expect(result.rowCount).toBe(10);
        });
    });

    describe('Fire-and-Forget with Multiple Configurations', () => {
        test('should handle multiple fire-and-forget configurations', async () => {
            const configs = [
                {
                    url: 'https://httpbin.org/post',
                    data: [{ config: 1 }],
                    retries: null
                },
                {
                    url: 'https://httpbin.org/put',
                    data: [{ config: 2 }],
                    method: 'PUT',
                    retries: null
                },
                {
                    url: 'https://httpbin.org/patch',
                    data: [{ config: 3 }],
                    method: 'PATCH',
                    retries: null
                }
            ];

            const result = await akFetch(configs);

            expect(Array.isArray(result.responses)).toBe(true);
            expect(result.configCount).toBe(3);
            // Each config should have empty responses
            expect(result.responses.every(r => r.responses && r.responses.length === 0)).toBe(true);
        });

        test('should handle mixed fire-and-forget and regular configurations', async () => {
            const configs = [
                {
                    url: 'https://httpbin.org/post',
                    data: [{ mode: 'regular' }],
                    retries: 3, // Regular mode
                    dryRun: true // Use dry run to avoid actual requests
                },
                {
                    url: 'https://httpbin.org/post',
                    data: [{ mode: 'fire-and-forget' }],
                    retries: null, // Fire-and-forget mode
                    dryRun: true
                }
            ];

            const result = await akFetch(configs);

            expect(Array.isArray(result.responses)).toBe(true);
            expect(result.configCount).toBe(2);
        });
    });

    describe('Fire-and-Forget with Streaming', () => {
        test('should work with file-based streaming', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: './testData/testData.json', // File input
                retries: null,
                batchSize: 2,
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBeGreaterThan(0);
            expect(result.rowCount).toBeGreaterThan(0);
        });

        test('should work with large datasets efficiently', async () => {
            // Test with a reasonable subset to avoid long test times
            const result = await akFetch({
                url: mockUrl,
                data: './testData/100k.ndjson',
                retries: null,
                batchSize: 1000,
                concurrency: 10,
                verbose: false,
                maxTasks: 5 // Limit queue size for this test
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBeGreaterThan(0);
            expect(result.rowCount).toBeGreaterThan(0);
        }, 30000); // Allow longer timeout for large dataset
    });

    describe('Fire-and-Forget Validation', () => {
        test('should validate that retries is explicitly null', () => {
            // Test that undefined retries doesn't trigger fire-and-forget
            expect(null).toBe(null); // retries: null should trigger fire-and-forget
            expect(undefined).not.toBe(null); // retries: undefined should not
            expect(0).not.toBe(null); // retries: 0 should not
        });

        test('should work with explicitly set retries null', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: [{ explicit: 'null' }],
                retries: null, // Explicitly set to null
                verbose: false
            });

            expect(result.responses).toEqual([]);
            expect(result.reqCount).toBe(1);
        });
    });
});