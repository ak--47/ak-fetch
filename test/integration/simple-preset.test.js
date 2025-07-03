// @ts-nocheck
/**
 * @file Simple Preset Integration Test
 * @description Basic integration test for preset functionality
 */

import akFetch from '../../index.js';

describe('Simple Preset Integration', () => {
    const testUrl = 'https://api.example.com';

    test('basic mixpanel preset integration', async () => {
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

        // In dry run mode, check that data was transformed properly
        expect(result.responses).toHaveLength(1);
        expect(result.rowCount).toBe(1);
        
        // The dry run response should contain the transformed data
        const dryRunData = result.responses[0];
        expect(dryRunData).toBeDefined();
    });

    test('preset with user transform', async () => {
        const result = await akFetch({
            url: `${testUrl}/events`,
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
        expect(result.rowCount).toBe(1);
    });

    test('invalid preset throws error', async () => {
        await expect(akFetch({
            url: `${testUrl}/events`,
            data: [{ event: 'test' }],
            preset: 'invalid-preset',
            verbose: false
        })).rejects.toThrow(/Invalid preset 'invalid-preset'/);
    });
});