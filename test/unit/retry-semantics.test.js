import { describe, test, expect } from 'vitest';
import akFetch from '../../index.js';
import RetryStrategy from '../../lib/retry-strategy.js';
import { makeServer } from '../helpers/local-server.js';

describe('retry semantics (findings A3/A4)', () => {
    test('RetryStrategy honors maxRetries: 0', () => {
        expect(new RetryStrategy({ maxRetries: 0 }).maxRetries).toBe(0);
    });

    test('RetryStrategy defaults maxRetries to 3 when undefined', () => {
        expect(new RetryStrategy({}).maxRetries).toBe(3);
    });

    test('retries: 0 makes exactly 1 attempt', async () => {
        const server = await makeServer((req, res) => { res.writeHead(500); res.end('boom'); return true; });
        await akFetch({ url: server.url, data: [{ a: 1 }], retries: 0, retryDelay: 10, verbose: false });
        expect(server.requests.length).toBe(1);
        await server.close();
    });

    test('retries: null (fire-and-forget) makes exactly 1 attempt', async () => {
        const server = await makeServer((req, res) => { res.writeHead(500); res.end('boom'); return true; });
        await akFetch({ url: server.url, data: [{ a: 1 }], retries: null, retryDelay: 10, verbose: false });
        expect(server.requests.length).toBe(1);
        await server.close();
    });

    test('default retries makes 4 attempts (3 retries) — unchanged behavior', async () => {
        const server = await makeServer((req, res) => { res.writeHead(500); res.end('boom'); return true; });
        await akFetch({ url: server.url, data: [{ a: 1 }], retryDelay: 1, verbose: false });
        expect(server.requests.length).toBe(4);
        await server.close();
    }, 30000);

    test('RetryError message includes underlying cause', async () => {
        const strategy = new RetryStrategy({ maxRetries: 1, baseDelay: 1 });
        await expect(
            strategy.execute(async () => { const e = new Error('ECONNRESET underneath'); e.code = 'ECONNRESET'; throw e; })
        ).rejects.toThrow(/ECONNRESET underneath/);
    });
});
