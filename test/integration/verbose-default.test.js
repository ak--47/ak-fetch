import { describe, test, expect, vi, afterEach } from 'vitest';
import akFetch from '../../index.js';

/**
 * Finding B14 / M-1.
 *
 * `setDefaults()` and types.d.ts both say `verbose` defaults to **false**. The
 * single-config path honoured that, but `processMultipleConfigs()` computed
 * `firstConfig?.verbose !== false` — i.e. defaulted TRUE — so handing ak-fetch an
 * array of configs printed a banner and a progress bar that the exact same work
 * as a single config did silently. Library output should be opt-in.
 */

/** Capture everything the logger can emit. */
function captureOutput() {
    const chunks = [];
    const push = (...args) => { chunks.push(args.map(String).join(' ')); };
    vi.spyOn(console, 'log').mockImplementation(push);
    vi.spyOn(console, 'error').mockImplementation(push);
    vi.spyOn(console, 'warn').mockImplementation(push);
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => { chunks.push(String(s)); return true; });
    return chunks;
}

const configFor = (n, extra = {}) => ({
    url: `https://api${n}.example.com/events`,
    data: [{ id: n }],
    dryRun: true,
    ...extra,
});

describe('verbose defaults to false (finding B14/M-1)', () => {
    afterEach(() => vi.restoreAllMocks());

    test('a config ARRAY is silent by default', async () => {
        const out = captureOutput();
        const result = await akFetch([configFor(1), configFor(2)]);
        vi.restoreAllMocks();

        expect(result.configCount).toBe(2);
        expect(out.join('')).toBe('');
    });

    test('a config array still logs when verbose is explicitly true', async () => {
        const out = captureOutput();
        await akFetch([configFor(1, { verbose: true }), configFor(2, { verbose: true })]);
        vi.restoreAllMocks();

        expect(out.join('')).not.toBe('');
        expect(out.join('')).toContain('Processing multiple endpoints');
    });

    test('a config array is silent when verbose is explicitly false', async () => {
        const out = captureOutput();
        await akFetch([configFor(1, { verbose: false }), configFor(2, { verbose: false })]);
        vi.restoreAllMocks();

        expect(out.join('')).toBe('');
    });

    test('a SINGLE config is silent by default (the half that was already right)', async () => {
        const out = captureOutput();
        await akFetch(configFor(1));
        vi.restoreAllMocks();

        expect(out.join('')).toBe('');
    });

    test('single and array paths agree on the default', async () => {
        const single = captureOutput();
        await akFetch(configFor(1));
        vi.restoreAllMocks();

        const array = captureOutput();
        await akFetch([configFor(1)]);
        vi.restoreAllMocks();

        expect(array.join('')).toBe(single.join(''));
    });
});
