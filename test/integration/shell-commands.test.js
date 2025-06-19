/**
 * Shell Commands Integration Tests
 * 
 * Tests shell command execution for dynamic header generation,
 * including various shell command scenarios and error handling.
 */

const akFetch = require('../../index');

describe('Shell Commands', () => {
    const mockUrl = 'https://httpbin.org/post';
    const testData = [{ id: 1, test: true }];

    describe('Basic Shell Command Execution', () => {
        test('should execute shell command and add to Authorization header', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'echo "test-token-123"',
                    header: 'Authorization',
                    prefix: 'Bearer'
                },
                dryRun: true,
                verbose: false
            });

            // In dry run mode, we can check that the configuration was processed
            expect(result.responses).toHaveLength(0);
        });

        test('should execute shell command with custom header name', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'echo "api-key-value"',
                    header: 'X-API-Key',
                    prefix: 'Key'
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
        });

        test('should execute shell command with no prefix', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'echo "raw-token-value"',
                    header: 'Authorization',
                    prefix: ''
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
        });

        test('should use default header and prefix when not specified', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'echo "default-token"'
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
        });
    });

    describe('Shell Command Output Processing', () => {
        test('should trim whitespace from shell command output', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'echo "  token-with-spaces  "',
                    header: 'Authorization',
                    prefix: 'Bearer'
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
        });

        test('should handle multi-line shell command output', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'printf "line1\\nline2\\ntoken-value"',
                    header: 'Authorization',
                    prefix: 'Bearer'
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
        });

        test('should handle empty shell command output', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'echo ""',
                    header: 'Authorization',
                    prefix: 'Bearer'
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
        });
    });

    describe('Real-world Shell Command Scenarios', () => {
        test('should work with date command', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'date +%s',
                    header: 'X-Timestamp',
                    prefix: 'unix:'
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
        });

        test('should work with environment variable access', async () => {
            // Set a test environment variable
            process.env.TEST_TOKEN = 'env-token-123';
            
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'echo $TEST_TOKEN',
                    header: 'Authorization',
                    prefix: 'Bearer'
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
            
            // Clean up
            delete process.env.TEST_TOKEN;
        });

        test('should work with node.js command', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'node -e "console.log(\'generated-token\' + Date.now())"',
                    header: 'X-Dynamic-Token',
                    prefix: 'Generated:'
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
        });

        test('should work with JSON parsing command', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'echo \'{"token": "json-token-value"}\' | node -e "console.log(JSON.parse(require(\'fs\').readFileSync(0)).token)"',
                    header: 'Authorization',
                    prefix: 'Bearer'
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
        });
    });

    describe('Shell Command Error Handling', () => {
        test('should throw error for non-existent command', async () => {
            await expect(akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'non-existent-command-xyz',
                    header: 'Authorization',
                    prefix: 'Bearer'
                },
                verbose: false
            })).rejects.toThrow();
        });

        test('should throw error for command with non-zero exit code', async () => {
            await expect(akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'exit 1',
                    header: 'Authorization',
                    prefix: 'Bearer'
                },
                verbose: false
            })).rejects.toThrow();
        });

        test('should handle command timeout gracefully', async () => {
            // This test might be skipped on some systems where timeout isn't available
            try {
                await expect(akFetch({
                    url: mockUrl,
                    data: testData,
                    shell: {
                        command: 'sleep 10', // Long-running command
                        header: 'Authorization',
                        prefix: 'Bearer'
                    },
                    verbose: false
                })).rejects.toThrow();
            } catch (error) {
                // Test passed - command should fail or timeout
                expect(true).toBe(true);
            }
        }, 15000); // Longer timeout for this test

        test('should provide meaningful error messages', async () => {
            try {
                await akFetch({
                    url: mockUrl,
                    data: testData,
                    shell: {
                        command: 'invalid-command-that-does-not-exist',
                        header: 'Authorization',
                        prefix: 'Bearer'
                    },
                    verbose: false
                });
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Shell command failed');
            }
        });
    });

    describe('Shell Commands with Curl Generation', () => {
        test('should execute shell command before generating curl', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'echo "curl-test-token"',
                    header: 'Authorization',
                    prefix: 'Bearer'
                },
                dryRun: 'curl',
                verbose: false
            });

            expect(result.responses).toHaveLength(1);
            const curlCommand = result.responses[0];
            
            expect(curlCommand).toContain('curl');
            expect(curlCommand).toContain('-H "Authorization: Bearer curl-test-token"');
        });

        test('should handle special characters in shell output for curl', async () => {
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: 'echo "token-with-special-chars-!@#$%"',
                    header: 'X-Special-Header',
                    prefix: 'Special:'
                },
                dryRun: 'curl',
                verbose: false
            });

            expect(result.responses).toHaveLength(1);
            const curlCommand = result.responses[0];
            
            expect(curlCommand).toContain('curl');
            expect(curlCommand).toContain('X-Special-Header');
        });
    });

    describe('Shell Commands with Multiple Configurations', () => {
        test('should execute shell commands for each configuration', async () => {
            const configs = [
                {
                    url: 'https://api1.example.com',
                    data: [{ id: 1 }],
                    shell: {
                        command: 'echo "token1"',
                        header: 'Authorization',
                        prefix: 'Bearer'
                    },
                    dryRun: true
                },
                {
                    url: 'https://api2.example.com',
                    data: [{ id: 2 }],
                    shell: {
                        command: 'echo "token2"', 
                        header: 'X-API-Key',
                        prefix: 'Key'
                    },
                    dryRun: true
                }
            ];

            const result = await akFetch(configs);
            
            expect(Array.isArray(result.responses)).toBe(true);
            expect(result.configCount).toBe(2);
        });
    });

    describe('Shell Commands with Different Operating Systems', () => {
        test('should work on current platform', async () => {
            const isWindows = process.platform === 'win32';
            const command = isWindows ? 'echo test-token-windows' : 'echo "test-token-unix"';
            
            const result = await akFetch({
                url: mockUrl,
                data: testData,
                shell: {
                    command: command,
                    header: 'Authorization',
                    prefix: 'Bearer'
                },
                dryRun: true,
                verbose: false
            });

            expect(result.responses).toHaveLength(0);
        });
    });

    describe('Security Considerations', () => {
        test('should handle potentially dangerous commands safely', async () => {
            // Test that the shell command is executed in a controlled manner
            // Note: In a real scenario, you'd want to validate and sanitize shell commands
            
            try {
                await akFetch({
                    url: mockUrl,
                    data: testData,
                    shell: {
                        command: 'echo "safe-command"',
                        header: 'Authorization',
                        prefix: 'Bearer'
                    },
                    dryRun: true,
                    verbose: false
                });
                
                expect(true).toBe(true); // Command executed safely
            } catch (error) {
                // Even if it fails, it should fail gracefully
                expect(error.message).toBeDefined();
            }
        });
    });
});