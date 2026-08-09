import { describe, test, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const distCjs = path.join(repoRoot, 'dist', 'index.cjs');

/**
 * The CJS bundle is a published artifact (`exports["."].require`). esbuild
 * rewrites `import.meta` to `{}`, so any top-level `new URL(x, import.meta.url)`
 * throws `Invalid URL` the moment a consumer calls require('ak-fetch').
 * This gate ran manually once and regressed silently — keep it in the suite.
 */
describe('dist/index.cjs (CommonJS consumers)', () => {
    test('the bundle is present', () => {
        expect(existsSync(distCjs), `${distCjs} missing — run \`npm run build\``).toBe(true);
    });

    test('require() loads without throwing and exports a callable default', () => {
        const script = `const m = require(${JSON.stringify(distCjs)}); if (typeof (m.default || m) !== 'function') process.exit(1);`;
        let status = 0;
        let output = '';
        try {
            output = execFileSync(process.execPath, ['-e', script], {
                cwd: repoRoot,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 30000,
            });
        } catch (err) {
            status = err.status ?? 1;
            output = `${err.stdout || ''}${err.stderr || ''}`;
        }
        expect(status, `require('dist/index.cjs') failed:\n${output}`).toBe(0);
    });

    test('require() works from an unrelated CWD', () => {
        const script = `const m = require(${JSON.stringify(distCjs)}); if (typeof (m.default || m) !== 'function') process.exit(1);`;
        let status = 0;
        let output = '';
        try {
            execFileSync(process.execPath, ['-e', script], {
                cwd: '/',
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 30000,
            });
        } catch (err) {
            status = err.status ?? 1;
            output = `${err.stdout || ''}${err.stderr || ''}`;
        }
        expect(status, `require from '/' failed:\n${output}`).toBe(0);
    });

    test('cli.js FALLBACK_VERSION stays in sync with package.json', async () => {
        const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
        const { FALLBACK_VERSION } = await import('../../cli.js');
        expect(FALLBACK_VERSION).toBe(pkg.version);
    });
});
