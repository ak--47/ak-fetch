/**
 * Dry Run Modes Integration Tests
 * 
 * Tests dry run functionality including boolean dry run mode
 * and curl command generation mode.
 */

import akFetch from '../../index.js';

describe('Dry Run Modes', () => {
    const mockUrl = 'https://httpbin.org/post';
    const testData = [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' }
    ];

    describe('Boolean Dry Run Mode', () => {
        test('should not make actual HTTP requests in dry run mode', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                dryRun: true,
                verbose: false,
                batchSize: 1
            });

            expect(result.responses).toHaveLength(0);
            expect(result.reqCount).toBe(0);
            expect(result.rowCount).toBe(2); // Should still count records
        });

        test('should return empty responses array for dry run', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                dryRun: true,
                verbose: false
            });

            expect(Array.isArray(result.responses)).toBe(true);
            expect(result.responses).toHaveLength(0);
        });

        // test('should work with different HTTP methods in dry run', async () => {
        //     const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
            
        //     for (const method of methods) {
        //         const result = await akFetch({
        //             url: mockUrl,
        //             data: method === 'GET' ? undefined : testData,
        //             method: method,
        //             dryRun: true,
        //             verbose: false
        //         });

        //         expect(result.responses).toHaveLength(0);
        //         expect(result.reqCount).toBe(0);
        //     }
        // });

        test('should handle batch processing in dry run', async () => {
            const largeData = Array.from({ length: 50 }, (_, i) => ({ id: i, value: `test${i}` }));
            
            const result = await akFetch({
                url: mockUrl,
                data: largeData,
                batchSize: 10,
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
            expect(result.rowCount).toBe(50);
            expect(result.reqCount).toBe(0);
        });
    });

    describe('Curl Command Generation Mode', () => {
        test('should generate curl commands instead of making requests', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                dryRun: 'curl',
                batchSize: 1,
                verbose: false,
                headers: { 'Content-Type': 'application/json' }
            });

            expect(result.responses).toHaveLength(2);
            result.responses.forEach(response => {
                expect(typeof response).toBe('string');
                expect(response).toContain('curl');
                expect(response).toContain('-X POST');
                expect(response).toContain(mockUrl);
                expect(response).toContain('Content-Type: application/json');
            });
        });

        test('should generate curl with proper headers', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: [{ test: 'data' }],
                dryRun: 'curl',
                headers: {
                    'Authorization': 'Bearer token123',
                    'X-Custom-Header': 'custom-value'
                },
                verbose: false
            });

            expect(result.responses).toHaveLength(1);
            const curlCommand = result.responses[0];
            
            expect(curlCommand).toContain('-H "Authorization: Bearer token123"');
            expect(curlCommand).toContain('-H "X-Custom-Header: custom-value"');
        });

        // test('should generate curl with different HTTP methods', async () => {
        //     const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
            
        //     for (const method of methods) {
        //         const result = await akFetch({
        //             url: mockUrl,
        //             data: method === 'GET' ? undefined : [{ test: 'data' }],
        //             method: method,
        //             dryRun: 'curl',
        //             verbose: false
        //         });

        //         if (method === 'GET') {
        //             // GET requests without data should still generate curl
        //             expect(result.responses).toHaveLength(1);
        //         } else {
        //             expect(result.responses).toHaveLength(1);
        //         }
                
        //         const curlCommand = result.responses[0];
        //         expect(curlCommand).toContain(`-X ${method}`);
        //     }
        // });

        test('should generate curl with query parameters', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: [{ test: 'data' }],
                dryRun: 'curl',
                searchParams: { verbose: 1, format: 'json' },
                verbose: false
            });

            expect(result.responses).toHaveLength(1);
            const curlCommand = result.responses[0];
            
            expect(curlCommand).toContain('verbose=1');
            expect(curlCommand).toContain('format=json');
        });

        test('should generate curl with JSON data payload', async () => {
            const data = [{ id: 1, name: 'test', complex: { nested: true } }];
            
            const result = await akFetch({
                url: mockUrl,
                data: data,
                dryRun: 'curl',
                verbose: false
            });

            expect(result.responses).toHaveLength(1);
            const curlCommand = result.responses[0];
            
            expect(curlCommand).toContain('-d');
            expect(curlCommand).toContain(`{"id":1,"name":"test"`);
        });

        test('should handle batched curl generation', async () => {
            const data = [
                { id: 1, name: 'batch1' },
                { id: 2, name: 'batch2' },
                { id: 3, name: 'batch3' },
                { id: 4, name: 'batch4' }
            ];
            
            const result = await akFetch({
                url: mockUrl,
                data: data,
                batchSize: 2,
                dryRun: 'curl',
                verbose: false
            });

            expect(result.responses).toHaveLength(4); // 4 items / 2 batch size = 2 batches
            
            result.responses.forEach(curlCommand => {
                expect(curlCommand).toContain('curl');
                expect(curlCommand).toContain('-X POST');
                expect(curlCommand).toContain(mockUrl);
            });
        });

        test('should generate valid curl syntax', async () => {
            const result = await akFetch({
                url: 'https://api.example.com/endpoint',
                data: [{ message: 'Hello "world"', special: 'chars & symbols' }],
                dryRun: 'curl',
                headers: { 'Authorization': 'Bearer token123' },
                verbose: false
            });

            expect(result.responses).toHaveLength(1);
            const curlCommand = result.responses[0];
            
            // Should properly escape quotes in data
            expect(curlCommand).not.toContain('Hello "world"'); // Should be escaped
            expect(curlCommand).toContain('curl');
            expect(curlCommand).toContain('https://api.example.com/endpoint');
        });
    });

    describe('Dry Run with Complex Configurations', () => {
        test('should handle dry run with shell commands', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                dryRun: true,
                shell: {
                    command: 'echo "dynamic-token"',
                    header: 'Authorization',
                    prefix: 'Bearer'
                },
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
            expect(result.reqCount).toBe(0);
        });

        test('should handle dry run with transform function', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                dryRun: true,
                transform: (item) => ({ ...item, transformed: true }),
                verbose: false
            });

            expect(result.responses).toHaveLength(2);
            expect(result.rowCount).toBe(2);
			expect(result.responses.filter(r => r.transformed).length).toBe(2);
        });

        test('should handle dry run with multiple configurations', async () => {
            const configs = [
                {
                    url: 'https://api1.example.com',
                    data: [{ id: 1 }],
                    dryRun: true
                },
                {
                    url: 'https://api2.example.com', 
                    data: [{ id: 2 }],
                    dryRun: true
                }
            ];

            const results = await akFetch(configs);
            
            expect(Array.isArray(results.responses)).toBe(true);
            expect(results.configCount).toBe(2);
        });

        test('should handle curl generation with file uploads', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: [{
                    name: 'test-file',
                    content: 'file content here'
                }],
                dryRun: 'curl',
                headers: { 'Content-Type': 'multipart/form-data' },
                verbose: false
            });

            expect(result.responses).toHaveLength(1);
            const curlCommand = result.responses[0];
            expect(curlCommand).toContain('curl');
            expect(curlCommand).toContain('multipart/form-data');
        });
    });

    describe('Dry Run Performance', () => {
        test('should be fast for large datasets in dry run', async () => {
            const largeData = Array.from({ length: 10000 }, (_, i) => ({ 
                id: i, 
                value: `test-value-${i}`,
                timestamp: Date.now() 
            }));

            const startTime = Date.now();
            
            const result = await akFetch({
                url: mockUrl,
                data: largeData,
                batchSize: 100,
                dryRun: true,
                verbose: false
            });

            const duration = Date.now() - startTime;
            
            expect(result.rowCount).toBe(10000);
            expect(result.responses).toHaveLength(0);
            expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
        });
    });
});