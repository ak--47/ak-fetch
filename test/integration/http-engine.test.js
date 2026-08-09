// test/integration/http-engine.test.js
import { describe, test, expect } from 'vitest';
import akFetch from '../../index.js';
import { makeServer } from '../helpers/local-server.js';

describe('undici dispatcher engine (findings B1/B3/B5/B6)', () => {
    test('keep-alive pooling reuses sockets across requests', async () => {
        const server = await makeServer();
        await akFetch({
            url: server.url, data: Array.from({ length: 20 }, (_, i) => ({ i })),
            concurrency: 2, verbose: false, enableConnectionPooling: true,
        });
        expect(server.requests.length).toBe(20);
        // 2.0.16 opens ~1 connection per request (undici default dispatcher w/o tuning gives
        // no guarantee); with a keep-alive Agent, connections ≤ concurrency + small slack.
        expect(server.connections).toBeLessThanOrEqual(4);
        await server.close();
    });

    test('enableConnectionPooling: false opens ~one connection per request', async () => {
        const server = await makeServer();
        await akFetch({
            url: server.url, data: Array.from({ length: 10 }, (_, i) => ({ i })),
            concurrency: 1, verbose: false, enableConnectionPooling: false,
        });
        expect(server.connections).toBeGreaterThanOrEqual(9);
        await server.close();
    });

    test('429 response body is consumed and attached to the error', async () => {
        const server = await makeServer((req, res) => {
            res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '1' });
            res.end(JSON.stringify({ reason: 'slow down' }));
            return true;
        });
        const result = await akFetch({
            url: server.url, data: [{ a: 1 }], retries: 0, verbose: false,
        });
        // batch path stores the error in the response buffer
        expect(result.errors).toBe(1);
        expect(JSON.stringify(result.responses[0])).toContain('slow down');
        await server.close();
    });

    test('slow response body hits the timeout instead of hanging', async () => {
        const server = await makeServer((req, res) => {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.write('{"partial":');            // never finish the body
            return true;
        });
        const result = await akFetch({
            url: server.url, data: [{ a: 1 }], retries: 0, timeout: 1500, verbose: false,
        });
        expect(result.errors).toBe(1);
        await server.close();
    }, 15000);

    test('default User-Agent is ak-fetch/2', async () => {
        const server = await makeServer();
        await akFetch({ url: server.url, data: [{ a: 1 }], verbose: false });
        expect(server.requests[0].headers['user-agent']).toBe('ak-fetch/2');
        await server.close();
    });
});
