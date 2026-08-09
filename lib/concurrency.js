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
        // Wait for capacity if needed (backpressure)
        while (this.pending.size >= this.maxPending) {
            await Promise.race(this.pending);
        }

        // Create and start the task (runs asynchronously in background)
        const taskPromise = new Promise((resolve, reject) => {
            const run = async () => {
                // Wait for a slot
                if (this.active >= this.concurrency) {
                    await new Promise((res) => this.waiters.push(res));
                }
                this.active++;
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.active--;
                    const next = this.waiters.shift();
                    if (next) next();
                }
            };
            // Start running asynchronously (don't await)
            run();
        });

        // Track the task for cleanup
        const tracked = taskPromise.catch(() => {}).finally(() => this.pending.delete(tracked));
        this.pending.add(tracked);

        // Don't return anything - submit resolves when accepted, not when task completes
        // (task runs in background)
    }

    async drain() {
        while (this.pending.size > 0) {
            await Promise.allSettled([...this.pending]);
        }
    }
}

export { TaskPool };
