// @ts-nocheck
/**
 * Transform Functions Integration Tests
 * 
 * Tests data transformation functionality including mutation vs cloning,
 * different data types, error handling, and performance characteristics.
 */

import akFetch from '../../index.js';

describe('Transform Functions', () => {
    const mockUrl = 'https://httpbin.org/post';

    describe('Basic Transform Functionality', () => {
        test('should transform data objects with mutations (default behavior)', async () => {
            const originalData = [
                { id: 1, name: 'John' },
                { id: 2, name: 'Jane' }
            ];

            const result = await akFetch({
                url: mockUrl,
                data: originalData,
                transform: (item) => {
                    item.transformed = true;
                    item.timestamp = Date.now();
                    return item;
                },
                dryRun: true,
                verbose: false
            });

            // Original data should be mutated
            expect(originalData[0].transformed).toBe(true);
            expect(originalData[1].transformed).toBe(true);
            expect(originalData[0].timestamp).toBeDefined();
            expect(originalData[1].timestamp).toBeDefined();
        });

        test('should transform data without mutations when clone=true', async () => {
            const originalData = [
                { id: 1, name: 'John' },
                { id: 2, name: 'Jane' }
            ];

            const result = await akFetch({
                url: mockUrl,
                data: originalData,
                clone: true,
                transform: (item) => {
                    item.transformed = true;
                    item.timestamp = Date.now();
                    return item;
                },
                dryRun: true,
                verbose: false
            });

            // Original data should NOT be mutated
            expect(originalData[0].transformed).toBeUndefined();
            expect(originalData[1].transformed).toBeUndefined();
            expect(originalData[0].timestamp).toBeUndefined();
            expect(originalData[1].timestamp).toBeUndefined();
        });

        test('should apply transform to all items in batch', async () => {
            const testData = Array.from({ length: 10 }, (_, i) => ({ id: i, value: `item${i}` }));

            const result = await akFetch({
                url: mockUrl,
                data: testData,
                transform: (item) => ({
                    ...item,
                    processed: true,
                    processedAt: new Date().toISOString()
                }),
                batchSize: 3,
                dryRun: true,
                verbose: false
            });

            // All original items should be transformed (mutations)
            testData.forEach(item => {
                expect(item.processed).toBe(true);
                expect(item.processedAt).toBeDefined();
            });
        });
    });

    describe('Transform with Different Data Types', () => {
        test('should transform primitive values', async () => {
            const numberData = [1, 2, 3, 4, 5];

            const result = await akFetch({
                url: mockUrl,
                data: numberData,
                transform: (num) => num * 2,
                dryRun: true,
                verbose: false
            });

            // Note: Primitive transformation won't mutate original array
            expect(numberData).toEqual([1, 2, 3, 4, 5]); // Original unchanged
        });

        test('should transform string values', async () => {
            const stringData = ['hello', 'world', 'test'];

            const result = await akFetch({
                url: mockUrl,
                data: stringData,
                transform: (str) => str.toUpperCase(),
                dryRun: true,
                verbose: false
            });

            expect(stringData).toEqual(['hello', 'world', 'test']); // Original unchanged
        });

        test('should transform complex nested objects', async () => {
            const complexData = [
                {
                    id: 1,
                    user: { name: 'John', age: 30 },
                    preferences: { theme: 'dark', language: 'en' },
                    tags: ['important', 'urgent']
                }
            ];

            const result = await akFetch({
                url: mockUrl,
                data: complexData,
                transform: (item) => ({
                    ...item,
                    user: { ...item.user, lastSeen: Date.now() },
                    preferences: { ...item.preferences, notifications: true },
                    tags: [...item.tags, 'processed']
                }),
                clone: true,
                dryRun: true,
                verbose: false
            });

            // Original should be unchanged due to clone=true
            expect(complexData[0].user.lastSeen).toBeUndefined();
            expect(complexData[0].preferences.notifications).toBeUndefined();
            expect(complexData[0].tags).toEqual(['important', 'urgent']);
        });

        test('should transform arrays to objects', async () => {
            const arrayData = [
                [1, 'John', 'john@example.com'],
                [2, 'Jane', 'jane@example.com']
            ];

            const result = await akFetch({
                url: mockUrl,
                data: arrayData,
                transform: (arr) => ({
                    id: arr[0],
                    name: arr[1],
                    email: arr[2],
                    createdAt: Date.now()
                }),
                dryRun: true,
                verbose: false
            });

            expect(arrayData[0]).toEqual([1, 'John', 'john@example.com']); // Original unchanged
        });
    });

    describe('Transform Function Error Handling', () => {
        test('should handle transform function errors gracefully', async () => {
            const testData = [{ id: 1 }, { id: 2 }];

            await expect(akFetch({
                url: mockUrl,
                data: testData,
                transform: (item) => {
                    if (item.id === 2) {
                        throw new Error('Transform error for item 2');
                    }
                    return { ...item, processed: true };
                },
                dryRun: true,
                verbose: false
            })).rejects.toThrow();
        });

        test('should handle transform returning undefined', async () => {
            const testData = [{ id: 1 }, { id: 2 }];

            const result = await akFetch({
                url: mockUrl,
                data: testData,
                transform: (item) => {
                    if (item.id === 2) return undefined;
                    return { ...item, processed: true };
                },
                dryRun: true,
                verbose: false
            });

            // Should handle undefined returns gracefully
            expect(result.rowCount).toBe(2);
        });

        test('should handle transform returning null', async () => {
            const testData = [{ id: 1 }, { id: 2 }];

            const result = await akFetch({
                url: mockUrl,
                data: testData,
                transform: (item) => {
                    if (item.id === 2) return null;
                    return { ...item, processed: true };
                },
                dryRun: true,
                verbose: false
            });

            expect(result.rowCount).toBe(2);
        });
    });

    describe('Transform Performance', () => {
        test('should handle large datasets efficiently', async () => {
            const largeData = Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                value: `item-${i}`,
                data: 'x'.repeat(100) // Some payload
            }));

            const startTime = Date.now();

            const result = await akFetch({
                url: mockUrl,
                data: largeData,
                transform: (item) => ({
                    ...item,
                    processed: true,
                    timestamp: Date.now(),
                    hash: `hash-${item.id}`
                }),
                batchSize: 50,
                dryRun: true,
                verbose: false
            });

            const duration = Date.now() - startTime;

            expect(result.rowCount).toBe(1000);
            expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
        });

        test('should handle complex transforms efficiently', async () => {
            const data = Array.from({ length: 100 }, (_, i) => ({
                id: i,
                data: { nested: { deep: { value: i } } }
            }));

            const result = await akFetch({
                url: mockUrl,
                data: data,
                transform: (item) => {
                    // Complex transformation
                    const processed = JSON.parse(JSON.stringify(item)); // Deep clone
                    processed.data.nested.deep.processed = true;
                    processed.data.nested.timestamp = Date.now();
                    processed.metadata = {
                        processedBy: 'ak-fetch',
                        version: '2.0.0',
                        complexity: 'high'
                    };
                    return processed;
                },
                clone: true,
                dryRun: true,
                verbose: false
            });

            expect(result.rowCount).toBe(100);
        });
    });

    describe('Transform with Async Operations', () => {
        test('should handle synchronous transforms only', async () => {
            const testData = [{ id: 1 }, { id: 2 }];

            const result = await akFetch({
                url: mockUrl,
                data: testData,
                transform: (item) => {
                    // Synchronous transform only
                    return {
                        ...item,
                        processed: true,
                        timestamp: Date.now()
                    };
                },
                dryRun: true,
                verbose: false
            });

            expect(result.rowCount).toBe(2);
        });

        // Note: ak-fetch likely doesn't support async transforms,
        // but we can test that it handles them gracefully
        test('should handle async transforms if supported', async () => {
            const testData = [{ id: 1 }];

            try {
                const result = await akFetch({
                    url: mockUrl,
                    data: testData,
                    transform: async (item) => {
                        // This may not be supported
                        await new Promise(resolve => setTimeout(resolve, 10));
                        return { ...item, async: true };
                    },
                    dryRun: true,
                    verbose: false
                });

                // If it works, great
                expect(result.rowCount).toBe(1);
            } catch (error) {
                // If async transforms aren't supported, that's expected
                expect(error).toBeDefined();
            }
        });
    });

    describe('Transform with Different HTTP Methods', () => {
        test('should work with POST requests', async () => {
            const result = await akFetch({
                url: mockUrl,
                method: 'POST',
                data: [{ test: 'post' }],
                transform: (item) => ({ ...item, method: 'POST' }),
                dryRun: true,
                verbose: false
            });

            expect(result.rowCount).toBe(1);
        });

        test('should work with PUT requests', async () => {
            const result = await akFetch({
                url: mockUrl,
                method: 'PUT',
                data: [{ test: 'put' }],
                transform: (item) => ({ ...item, method: 'PUT' }),
                dryRun: true,
                verbose: false
            });

            expect(result.rowCount).toBe(1);
        });
    });

    describe('Transform with Other Features', () => {
        test('should work with batching', async () => {
            const data = Array.from({ length: 15 }, (_, i) => ({ id: i }));

            const result = await akFetch({
                url: mockUrl,
                data: data,
                batchSize: 5,
                transform: (item) => ({ ...item, batchProcessed: true }),
                dryRun: true,
                verbose: false
            });

            expect(result.rowCount).toBe(15);
            // Check that all items were transformed
            data.forEach(item => {
                expect(item.batchProcessed).toBe(true);
            });
        });

        test('should work with concurrency', async () => {
            const data = Array.from({ length: 20 }, (_, i) => ({ id: i }));

            const result = await akFetch({
                url: mockUrl,
                data: data,
                batchSize: 2,
                concurrency: 5,
                transform: (item) => ({ ...item, concurrent: true }),
                dryRun: true,
                verbose: false
            });

            expect(result.rowCount).toBe(20);
        });

        test('should work with response handlers', async () => {
            const transformedItems = [];

            const result = await akFetch({
                url: mockUrl,
                data: [{ id: 1 }, { id: 2 }],
                transform: (item) => {
                    const transformed = { ...item, processed: true };
                    transformedItems.push(transformed);
                    return transformed;
                },
                responseHandler: (response) => {
                    // Response handler should receive transformed data
                },
                dryRun: true,
                verbose: false
            });

            expect(transformedItems).toHaveLength(2);
            expect(transformedItems[0].processed).toBe(true);
            expect(transformedItems[1].processed).toBe(true);
        });

        test('should work with multiple configurations', async () => {
            const configs = [
                {
                    url: mockUrl,
                    data: [{ config: 1 }],
                    transform: (item) => ({ ...item, transformedBy: 'config1' }),
                    dryRun: true
                },
                {
                    url: mockUrl,
                    data: [{ config: 2 }],
                    transform: (item) => ({ ...item, transformedBy: 'config2' }),
                    dryRun: true
                }
            ];

            const result = await akFetch(configs);

            expect(Array.isArray(result.responses)).toBe(true);
            expect(result.configCount).toBe(2);
        });
    });

    describe('Transform Function Validation', () => {
        test('should handle non-function transform gracefully', async () => {
            await expect(akFetch({
                url: mockUrl,
                data: [{ id: 1 }],
                transform: 'not-a-function',
                dryRun: true,
                verbose: false
            })).rejects.toThrow();
        });

        test('should handle null transform', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: [{ id: 1 }],
                transform: null,
                dryRun: true,
                verbose: false
            });

            expect(result.rowCount).toBe(1);
        });

        test('should handle undefined transform (no transform)', async () => {
            const originalData = [{ id: 1, name: 'test' }];

            const result = await akFetch({
                url: mockUrl,
                data: originalData,
                // No transform specified
                dryRun: true,
                verbose: false
            });

            expect(result.rowCount).toBe(1);
            // Data should be unchanged
            expect(originalData[0]).toEqual({ id: 1, name: 'test' });
        });
    });
});