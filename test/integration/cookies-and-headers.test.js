import { describe, test, expect } from 'vitest';
import akFetch from '../../index.js';
import { makeServer } from '../helpers/local-server.js';

describe('multi-Set-Cookie and header case (findings B2/B4)', () => {
    test('two Set-Cookie headers both come back on the next request', async () => {
        let first = true;
        const server = await makeServer((req, res) => {
            if (first) {
                first = false;
                res.setHeader('Set-Cookie', ['alpha=1; Path=/', 'beta=2; Path=/']);
            }
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{"ok":true}');
            return true;
        });
        await akFetch({
            url: server.url, data: [{ a: 1 }, { a: 2 }],
            concurrency: 1, enableCookies: true, verbose: false,
        });
        const secondCookie = server.requests[1].headers.cookie;
        expect(secondCookie).toContain('alpha=1');
        expect(secondCookie).toContain('beta=2');
        await server.close();
    });

    test('lowercase content-type routes to form-urlencoded path without duplicate header', async () => {
        const server = await makeServer();
        await akFetch({
            url: server.url, data: [{ a: 1, b: 'x y' }],
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            verbose: false,
        });
        const req = server.requests[0];
        expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded');
        expect(req.raw).toBe('a=1&b=x%20y');
        await server.close();
    });

    test('lowercase user-agent is not overwritten', async () => {
        const server = await makeServer();
        await akFetch({
            url: server.url, data: [{ a: 1 }],
            headers: { 'user-agent': 'custom-agent/9' },
            verbose: false,
        });
        expect(server.requests[0].headers['user-agent']).toBe('custom-agent/9');
        await server.close();
    });
});
