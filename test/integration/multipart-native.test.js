// test/integration/multipart-native.test.js
import { describe, test, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import akFetch from '../../index.js';
import { makeServer } from '../helpers/local-server.js';

describe('multipart upload actually works (finding A5)', () => {
    test('file path field round-trips through a real request', async () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'akf-'));
        const file = path.join(dir, 'upload.txt');
        writeFileSync(file, 'hello multipart world');
        const server = await makeServer();
        const result = await akFetch({
            url: server.url,
            data: [{ name: 'doc', file, description: 'a file' }],
            headers: { 'Content-Type': 'multipart/form-data' },
            retries: 0, verbose: false,
        });
        expect(result.errors).toBe(0);
        const req = server.requests[0];
        expect(req.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
        expect(req.raw).toContain('hello multipart world');
        expect(req.raw).toContain('filename="upload.txt"');
        expect(req.raw).toContain('name="description"');
        await server.close();
    });

    test('string values containing slashes are not treated as file paths', async () => {
        const server = await makeServer();
        const result = await akFetch({
            url: server.url,
            data: [{ mime: 'application/json', note: 'a/b/c' }],
            headers: { 'Content-Type': 'multipart/form-data' },
            retries: 0, verbose: false,
        });
        expect(result.errors).toBe(0);
        expect(server.requests[0].raw).toContain('application/json');
        await server.close();
    });
});
