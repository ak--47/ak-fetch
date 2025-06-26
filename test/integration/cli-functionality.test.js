/**
 * CLI Functionality Integration Tests
 * 
 * Tests the command-line interface functionality including argument parsing,
 * file handling, and various CLI-specific features.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const cli = require('../../cli');

describe('CLI Functionality', () => {
    const testDataDir = './testData';
    const tempDir = './temp-cli-tests';
    
    beforeAll(() => {
        // Create temp directory for test files
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });
    
    afterAll(() => {
        // Clean up temp files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Argument Parsing', () => {
        test('should parse basic URL and file arguments', async () => {
            // Mock process.argv
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', './testData/testData.json', '--url', 'https://httpbin.org/post'];
            
            try {
                const params = await cli();
                
                expect(params.url).toBe('https://httpbin.org/post');
                expect(params.data).toBe('./testData/testData.json');
            } finally {
                process.argv = originalArgv;
            }
        });

        test('should parse payload flag instead of file', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', '--url', 'https://httpbin.org/post', '--payload', '[{"test": true}]'];
            
            try {
                const params = await cli();
                
                expect(params.url).toBe('https://httpbin.org/post');
                expect(params.data).toEqual([{ test: true }]);
            } finally {
                process.argv = originalArgv;
            }
        });

        test('should handle JSON headers parsing', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', './testData/testData.json', '--url', 'https://httpbin.org/post', '--headers', '{"Authorization": "Bearer token123"}'];
            
            try {
                const params = await cli();
                
                expect(params.headers).toEqual({ Authorization: 'Bearer token123' });
            } finally {
                process.argv = originalArgv;
            }
        });

        test('should parse search params and body params', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', './testData/testData.json', '--url', 'https://httpbin.org/post', 
                           '--searchParams', '{"verbose": 1}', '--bodyParams', '{"dataKey": "events"}'];
            
            try {
                const params = await cli();
                
                expect(params.searchParams).toEqual({ verbose: 1 });
                expect(params.bodyParams).toEqual({ dataKey: 'events' });
            } finally {
                process.argv = originalArgv;
            }
        });

        test('should handle retry configuration', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', './testData/testData.json', '--url', 'https://httpbin.org/post',
                           '--retries', '5', '--retryDelay', '2000', '--retryOn', '[429,500,502]'];
            
            try {
                const params = await cli();
                
                expect(params.retries).toBe(5);
                expect(params.retryDelay).toBe(2000);
                expect(params.retryOn).toEqual([429, 500, 502]);
            } finally {
                process.argv = originalArgv;
            }
        });

        test('should handle advanced configuration options', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', './testData/testData.json', '--url', 'https://httpbin.org/post',
                           '--enableConnectionPooling', '--enableCookies', '--useStaticRetryDelay', '--forceGC'];
            
            try {
                const params = await cli();
                
                expect(params.enableConnectionPooling).toBe(true);
                expect(params.enableCookies).toBe(true);
                expect(params.useStaticRetryDelay).toBe(true);
                expect(params.forceGC).toBe(true);
            } finally {
                process.argv = originalArgv;
            }
        });

        test('should handle shell command configuration', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', './testData/testData.json', '--url', 'https://httpbin.org/post',
                           '--shellCommand', 'echo "test-token"', '--shellHeader', 'X-API-Key', '--shellPrefix', 'Token'];
            
            try {
                const params = await cli();
                
                expect(params.shell).toEqual({
                    command: 'echo "test-token"',
                    header: 'X-API-Key',
                    prefix: 'Token'
                });
            } finally {
                process.argv = originalArgv;
            }
        });
    });

    describe('File Input Handling', () => {
        test('should handle JSON file input', async () => {
            const testFile = path.join(tempDir, 'test.json');
            const testData = [{ id: 1, name: 'test' }, { id: 2, name: 'test2' }];
            fs.writeFileSync(testFile, JSON.stringify(testData));
            
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', testFile, '--url', 'https://httpbin.org/post'];
            
            try {
                const params = await cli();
                expect(params.data).toBe(testFile);
            } finally {
                process.argv = originalArgv;
            }
        });

        test('should handle JSONL file input', async () => {
            const testFile = path.join(tempDir, 'test.jsonl');
            const testData = ['{"id": 1, "name": "test"}', '{"id": 2, "name": "test2"}'];
            fs.writeFileSync(testFile, testData.join('\\n'));
            
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', testFile, '--url', 'https://httpbin.org/post'];
            
            try {
                const params = await cli();
                expect(params.data).toBe(testFile);
            } finally {
                process.argv = originalArgv;
            }
        });
    });

    describe('Dry Run Modes', () => {
        test('should handle boolean dry run', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', './testData/testData.json', '--url', 'https://httpbin.org/post', '--dryRun', 'true'];
            
            try {
                const params = await cli();
                expect(params.dryRun).toBe(true);
            } finally {
                process.argv = originalArgv;
            }
        });

        test('should handle curl dry run mode', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', './testData/testData.json', '--url', 'https://httpbin.org/post', '--dryRun', 'curl'];
            
            try {
                const params = await cli();
                expect(params.dryRun).toBe('curl');
            } finally {
                process.argv = originalArgv;
            }
        });
    });

    describe('Method Support', () => {
        test('should handle different HTTP methods', async () => {
            const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
            
            for (const method of methods) {
                const originalArgv = process.argv;
                process.argv = ['node', 'cli.js', '--url', 'https://httpbin.org/post', '--method', method];
                
                if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
                    // These methods don't require data
                } else {
                    process.argv.push('--payload', '[{"test": true}]');
                }
                
                try {
                    const params = await cli();
                    expect(params.method).toBe(method);
                } finally {
                    process.argv = originalArgv;
                }
            }
        });
    });

    describe('Error Handling', () => {
        test('should throw error when URL is missing', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', './testData/testData.json'];
            
            try {
                await expect(cli()).rejects.toThrow();
            } finally {
                process.argv = originalArgv;
            }
        });

        test('should throw error when data is missing for POST request', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', '--url', 'https://httpbin.org/post', '--method', 'POST'];
            
            try {
                await expect(cli()).rejects.toThrow();
            } finally {
                process.argv = originalArgv;
            }
        });

        test('should allow GET requests without data', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', '--url', 'https://httpbin.org/get', '--method', 'GET'];
            
            try {
                const params = await cli();
                expect(params.method).toBe('GET');
                expect(params.url).toBe('https://httpbin.org/get');
            } finally {
                process.argv = originalArgv;
            }
        });
    });

    describe('Output Configuration', () => {
        test('should handle log file and format options', async () => {
            const originalArgv = process.argv;
            process.argv = ['node', 'cli.js', './testData/testData.json', '--url', 'https://httpbin.org/post',
                           '--logFile', './output.json', '--format', 'json', '--responseHeaders'];
            
            try {
                const params = await cli();
                
                expect(params.logFile).toBe('./output.json');
                expect(params.format).toBe('json');
                expect(params.responseHeaders).toBe(true);
            } finally {
                process.argv = originalArgv;
            }
        });

        test('should handle different output formats', async () => {
            const formats = ['json', 'csv', 'ndjson'];
            
            for (const format of formats) {
                const originalArgv = process.argv;
                process.argv = ['node', 'cli.js', './testData/testData.json', '--url', 'https://httpbin.org/post', '--format', format];
                
                try {
                    const params = await cli();
                    expect(params.format).toBe(format);
                } finally {
                    process.argv = originalArgv;
                }
            }
        });
    });
});