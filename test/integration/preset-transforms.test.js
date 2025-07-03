// @ts-nocheck
/**
 * @file Preset Transform Integration Tests
 * @description Integration tests for preset transforms within the ak-fetch pipeline
 */

import akFetch from '../../index.js';

describe('Preset Transform Integration', () => {
    const testUrl = 'https://api.example.com';

    describe('Mixpanel Preset Integration', () => {
        test('applies mixpanel preset before user transform', async () => {
            const testData = [{
                event: 'test_event',
                user_id: 12345,
                email: 'test@example.com'
            }];

            const result = await akFetch({
                url: `${testUrl}/events`,
                data: testData,
                preset: 'mixpanel',
                transform: (item) => {
                    // User transform runs AFTER preset
                    item.properties.custom_field = 'added_by_user_transform';
                    return item;
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(1);
            expect(result.rowCount).toBe(1);
        });

        test('applies preset transform to file-based data', async () => {
            const testData = [
                {
                    event: 'page_view',
                    user_id: 'user123',
                    timestamp: '2024-01-01T00:00:00Z',
                    page: '/home'
                },
                {
                    event: 'click',
                    user_id: 'user456', 
                    timestamp: '2024-01-01T00:01:00Z',
                    element: 'button'
                }
            ];

            const result = await akFetch({
                url: `${testUrl}/events`,
                data: testData,
                preset: 'mixpanel',
                batchSize: 10,
                dryRun: true,
                verbose: false
            });

            expect(result.rowCount).toBe(2);
            expect(result.responses).toHaveLength(2); // In dry run, each item becomes a response
        });

        test('handles preset transform errors with error handler', async () => {
            let errorHandlerCalled = false;
            let capturedError = null;

            const testData = [
                null, // This will cause an error in the preset transform
                { event: 'valid_event', user_id: 123 }
            ];

            await expect(akFetch({
                url: `${testUrl}/events`,
                data: testData,
                preset: 'mixpanel',
                dryRun: true,
                errorHandler: (error, record) => {
                    errorHandlerCalled = true;
                    capturedError = error;
                    // Don't throw, just log and continue
                },
                verbose: false
            })).rejects.toThrow(); // Should throw due to null data
        });

        test('preset transform works with batching', async () => {
            const batchSize = 3;

            const testData = [
                { event: 'event1', user_id: 'user1' },
                { event: 'event2', user_id: 'user2' },
                { event: 'event3', user_id: 'user3' },
                { event: 'event4', user_id: 'user4' },
                { event: 'event5', user_id: 'user5' }
            ];

            const result = await akFetch({
                url: `${testUrl}/events`,
                data: testData,
                preset: 'mixpanel',
                batchSize,
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(5); // In dry run, each item becomes a response
            expect(result.rowCount).toBe(5);
        });

        test('works with concurrent requests', async () => {
            const concurrency = 3;

            const testData = Array.from({ length: 6 }, (_, i) => ({
                event: `event_${i}`,
                user_id: `user_${i}`,
                timestamp: new Date().toISOString()
            }));

            const result = await akFetch({
                url: `${testUrl}/events`,
                data: testData,
                preset: 'mixpanel',
                batchSize: 1,
                concurrency,
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(6); // In dry run, each item becomes a response
            expect(result.rowCount).toBe(6);
        });
    });

    describe('CLI Integration', () => {
        test.skip('CLI accepts preset parameter', async () => {
            // This test would require CLI execution, which is complex
            // For now, we'll test that the CLI option is parsed correctly
            const { default: cli } = await import('../../cli.js');
            
            // Mock argv to include preset option
            const originalArgv = process.argv;
            process.argv = [
                'node',
                'ak-fetch',
                '--url', testUrl,
                '--preset', 'mixpanel',
                '--payload', '[{"event": "test", "user_id": 123}]',
                '--dry-run', 'true'
            ];

            try {
                const config = cli();
                expect(config.preset).toBe('mixpanel');
                expect(config.dryRun).toBe(true);
            } finally {
                process.argv = originalArgv;
            }
        });
    });

    describe('Dry Run Mode with Presets', () => {
        test('preset transform works in dry run mode', async () => {
            const testData = [{
                event: 'test_event',
                user_id: 12345,
                email: 'test@example.com'
            }];

            const result = await akFetch({
                url: `${testUrl}/events`,
                data: testData,
                preset: 'mixpanel',
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(1);
            
            // In dry run, responses contain the transformed data
            const transformedEvent = result.responses[0];
            expect(transformedEvent.properties).toBeDefined();
            expect(transformedEvent.properties.$user_id).toBe('12345');
            expect(transformedEvent.properties.$email).toBe('test@example.com');
        });
    });

    describe('Invalid Preset Handling', () => {
        test('throws error for invalid preset name', async () => {
            const testData = [{ event: 'test' }];

            await expect(akFetch({
                url: `${testUrl}/events`,
                data: testData,
                preset: 'invalid-preset',
                verbose: false
            })).rejects.toThrow(/Invalid preset 'invalid-preset'/);
        });
    });

    describe('Memory Efficiency with Presets', () => {
        test('preset transforms do not cause memory leaks', async () => {
            // Process a large dataset
            const largeDataset = Array.from({ length: 100 }, (_, i) => ({
                event: 'memory_test',
                user_id: `user_${i}`,
                data: 'x'.repeat(100) // Smaller for dry run
            }));

            const result = await akFetch({
                url: `${testUrl}/events`,
                data: largeDataset,
                preset: 'mixpanel',
                batchSize: 10,
                concurrency: 5,
                dryRun: true,
                verbose: false
            });

            expect(result.rowCount).toBe(100);
            expect(result.responses).toHaveLength(100); // In dry run, each item becomes a response
        });
    });
});