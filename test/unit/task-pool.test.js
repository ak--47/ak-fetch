import { describe, test, expect } from 'vitest';
import { TaskPool } from '../../lib/concurrency.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('TaskPool', () => {
    test('never exceeds the concurrency limit', async () => {
        const pool = new TaskPool(3);
        let active = 0, peak = 0;
        for (let i = 0; i < 20; i++) {
            await pool.submit(async () => {
                active++; peak = Math.max(peak, active);
                await sleep(10);
                active--;
            });
        }
        await pool.drain();
        expect(peak).toBe(3);
    });

    test('submit() resolves on ACCEPTANCE, not completion', async () => {
        const pool = new TaskPool(2);
        let finished = 0;
        const t0 = Date.now();
        await pool.submit(async () => { await sleep(200); finished++; });
        const acceptTime = Date.now() - t0;

        // submit returned long before the 200ms task could finish
        expect(acceptTime).toBeLessThan(50);
        expect(finished).toBe(0);

        // ...and drain() is what waits for completion
        await pool.drain();
        expect(finished).toBe(1);
        expect(Date.now() - t0).toBeGreaterThanOrEqual(150);
    });

    test('awaiting submit in a loop still runs tasks concurrently', async () => {
        const pool = new TaskPool(5);
        let active = 0, peak = 0;
        const t0 = Date.now();
        for (let i = 0; i < 10; i++) {
            // this is exactly how index.js drives the pool — it must NOT serialize
            await pool.submit(async () => {
                active++; peak = Math.max(peak, active);
                await sleep(50);
                active--;
            });
        }
        await pool.drain();
        expect(peak).toBeGreaterThanOrEqual(5);
        // 10 tasks x 50ms at concurrency 5 => ~100ms; serial would be ~500ms
        expect(Date.now() - t0).toBeLessThan(300);
    });

    test('starts a queued task the moment a slot frees (no wave drain)', async () => {
        const pool = new TaskPool(2);
        const starts = [];
        for (let i = 0; i < 4; i++) {
            await pool.submit(async () => {
                starts.push(Date.now());
                await sleep(i === 0 ? 5 : 50);   // first task finishes early
            });
        }
        await pool.drain();
        // task 3 must start ~when task 0 ends (~5ms), NOT after both 0 and 1 end (~50ms)
        expect(starts[2] - starts[0]).toBeLessThan(40);
    });

    test('does not over-admit when a slot is freed (handoff is atomic)', async () => {
        const pool = new TaskPool(2);
        let active = 0, peak = 0;
        const task = async () => {
            active++; peak = Math.max(peak, active);
            await sleep(5);
            active--;
        };
        // interleave "fresh submits" with slot-freeing so a non-atomic handoff
        // (active-- then wake waiter later) would let a newcomer barge in
        for (let i = 0; i < 30; i++) {
            await pool.submit(task);
            if (i % 3 === 0) await Promise.resolve();   // yield a microtask
        }
        await pool.drain();
        expect(peak).toBeLessThanOrEqual(2);
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
        await pool.submit(async () => { throw new Error('task blew up'); });
        await pool.submit(async () => { ok++; });
        await pool.drain();
        expect(ok).toBe(1);
    });

    test('a rejecting task never produces an unhandled rejection', async () => {
        const seen = [];
        const onUnhandled = (reason) => seen.push(reason);
        process.on('unhandledRejection', onUnhandled);
        try {
            const pool = new TaskPool(2);
            for (let i = 0; i < 5; i++) {
                await pool.submit(async () => { throw new Error(`boom ${i}`); });
            }
            await pool.drain();
            // let the microtask + macrotask queues flush so any unhandled rejection fires
            await sleep(50);
            expect(seen).toEqual([]);
        } finally {
            process.off('unhandledRejection', onUnhandled);
        }
    });

    test('drain() resolves when the pool is empty and is re-usable', async () => {
        const pool = new TaskPool(2);
        await pool.drain();                 // nothing submitted yet
        let done = 0;
        await pool.submit(async () => { await sleep(10); done++; });
        await pool.drain();
        expect(done).toBe(1);
        await pool.submit(async () => { await sleep(10); done++; });
        await pool.drain();
        expect(done).toBe(2);
    });
});
