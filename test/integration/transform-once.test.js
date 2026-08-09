import { describe, test, expect } from 'vitest';
import akFetch from '../../index.js';
import { makeServer } from '../helpers/local-server.js';

describe('transform runs exactly once per record (finding A1)', () => {
    test('non-idempotent transform, batched path', async () => {
        const server = await makeServer();
        let calls = 0;
        const result = await akFetch({
            url: server.url,
            data: [{ n: 1 }, { n: 2 }],
            verbose: false,
            transform: (item) => { calls++; return { ...item, n: item.n + 10 }; },
        });
        expect(calls).toBe(2);                                  // was 4 in 2.0.16
        const sent = server.requests.map((r) => r.body).sort((a, b) => a.n - b.n);
        expect(sent).toEqual([{ n: 11 }, { n: 12 }]);           // was 21/22 in 2.0.16
        expect(result.reqCount).toBe(2);
        await server.close();
    });

    test('non-idempotent transform, batchSize > 1', async () => {
        const server = await makeServer();
        let calls = 0;
        await akFetch({
            url: server.url,
            data: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }],
            batchSize: 2,
            verbose: false,
            transform: (item) => { calls++; return { ...item, n: item.n + 10 }; },
        });
        expect(calls).toBe(4);
        const sent = server.requests.map((r) => r.body).sort((a, b) => {
            const aFirst = Array.isArray(a) ? a[0].n : a.n;
            const bFirst = Array.isArray(b) ? b[0].n : b.n;
            return aFirst - bFirst;
        });
        expect(sent).toEqual([
            [{ n: 11 }, { n: 12 }],
            [{ n: 13 }, { n: 14 }],
        ]);
        await server.close();
    });

    test('noBatch path still applies transform exactly once', async () => {
        const server = await makeServer();
        let calls = 0;
        await akFetch({
            url: server.url,
            data: [{ n: 1 }],
            noBatch: true,
            verbose: false,
            transform: (item) => { calls++; return { ...item, n: item.n + 10 }; },
        });
        expect(calls).toBe(1);
        expect(server.requests[0].body).toEqual([{ n: 11 }]);
        await server.close();
    });
});
