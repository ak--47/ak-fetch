import { describe, test, expect } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
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

    test('malformed --headers JSON warns and carries on, instead of crashing', () => {
        // finding M-7: this used to assert only the ABSENCE of one specific
        // TypeError string, so it passed while the CLI printed its friendly
        // warning and then died on a *different* TypeError
        // ("Cannot convert undefined or null to object" out of Object.keys()).
        const emptyDir = mkdtempSync(path.join(tmpdir(), 'akf-cli-'));
        // spawnSync, not execFileSync: the warning goes to stderr, which
        // execFileSync only hands back when the process *fails*
        const proc = spawnSync('node', [CLI, '--url', 'http://localhost:1', '--payload', '[{}]', '--headers', '{notjson', '--dryRun'], { cwd: emptyDir, encoding: 'utf8' });
        const output = `${proc.stdout}${proc.stderr}`;
        const exitCode = proc.status;

        // the friendly warning must actually be printed
        expect(output).toContain('could not parse');
        expect(output).toContain('as JSON; using default');
        // and the run must survive it
        expect(exitCode).toBe(0);
        expect(output).not.toContain('TypeError');
        expect(output).not.toContain('Cannot read properties of undefined');
        expect(output).not.toContain('Cannot convert undefined or null to object');
        // dry run still completed
        expect(output).toContain('dry run mode');
    });

    test('default batch_size matches library default (1)', () => {
        const out = execFileSync('node', [CLI, '--help'], { encoding: 'utf8' });
        const batchLine = out.split('\n').find((l) => l.includes('batch_size'));
        expect(batchLine).toContain('default: 1');
    });
});
