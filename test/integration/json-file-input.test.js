// test/integration/json-file-input.test.js
import { describe, test, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import akFetch from '../../index.js';
import { makeServer } from '../helpers/local-server.js';

describe('.json file path input (finding A2)', () => {
    test('array-shaped .json file streams as records', async () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'akf-'));
        const file = path.join(dir, 'data.json');
        writeFileSync(file, JSON.stringify([{ a: 1 }, { a: 2 }, { a: 3 }]));
        const server = await makeServer();
        const result = await akFetch({ url: server.url, data: file, verbose: false });
        expect(result.rowCount).toBe(3);
        expect(result.reqCount).toBe(3);
        await server.close();
    });

    test('object-shaped .json file sends one record', async () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'akf-'));
        const file = path.join(dir, 'single.json');
        writeFileSync(file, JSON.stringify({ only: true }));
        const server = await makeServer();
        const result = await akFetch({ url: server.url, data: file, verbose: false });
        expect(result.rowCount).toBe(1);
        expect(server.requests[0].body).toEqual({ only: true });
        await server.close();
    });
});
