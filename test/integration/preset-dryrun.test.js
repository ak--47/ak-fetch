/**
 * @file Preset Dry Run Integration Test
 * @description Test preset functionality using dry run mode
 */

const akFetch = require('../../index');

describe('Preset Integration with Dry Run', () => {
    
    test('mixpanel preset transforms data in dry run', async () => {
        const testData = [{
            event: 'test_event',
            user_id: 12345,
            email: 'test@example.com',
            timestamp: '2024-01-01T00:00:00Z'
        }];

        const result = await akFetch({
            url: 'https://api.example.com/events',
            data: testData,
            preset: 'mixpanel',
            dryRun: true,
            verbose: false
        });

        expect(result.responses).toHaveLength(1);
        
        // In dry run, responses contain the transformed data
        const transformedEvent = result.responses[0];
        expect(transformedEvent.properties).toBeDefined();
        expect(transformedEvent.properties.$user_id).toBe('12345'); // Converted to string and prefixed
        expect(transformedEvent.properties.$email).toBe('test@example.com'); // Promoted to $email
        expect(typeof transformedEvent.properties.time).toBe('number'); // Timestamp converted
        expect(transformedEvent.properties.timestamp).toBeUndefined(); // Original removed
        expect(transformedEvent.properties.$insert_id).toBeDefined(); // Generated
    });

    test('preset with user transform in dry run', async () => {
        const result = await akFetch({
            url: 'https://api.example.com/events',
            data: [{ event: 'test', user_id: 12345 }],
            preset: 'mixpanel',
            transform: (item) => {
                item.properties.custom_field = 'user_added';
                return item;
            },
            dryRun: true,
            verbose: false
        });

        expect(result.responses).toHaveLength(1);
        
        const transformedEvent = result.responses[0];
        // Check preset transform applied first
        expect(transformedEvent.properties.$user_id).toBe('12345');
        // Check user transform applied after preset
        expect(transformedEvent.properties.custom_field).toBe('user_added');
    });

    test('preset with batching in dry run', async () => {
        const testData = [
            { event: 'event1', user_id: 'user1' },
            { event: 'event2', user_id: 'user2' },
            { event: 'event3', user_id: 'user3' }
        ];

        const result = await akFetch({
            url: 'https://api.example.com/events',
            data: testData,
            preset: 'mixpanel',
            batchSize: 2,
            dryRun: true,
            verbose: false
        });

        expect(result.responses).toHaveLength(3); // Individual items, not batched in dry run
        expect(result.rowCount).toBe(3);
        
        // Verify all events are transformed
        result.responses.forEach(event => {
            expect(event.properties).toBeDefined();
            expect(event.properties.$user_id).toBeDefined();
        });
    });

    test('invalid preset throws error immediately', async () => {
        await expect(akFetch({
            url: 'https://api.example.com/events',
            data: [{ event: 'test' }],
            preset: 'invalid-preset',
            dryRun: true,
            verbose: false
        })).rejects.toThrow(/Invalid preset 'invalid-preset'/);
    });

    test('preset error handling with error handler', async () => {
        let errorCaught = false;
        let errorRecord = null;

        // Use invalid data instead of null (which breaks streams)
        const result = await akFetch({
            url: 'https://api.example.com/events',
            data: [
                { event: 'valid', user_id: 123 },
                { event: 'also_valid', user_id: 456 }
            ],
            preset: 'mixpanel',
            transform: (item) => {
                if (item.event === 'valid') {
                    // Cause an error in transform
                    throw new Error('Transform error test');
                }
                return item;
            },
            errorHandler: (error, record) => {
                errorCaught = true;
                errorRecord = record;
                // Don't throw, just log
            },
            dryRun: true,
            verbose: false
        });

        expect(errorCaught).toBe(true);
        expect(errorRecord).toBeDefined();
        
        // Since error handler doesn't throw, all records should be processed
        expect(result.responses).toHaveLength(2);
        expect(result.rowCount).toBe(2);
    });
});