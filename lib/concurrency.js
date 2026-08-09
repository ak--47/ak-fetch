/**
 * Continuous concurrency pool (p-limit pattern, zero deps).
 * Replaces run-queue's wave model: a queued task starts the instant a slot
 * frees, instead of the whole queue draining to zero between waves.
 *
 * Interface contract: `submit()` resolves once the task has been ACCEPTED
 * (admitted into a run slot), NOT when it completes. Awaiting `submit()` is
 * therefore backpressure, not serialization. Use `drain()` to await completion
 * of everything submitted so far.
 */
class TaskPool {
    /**
     * @param {number} concurrency - max tasks running at once
     * @param {number} [maxPending=Infinity] - max accepted-but-unfinished tasks
     *   before submit() blocks (stream backpressure high-water mark)
     */
    constructor(concurrency, maxPending = Infinity) {
        this.concurrency = concurrency > 0 ? concurrency : 1;
        this.maxPending = maxPending > 0 ? maxPending : Infinity;
        this.active = 0;
        /** @type {Array<(value?: any) => void>} */
        this.waiters = [];        // resolvers holding a slot that was handed to them
        /** @type {Set<Promise<void>>} */
        this.pending = new Set(); // promises of accepted, unfinished tasks
    }

    /**
     * Accept a task into the pool.
     *
     * Resolves as soon as the task has been admitted to a run slot — the task
     * itself keeps running in the background. Rejections from `fn` are absorbed
     * by the pool (tasks in this codebase own their error handling) so they can
     * never surface as unhandled rejections.
     *
     * @param {() => Promise<any>} fn - the task to run
     * @returns {Promise<void>} resolves on acceptance
     */
    async submit(fn) {
        // backpressure: cap accepted-but-unfinished work
        while (this.pending.size >= this.maxPending) {
            await Promise.race(this.pending);
        }

        // slot admission: either take a free slot now, or wait for one to be
        // handed to us directly by a finishing task (see #release)
        if (this.active >= this.concurrency) {
            await new Promise((resolve) => this.waiters.push(resolve));
            // the freed slot was transferred to us with `active` left intact —
            // no increment here, otherwise we'd double-count it
        } else {
            this.active++;
        }

        /** @type {Promise<void>} */
        const tracked = this.#run(fn).finally(() => this.pending.delete(tracked));
        this.pending.add(tracked);
    }

    /**
     * Run an admitted task and release its slot when it settles.
     * Never rejects.
     * @param {() => Promise<any>} fn
     */
    async #run(fn) {
        try {
            await fn();
        } catch {
            // tasks own their errors; the pool only guarantees slot accounting
        } finally {
            this.#release();
        }
    }

    /**
     * Release one run slot. If someone is waiting, the slot is handed straight
     * to them (`active` is NOT decremented) so a submit() arriving before the
     * waiter resumes still sees a full pool and cannot over-admit.
     */
    #release() {
        const next = this.waiters.shift();
        if (next) next();
        else this.active--;
    }

    /**
     * Wait for every accepted task to finish.
     * @returns {Promise<void>}
     */
    async drain() {
        while (this.pending.size > 0) {
            await Promise.allSettled([...this.pending]);
        }
    }
}

export { TaskPool };
