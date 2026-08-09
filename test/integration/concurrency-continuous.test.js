import { describe, test, expect } from 'vitest';
import akFetch from '../../index.js';
import { makeServer } from '../helpers/local-server.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('continuous concurrency (findings C1/B7)', () => {
    test('peak concurrent requests ≤ concurrency (and actually concurrent)', async () => {
        const DELAY = 20;
        const server = await makeServer(async (req, res) => {
            await sleep(DELAY);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{"ok":true}');
            return true;
        });
        const t0 = Date.now();
        await akFetch({
            url: server.url,
            data: Array.from({ length: 40 }, (_, i) => ({ i })),
            concurrency: 5, maxTasks: 10, verbose: false,
        });
        const elapsed = Date.now() - t0;
        expect(server.requests.length).toBe(40);
        expect(server.peakConcurrent).toBeLessThanOrEqual(5);
        // the pool must actually overlap requests — a submit() that resolves on
        // COMPLETION instead of acceptance serializes everything (peak === 1)
        expect(server.peakConcurrent).toBeGreaterThanOrEqual(3);
        // 40 x 20ms serial is >= 800ms; 5 lanes is ~160ms. 500ms is comfortably
        // between, so a serialized build can never sneak past this bound.
        expect(elapsed).toBeLessThan(500);
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

    test('maxResponseBuffer: 0 stores nothing without corrupting', async () => {
        const server = await makeServer();
        const result = await akFetch({
            url: server.url, data: [{ a: 1 }, { a: 2 }],
            maxResponseBuffer: 0, verbose: false,
        });
        expect(result.responses).toEqual([]);
        expect(result.reqCount).toBe(2);
        await server.close();
    });
});
