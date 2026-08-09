import { describe, test, expect } from 'vitest';
import akFetch from '../../index.js';
import { makeServer } from '../helpers/local-server.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('stats consistency (findings B13/B14)', () => {
    test('noBatch result reports a real duration', async () => {
        const server = await makeServer(async (req, res) => {
            await sleep(60);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{"ok":true}');
            return true;
        });
        const result = await akFetch({ url: server.url, data: [{ a: 1 }], noBatch: true, verbose: false });
        expect(result.duration).toBeGreaterThanOrEqual(50);   // was always 0
        await server.close();
    });

    test('multi-config result: rowCount == configCount consistently', async () => {
        const server = await makeServer();
        const result = await akFetch([
            { url: server.url, data: [{ a: 1 }], verbose: false },
            { url: server.url, data: [{ b: 2 }], verbose: false },
        ]);
        expect(result.configCount).toBe(2);
        expect(result.rowCount).toBe(2);
        expect(result.reqCount).toBe(2);
        await server.close();
    });
});

describe('sanitizeConfig masks more secret headers (finding C4)', () => {
    test('x-auth-token style headers do not appear in verbose start log', async () => {
        // sanitizeConfig isn't exported; assert via the log surface
        const server = await makeServer();
        const logs = [];
        const orig = console.log;
        console.log = (...a) => logs.push(a.join(' '));
        try {
            await akFetch({
                url: server.url, data: [{ a: 1 }], verbose: true,
                headers: { 'X-Auth-Token': 'SUPERSECRET', 'Api-Key': 'ALSOSECRET' },
            });
        } finally {
            console.log = orig;
        }
        const joined = logs.join('\n');
        expect(joined).not.toContain('SUPERSECRET');
        expect(joined).not.toContain('ALSOSECRET');
        await server.close();
    });
});
