import { describe, test, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const CLI = path.resolve('./cli.js');

describe('CLI portability (findings B8/B9/B15)', () => {
    test('--help works from a directory with no package.json', () => {
        const emptyDir = mkdtempSync(path.join(tmpdir(), 'akf-cli-'));
        const out = execFileSync('node', [CLI, '--help'], { cwd: emptyDir, encoding: 'utf8' });
        expect(out).toContain('ak-fetch');       // 2.0.16 crashes with ENOENT here
        expect(out).toMatch(/v\d+\.\d+\.\d+/);   // real version, not fallback
    });

    test('malformed --headers JSON produces a clean error, not a TypeError', () => {
        const emptyDir = mkdtempSync(path.join(tmpdir(), 'akf-cli-'));
        let output = '';
        try {
            output = execFileSync('node', [CLI, '--url', 'http://localhost:1', '--payload', '[{}]', '--headers', '{notjson', '--dryRun'], { cwd: emptyDir, encoding: 'utf8', stdio: 'pipe' });
        } catch (e) {
            output = String(e.stdout) + String(e.stderr);
        }
        expect(output).not.toContain('Cannot read properties of undefined');
    });

    test('default batch_size matches library default (1)', () => {
        const out = execFileSync('node', [CLI, '--help'], { encoding: 'utf8' });
        const batchLine = out.split('\n').find((l) => l.includes('batch_size'));
        expect(batchLine).toContain('default: 1');
    });
});
