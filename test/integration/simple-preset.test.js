/**
 * @file Simple Preset Integration Test
 * @description Basic integration test for preset functionality
 */

const akFetch = require('../../index');
const nock = require('nock');

describe('Simple Preset Integration', () => {
    const testUrl = 'https://api.example.com';
    
    afterEach(() => {
        nock.cleanAll();
    });

    test('basic mixpanel preset integration', async () => {
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
                expect(event.properties.$user_id).toBe('12345'); // Preset transform applied
                
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
            verbose: false
        });

        expect(result.responses).toHaveLength(1);
        expect(result.responses[0].status).toBe(200);
        expect(result.rowCount).toBe(1);
    });

    test('preset with user transform', async () => {
        nock(testUrl)
            .post('/events')
            .reply(200, (uri, requestBody) => {
                const batch = JSON.parse(requestBody);
                const event = batch[0];
                
                // Check preset transform applied
                expect(event.properties.$user_id).toBe('12345');
                // Check user transform applied after preset
                expect(event.properties.custom_field).toBe('user_added');
                
                return { status: 'ok' };
            });

        const result = await akFetch({
            url: `${testUrl}/events`,
            data: [{ event: 'test', user_id: 12345 }],
            preset: 'mixpanel',
            transform: (item) => {
                item.properties.custom_field = 'user_added';
                return item;
            },
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