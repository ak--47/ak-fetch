import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Finding C-1 regression gate.
 *
 * `package.json` declares `engines: >=18.17`. ESM named imports are validated at
 * *link* time, before a single line runs, so a static `import { openAsBlob } from 'fs'`
 * throws `SyntaxError: The requested module 'fs' does not provide an export named
 * 'openAsBlob'` and takes the ENTIRE module graph down on every Node 18.x — no
 * runtime `typeof x === 'function'` guard can save it. The CJS dist is immune
 * (esbuild emits a property access), which is exactly why this shipped unnoticed.
 *
 * The fix is to import the namespace (`import fs from 'node:fs'`) and destructure,
 * turning the missing export into a plain `undefined` the feature guard can see.
 *
 * This test is a source scan on purpose: it fails on ANY Node version, so it
 * catches the regression on the maintainer's Node 24 without needing a Node 18
 * binary in CI.
 */

/** fs / fs promises APIs that do not exist on the whole 18.x line. */
const POST_18_FS_EXPORTS = {
    openAsBlob: '19.8.0',
    statfs: '19.6.0',
    statfsSync: '19.6.0',
    glob: '22.0.0',
    globSync: '22.0.0',
};

const FS_SPECIFIERS = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises']);

/** Every shipped source file (the `files` array of package.json, minus dist). */
function shippedSources() {
    const files = [path.join(repoRoot, 'index.js'), path.join(repoRoot, 'cli.js')];
    const libDir = path.join(repoRoot, 'lib');
    for (const entry of readdirSync(libDir).sort()) {
        if (entry.endsWith('.js')) files.push(path.join(libDir, entry));
    }
    return files;
}

/**
 * Strip comments so JSDoc `@example` blocks (and this file's own prose) can't be
 * mistaken for real import statements. Quote/template aware so URLs survive.
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
    let out = '';
    let i = 0;
    while (i < source.length) {
        const c = source[i];
        const next = source[i + 1];
        if (c === '/' && next === '/') {
            while (i < source.length && source[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && next === '*') {
            i += 2;
            while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            const quote = c;
            out += c;
            i++;
            while (i < source.length) {
                if (source[i] === '\\') { out += source.slice(i, i + 2); i += 2; continue; }
                out += source[i];
                if (source[i] === quote) { i++; break; }
                i++;
            }
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

/**
 * Extract statically named-imported bindings per module specifier.
 * Handles `import { a, b as c } from 'fs'`, `import def, { a } from 'node:fs'`,
 * multiline clauses, and `export { a } from 'fs'` re-exports.
 * @param {string} source
 * @returns {Array<{specifier: string, names: string[]}>}
 */
function parseNamedImports(source) {
    const out = [];
    const code = stripComments(source);
    const re = /(?:^|[\s;}])(?:import|export)\s+([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = re.exec(code)) !== null) {
        const [, clause, specifier] = match;
        const braces = clause.match(/\{([\s\S]*?)\}/);
        if (!braces) continue;
        const names = braces[1]
            .split(',')
            .map((part) => part.trim().split(/\s+as\s+/)[0].trim())
            .filter(Boolean);
        if (names.length) out.push({ specifier, names });
    }
    return out;
}

describe('Node 18 ESM link-time compatibility (finding C-1)', () => {
    const sources = shippedSources();

    test('the scan actually sees the shipped sources', () => {
        // guards against a regex/glob that silently matches nothing and passes vacuously
        expect(sources.length).toBeGreaterThanOrEqual(12);
        expect(sources.some((f) => f.endsWith('form-data-handler.js'))).toBe(true);
        const allImports = sources.flatMap((f) => parseNamedImports(readFileSync(f, 'utf8')));
        expect(allImports.length).toBeGreaterThan(0);
    });

    test.each(sources.map((f) => [path.relative(repoRoot, f), f]))(
        '%s does not statically named-import a post-Node-18 fs API',
        (rel, file) => {
            const violations = [];
            for (const { specifier, names } of parseNamedImports(readFileSync(file, 'utf8'))) {
                if (!FS_SPECIFIERS.has(specifier)) continue;
                for (const name of names) {
                    if (POST_18_FS_EXPORTS[name]) {
                        violations.push(
                            `import { ${name} } from '${specifier}' — added in Node ${POST_18_FS_EXPORTS[name]}, ` +
                            `breaks ESM link on Node 18.x (engines: >=18.17). ` +
                            `Use \`import fs from 'node:fs'\` + destructure instead.`
                        );
                    }
                }
            }
            expect(violations, `${rel}:\n  ${violations.join('\n  ')}`).toEqual([]);
        }
    );

    test('form-data-handler reaches openAsBlob through a namespace, not a named import', () => {
        const src = readFileSync(path.join(repoRoot, 'lib', 'form-data-handler.js'), 'utf8');
        // it must still USE openAsBlob (the fast path on modern Node)...
        expect(src).toMatch(/openAsBlob/);
        // ...and still feature-guard it, since it is undefined on 18
        expect(src).toMatch(/typeof openAsBlob === 'function'/);
        // ...but never bind it via a static named import
        const named = parseNamedImports(src)
            .filter(({ specifier }) => FS_SPECIFIERS.has(specifier))
            .flatMap(({ names }) => names);
        expect(named).not.toContain('openAsBlob');
    });
});
