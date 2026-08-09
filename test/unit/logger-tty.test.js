// test/unit/logger-tty.test.js
import { describe, test, expect, vi, afterEach } from 'vitest';
import { createLogger } from '../../lib/logger.js';

describe('logger on non-TTY streams (finding B12)', () => {
    afterEach(() => vi.restoreAllMocks());

    test('progress writes no ANSI cursor codes when stdout is not a TTY', () => {
        const writes = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((s) => { writes.push(String(s)); return true; });
        const logger = createLogger({ verbose: true, isTTY: false });
        logger.start('test');
        logger.progress(5, 10, 500);
        logger.complete({ reqCount: 10, rowCount: 500, duration: 100, rps: 100 });
        const all = writes.join('');
        expect(all).not.toContain('[');   // no CSI escape sequences
        expect(all).not.toContain('\r');
    });

    test('progress still renders on TTY', () => {
        const writes = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((s) => { writes.push(String(s)); return true; });
        const logger = createLogger({ verbose: true, isTTY: true });
        logger.start('test');
        logger.progress(5, 10, 500);
        expect(writes.join('')).toContain('%');
    });
});
