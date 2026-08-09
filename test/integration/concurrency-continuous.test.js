import { describe, test, expect } from 'vitest';
import akFetch from '../../index.js';
import { makeServer } from '../helpers/local-server.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('continuous concurrency (findings C1/B7)', () => {
    test('peak concurrent requests ≤ concurrency', async () => {
        const server = await makeServer(async (req, res) => {
            await sleep(20);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{"ok":true}');
            return true;
        });
        await akFetch({
            url: server.url,
            data: Array.from({ length: 40 }, (_, i) => ({ i })),
            concurrency: 5, maxTasks: 10, verbose: false,
        });
        expect(server.requests.length).toBe(40);
        expect(server.peakConcurrent).toBeLessThanOrEqual(5);
        await server.close();
    });

    test('one slow request does not stall the rest (wave-model regression)', async () => {
        let n = 0;
        const server = await makeServer(async (req, res) => {
            n++;
            await sleep(n === 1 ? 400 : 5);   // first request is slow
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{"ok":true}');
            return true;
        });
        const t0 = Date.now();
        await akFetch({
            url: server.url,
            data: Array.from({ length: 30 }, (_, i) => ({ i })),
            concurrency: 5, maxTasks: 10, verbose: false,
        });
        const elapsed = Date.now() - t0;
        // 30 requests: one 400ms straggler + 29 fast ones over 5 lanes.
        // Wave model serializes waves behind the straggler (2.0.16 measures well over 800ms here).
        expect(elapsed).toBeLessThan(700);
        await server.close();
    });

    test('batchSize: 0 sends everything as ONE request (documented semantics)', async () => {
        const server = await makeServer();
        const result = await akFetch({
            url: server.url,
            data: [{ a: 1 }, { a: 2 }, { a: 3 }],
            batchSize: 0, verbose: false,
        });
        expect(result.reqCount).toBe(1);
        expect(server.requests.length).toBe(1);
        expect(server.requests[0].body).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
        await server.close();
    });
});
