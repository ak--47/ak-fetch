import { describe, test, expect } from 'vitest';
import { TaskPool } from '../../lib/concurrency.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('TaskPool', () => {
    test('never exceeds the concurrency limit', async () => {
        const pool = new TaskPool(3);
        let active = 0, peak = 0;
        const tasks = [];
        for (let i = 0; i < 20; i++) {
            tasks.push(pool.submit(async () => {
                active++; peak = Math.max(peak, active);
                await sleep(10);
                active--;
            }));
        }
        await pool.drain();
        expect(peak).toBe(3);
    });

    test('starts a queued task the moment a slot frees (no wave drain)', async () => {
        const pool = new TaskPool(2);
        const starts = [];
        const submitted = [];
        for (let i = 0; i < 4; i++) {
            submitted.push(pool.submit(async () => {
                starts.push(Date.now());
                await sleep(i === 0 ? 5 : 50);   // first task finishes early
            }));
        }
        await Promise.all(submitted);
        await pool.drain();
        // task 3 must start ~when task 0 ends (~5ms), NOT after both 0 and 1 end (~50ms)
        expect(starts[2] - starts[0]).toBeLessThan(40);
    });

    test('maxPending applies backpressure on submit', async () => {
        const pool = new TaskPool(1, 2);
        let done = 0;
        const t0 = Date.now();
        for (let i = 0; i < 4; i++) {
            await pool.submit(async () => { await sleep(20); done++; });
        }
        // 4th submit had to wait for capacity → some work already completed
        expect(done).toBeGreaterThanOrEqual(1);
        await pool.drain();
        expect(done).toBe(4);
        expect(Date.now() - t0).toBeGreaterThanOrEqual(75);
    });

    test('a throwing task does not break the pool or drain', async () => {
        const pool = new TaskPool(2);
        let ok = 0;
        try {
            await pool.submit(async () => { throw new Error('task blew up'); });
        } catch (e) {
            // expected
        }
        await pool.submit(async () => { ok++; });
        await pool.drain();
        expect(ok).toBe(1);
    });
});
