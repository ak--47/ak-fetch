/**
 * Continuous concurrency pool (p-limit pattern, zero deps).
 * Replaces run-queue's wave model: a queued task starts the instant a slot
 * frees, instead of the whole queue draining to zero between waves.
 */
class TaskPool {
    /**
     * @param {number} concurrency - max tasks running at once
     * @param {number} [maxPending=Infinity] - max accepted-but-unfinished tasks
     *   before submit() blocks (stream backpressure high-water mark)
     */
    constructor(concurrency, maxPending = Infinity) {
        this.concurrency = concurrency;
        this.maxPending = maxPending;
        this.active = 0;
        this.waiters = [];      // resolvers waiting for a run slot
        this.pending = new Set(); // promises of accepted, unfinished tasks
    }

    async submit(fn) {
        while (this.pending.size >= this.maxPending) {
            await Promise.race(this.pending);
        }
        const task = this.#run(fn);
        // swallow rejections here; callers get them via the returned promise
        const tracked = task.catch(() => {}).finally(() => this.pending.delete(tracked));
        this.pending.add(tracked);
        return task;
    }

    async #run(fn) {
        if (this.active >= this.concurrency) {
            await new Promise((resolve) => this.waiters.push(resolve));
        }
        this.active++;
        try {
            return await fn();
        } finally {
            this.active--;
            const next = this.waiters.shift();
            if (next) next();
        }
    }

    async drain() {
        while (this.pending.size > 0) {
            await Promise.allSettled([...this.pending]);
        }
    }
}

export { TaskPool };
