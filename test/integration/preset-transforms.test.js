/**
 * @file Preset Transform Integration Tests
 * @description Integration tests for preset transforms within the ak-fetch pipeline
 */

const akFetch = require('../../index');
const nock = require('nock');

describe('Preset Transform Integration', () => {
    const testUrl = 'https://api.example.com';
    
    afterEach(() => {
        nock.cleanAll();
    });

    describe('Mixpanel Preset Integration', () => {
        test('applies mixpanel preset before user transform', async () => {
            // Mock API endpoint
            nock(testUrl)
                .post('/events')
                .reply(200, (uri, requestBody) => {
                    // Verify the request body has been transformed
                    const batch = JSON.parse(requestBody);
                    expect(Array.isArray(batch)).toBe(true);
                    expect(batch.length).toBe(1);
                    
                    const event = batch[0];
                    expect(event.properties).toBeDefined();
                    expect(event.properties.$user_id).toBe('12345'); // Preset transform
                    expect(event.properties.custom_field).toBe('added_by_user_transform'); // User transform
                    
                    return { status: 'success' };
                });

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
                verbose: false
            });

            expect(result.responses).toHaveLength(1);
            expect(result.responses[0].status).toBe(200);
        });

        test('applies preset transform to file-based data', async () => {
            // Create test data file
            const testFilePath = '/tmp/test-mixpanel-data.json';
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
            
            require('fs').writeFileSync(testFilePath, JSON.stringify(testData));

            // Mock API
            nock(testUrl)
                .post('/events')
                .reply(200, (uri, requestBody) => {
                    const batch = JSON.parse(requestBody);
                    
                    // Verify both events are properly transformed
                    batch.forEach(event => {
                        expect(event.properties).toBeDefined();
                        expect(event.properties.$user_id).toBeDefined();
                        expect(typeof event.properties.timestamp).toBe('number');
                        expect(event.properties.$insert_id).toBeDefined();
                    });
                    
                    return { events_processed: batch.length };
                });

            const result = await akFetch({
                url: `${testUrl}/events`,
                data: testFilePath,
                preset: 'mixpanel',
                batchSize: 10,
                verbose: false
            });

            expect(result.rowCount).toBe(2);
            expect(result.responses[0].status).toBe(200);

            // Cleanup
            require('fs').unlinkSync(testFilePath);
        });

        test('handles preset transform errors with error handler', async () => {
            let errorHandlerCalled = false;
            let capturedError = null;

            nock(testUrl)
                .post('/events')
                .reply(200, { status: 'success' });

            const testData = [
                null, // This will cause an error in the preset transform
                { event: 'valid_event', user_id: 123 }
            ];

            const result = await akFetch({
                url: `${testUrl}/events`,
                data: testData,
                preset: 'mixpanel',
                errorHandler: (error, record) => {
                    errorHandlerCalled = true;
                    capturedError = error;
                    // Don't throw, just log and continue
                },
                verbose: false
            });

            expect(errorHandlerCalled).toBe(true);
            expect(capturedError).toBeDefined();
            expect(result.responses).toHaveLength(1); // Only valid event processed
        });

        test('preset transform works with batching', async () => {
            const batchSize = 3;
            let requestCount = 0;

            nock(testUrl)
                .post('/events')
                .times(2) // Expect 2 batches (5 items, batch size 3)
                .reply(200, (uri, requestBody) => {
                    requestCount++;
                    const batch = JSON.parse(requestBody);
                    
                    // First batch: 3 items, Second batch: 2 items
                    const expectedSize = requestCount === 1 ? 3 : 2;
                    expect(batch).toHaveLength(expectedSize);
                    
                    // Verify all items are transformed
                    batch.forEach(event => {
                        expect(event.properties).toBeDefined();
                        expect(event.properties.$user_id).toBeDefined();
                    });
                    
                    return { processed: batch.length };
                });

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
                verbose: false
            });

            expect(result.reqCount).toBe(2);
            expect(result.rowCount).toBe(5);
        });

        test('works with concurrent requests', async () => {
            const concurrency = 3;
            let requestCount = 0;

            nock(testUrl)
                .post('/events')
                .times(6) // 6 items, batch size 1, concurrency 3
                .reply(200, () => {
                    requestCount++;
                    return { status: 'ok' };
                });

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
                verbose: false
            });

            expect(result.reqCount).toBe(6);
            expect(result.rowCount).toBe(6);
            expect(requestCount).toBe(6);
        });
    });

    describe('CLI Integration', () => {
        test('CLI accepts preset parameter', async () => {
            // This test would require CLI execution, which is complex in jest
            // For now, we'll test that the CLI option is parsed correctly
            const cli = require('../../cli');
            
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
                const config = await cli();
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
            const initialMemory = process.memoryUsage();
            
            nock(testUrl)
                .post('/events')
                .times(10)
                .reply(200, { status: 'ok' });

            // Process a large dataset
            const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
                event: 'memory_test',
                user_id: `user_${i}`,
                data: 'x'.repeat(1000) // 1KB per record
            }));

            const result = await akFetch({
                url: `${testUrl}/events`,
                data: largeDataset,
                preset: 'mixpanel',
                batchSize: 100,
                concurrency: 5,
                maxResponseBuffer: 10, // Limit memory usage
                verbose: false
            });

            expect(result.rowCount).toBe(1000);
            
            // Memory should not have grown significantly
            const finalMemory = process.memoryUsage();
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // Allow for some growth but not proportional to data size
            expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
        });
    });
});