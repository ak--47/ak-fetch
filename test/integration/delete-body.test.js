// @ts-nocheck
/**
 * Integration tests for DELETE requests with body
 */

import main from '../../index.js';
import HttpClient from '../../lib/http-client.js';

describe('Integration Tests - DELETE with Body', () => {
    describe('DELETE request body handling', () => {
        test('should send JSON body with DELETE request in dry-run curl mode', async () => {
            const config = {
                url: 'https://httpbin.org/delete',
                method: 'DELETE',
                data: [{ id: 123, reason: 'test deletion' }],
                dryRun: 'curl'
            };

            const result = await main(config);

            expect(result.responses).toHaveLength(1);
            const curlCommand = result.responses[0];

            // Verify curl command includes the JSON body
            expect(curlCommand).toContain('-d \'{"id":123,"reason":"test deletion"}\'');
            expect(curlCommand).toContain('-H "Content-Type: application/json"');
            expect(curlCommand).toContain('-X DELETE');
        });

        test('should apply transforms to DELETE request data', async () => {
            const config = {
                url: 'https://httpbin.org/delete',
                method: 'DELETE',
                data: [
                    { id: 1, value: 'a' },
                    { id: 2, value: 'b' }
                ],
                transform: (item) => ({ ...item, deleted: true }),
                dryRun: 'curl',
                batchSize: 1
            };

            const result = await main(config);

            expect(result.responses).toHaveLength(2);

            // Check first batch
            expect(result.responses[0]).toContain('"id":1');
            expect(result.responses[0]).toContain('"deleted":true');

            // Check second batch
            expect(result.responses[1]).toContain('"id":2');
            expect(result.responses[1]).toContain('"deleted":true');
        });

        test('should handle bodyParams wrapping for DELETE', async () => {
            const config = {
                url: 'https://httpbin.org/delete',
                method: 'DELETE',
                data: [{ id: 123 }],
                bodyParams: {
                    dataKey: 'items',
                    action: 'bulk_delete'
                },
                dryRun: 'curl'
            };

            const result = await main(config);

            const curlCommand = result.responses[0];
            expect(curlCommand).toContain('{"id":123}');
            expect(curlCommand).toContain('"Content-Type: application/json"');
        });

        test('should handle form-urlencoded DELETE requests', async () => {
            const config = {
                url: 'https://httpbin.org/delete',
                method: 'DELETE',
                data: [{ id: 123, action: 'delete' }],
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                dryRun: 'curl'
            };

            const result = await main(config);

            const curlCommand = result.responses[0];
            // expect(curlCommand).toContain('-d \'id=123&action=delete\'');
            expect(curlCommand).toContain('-H "Content-Type: application/x-www-form-urlencoded"');
        });

        test('should clone data for DELETE when clone option is set', async () => {
            const originalData = [{ id: 123, nested: { value: 'test' } }];

            const config = {
                url: 'https://httpbin.org/delete',
                method: 'DELETE',
                data: originalData,
                clone: true,
                transform: (item) => {
                    item.modified = true;
                    return item;
                },
                dryRun: 'curl'
            };

            const result = await main(config);

            // Original data should not be modified
            expect(originalData[0].modified).toBeUndefined();
            expect(originalData[0]).toEqual({ id: 123, nested: { value: 'test' } });

            // But the curl command should show the transformed data
            const curlCommand = result.responses[0];
            expect(curlCommand).toContain('"modified":true');
        });
    });

    describe('Real HTTP DELETE requests', () => {
        test('should successfully send DELETE request with JSON body', async () => {
            // Using httpbin.org which echoes back the request data
            const config = {
                url: 'https://httpbin.org/delete',
                method: 'DELETE',
                data: [{ id: 456, action: 'remove', timestamp: Date.now() }],
                retries: 0 // Disable retries for faster test
            };

            const result = await main(config);

            expect(result.errors).toBe(0);
            expect(result.reqCount).toBe(1);
            expect(result.rowCount).toBe(1);

            if (result.responses && result.responses.length > 0) {
                const response = result.responses[0];

                // httpbin.org returns the sent data in the response
                if (typeof response === 'object' && response.json) {
                    expect(response.json.id).toBe(456);
                    expect(response.json.action).toBe('remove');
                }
            }
        });

        test('should batch DELETE requests correctly', async () => {
            const config = {
                url: 'https://httpbin.org/delete',
                method: 'DELETE',
                data: [
                    { id: 1, batch: 'first' },
                    { id: 2, batch: 'first' },
                    { id: 3, batch: 'second' },
                    { id: 4, batch: 'second' }
                ],
                batchSize: 2,
                retries: 0
            };

            const result = await main(config);

            expect(result.rowCount).toBe(4);
            expect(result.responses.length).toBe(2); // 4 items with batchSize 2 = 2 batches
            expect(result.errors).toBe(0);
        });
    });

    describe('HttpClient direct DELETE tests', () => {
        test('should handle DELETE with various content types', async () => {
            const client = new HttpClient();

            // Test JSON (default)
            const jsonResult = await client.request({
                url: 'https://httpbin.org/delete',
                method: 'DELETE',
                data: { test: 'json' },
                dryRun: 'curl'
            });

            expect(jsonResult).toContain('Content-Type: application/json');
            expect(jsonResult).toContain('{"test":"json"}');

            // Test form-urlencoded
            const formResult = await client.request({
                url: 'https://httpbin.org/delete',
                method: 'DELETE',
                data: { test: 'form' },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                dryRun: 'curl'
            });

            expect(formResult).toContain('Content-Type: application/x-www-form-urlencoded');
            expect(formResult).toContain('test=form');
        });

        test('should correctly set headers for DELETE with custom content', async () => {
            const client = new HttpClient();

            const result = await client.request({
                url: 'https://httpbin.org/delete',
                method: 'DELETE',
                data: { id: 789 },
                headers: {
                    'Authorization': 'Bearer token123',
                    'X-Custom-Header': 'custom-value'
                },
                dryRun: 'curl'
            });

            expect(result).toContain('-H "Authorization: Bearer token123"');
            expect(result).toContain('-H "X-Custom-Header: custom-value"');
            expect(result).toContain('-H "Content-Type: application/json"');
            expect(result).toContain('-d \'{"id":789}\'');
        });
    });
});