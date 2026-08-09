# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-08-09

### Fixed

#### Critical Bugs
- **A1**: Fixed `transform` being applied twice to every record, causing data corruption with non-idempotent transforms
- **A2**: Fixed `.json` file input crashing with `require is not defined` error in ESM
- **A3**: Fixed `retries: 0` performing 4 attempts instead of 1
- **A4**: Fixed `retries: null` (fire-and-forget) performing 4 attempts instead of 1
- **A5**: Fixed multipart file upload completely broken due to incompatible stream handling with native fetch

#### HTTP & Connection Pooling
- **B1**: Fixed connection pooling being a complete no-op — now uses real undici dispatcher for connection reuse
- **B2**: Fixed multiple `Set-Cookie` headers being collapsed instead of parsed individually
- **B3**: Fixed 429 responses never consuming body, causing socket leaks under rate limiting
- **B4**: Fixed case-sensitive header handling causing duplicate headers
- **B5**: Fixed latent instant-abort timeout when config lacks timeout field
- **B6**: Fixed timeout not covering body reads, allowing slow response bodies to stall forever

#### CLI & Configuration
- **B7**: Fixed `batchSize: 0` sending one request per record instead of all records in one request
- **B8**: Fixed CLI reading `./package.json` from CWD instead of package directory. The version read is also guarded, so the bundled CommonJS build (`require('ak-fetch')`), where esbuild leaves `import.meta.url` undefined, no longer throws `Invalid URL` at load time.
- **B9**: Fixed CLI `parse()` error handler referencing undefined `this.verbose`
- **B10**: Fixed `engines: node >=16` when Node 16 lacks native fetch (now requires `>=18.17`, the floor declared by `undici@6`)
- **B11**: Fixed `CircularBuffer(0)` silently corrupting storage with NaN indexes
- **B12**: Fixed logger writing ANSI cursor codes to non-TTY streams, polluting logs/CI output
- **B13**: Fixed `executeSingleRequest` always reporting `duration: 0`
- **B14**: Fixed multi-config stats being self-inconsistent between logs and return value
- **B15**: Fixed CLI `batch_size` default of 2 contradicting library default of 1

#### Found by adversarial review of the 2.1.0 release itself

- **C-1**: Fixed the package failing to load at all on Node 18. `lib/form-data-handler.js` statically named-imported `openAsBlob` from `fs`, which only exists on Node ≥19.8. ESM validates named imports at *link* time, so `import 'ak-fetch'` threw `SyntaxError: The requested module 'fs' does not provide an export named 'openAsBlob'` before any code ran, and the runtime feature guard never got a chance. The CommonJS build was unaffected (esbuild emits a property access), which is why it went unnoticed. Fixed by importing the namespace and destructuring; verified on Node 18.20.8. A source-scan test now fails the suite on any Node version if a shipped file named-imports a post-18 `fs` API.
- **M-2**: Fixed transport errors being misclassified. Native `fetch` rejects with a bare `TypeError` ("fetch failed" / "terminated") and hides the real failure on `.cause`, but the error handler only inspected the wrapper's `.code` — so it was always `undefined`. Consequences: `ECONNREFUSED`/`ENOTFOUND` never became `NetworkError`, undici's `UND_ERR_BODY_TIMEOUT`/`UND_ERR_HEADERS_TIMEOUT` never became `TimeoutError`, and because `isNetworkError()` shared the blind spot, **none of them were retried** — they all collapsed into a generic `AkFetchError`. Classification now walks the `cause` chain (including the `AggregateError` that dual-stack hosts produce), and `NetworkError` codes live in one shared list so the client and the retry strategy can't drift apart again. Note this means connection failures and body/header deadlines are now retried by default, as `retryOnNetworkError: true` always claimed.
- Fixed JSON response parsing masking the real error. `getResponseBody()` did `try { response.json() } catch { response.text() }`, but `.json()` consumes the stream before it parses, so the fallback could never run — it threw `Body is unusable: Body has already been read` instead. That silently broke two cases: a server returning invalid JSON under a JSON content-type, and any mid-body transport failure, whose real cause was replaced before it could be classified. Now reads text once and parses it.

#### Performance & Architecture
- **C1**: Fixed wave-based concurrency causing sawtooth throughput — replaced with a continuous task pool that admits a queued task the instant a running one frees a slot, instead of draining the whole queue between waves. Measured on a local 30ms-latency server (20 requests, `batchSize: 1`, `concurrency: 10`): peak concurrent requests 10, wall clock 86ms. Responses are stored in completion order when `concurrency` > 1 (unchanged from 2.0.x concurrent behavior).
- **C4**: Fixed `User-Agent` header showing wrong version (`ak-fetch/1.0` → `ak-fetch/2`)

### Changed

#### Behavior Changes (Breaking for Buggy Code Only)

**IMPORTANT:** These changes fix documented behavior to match actual implementation. If your code relied on the bugs, you'll need to update:

- **Transform now applied exactly once** (was twice): Non-idempotent transforms (counters, timestamp offsets, appends) now produce correct results. If you compensated for double-transform in your code, remove that compensation.

- **Retry semantics corrected**:
  - `retries: 0` → 1 attempt total (no retries) — was 4 attempts
  - `retries: null` → 1 attempt, fire-and-forget — was 4 attempts  
  - `retries: 3` → up to 4 attempts (1 + 3 retries) — unchanged

- **`batchSize: 0` now sends all records in one request** (was one request per record):
  - Migration: If you were relying on `batchSize: 0` sending one request per record (the buggy 2.0.16 behavior), change to `batchSize: 1` for the same result.
  - This matches the documented behavior in README, CLI help, and types

- **Connection pooling now real**: Socket reuse is now functional. `enableConnectionPooling: true` (default) uses persistent HTTP connections with proper keep-alive. Measured against the Mixpanel `/import` API with 100k records: toggling the flag moved throughput by 1.1% on 2.0.16 (i.e. it did nothing) versus 36.3% on 2.1.0, with average request latency down 26.7%.

- **Multipart uploads now work**: File uploads with `Content-Type: multipart/form-data` now function correctly using native FormData/Blob APIs.

- **Node.js >=18.17 required** (was >=16 which never worked): Documented engine requirement now matches reality. Native fetch requires Node 18+, and the `undici@6` dependency declares `engines: >=18.17`.

- **`maxTasks` means something different now.** Under the old run-queue engine it was a wave size: ak-fetch queued up to `maxTasks` tasks, paused the input stream, drained the queue all the way to zero, then started the next wave. Under the continuous TaskPool it is a plain backpressure high-water mark — the stream pauses while accepted-but-unfinished tasks are at or above `maxTasks` and resumes as soon as one finishes, with no drain-to-zero barrier. Two consequences worth knowing: (1) because the pool never accepts more than `concurrency` tasks at once, any `maxTasks` greater than `concurrency` can never fire, which includes the shipped defaults (`maxTasks: 25` vs `concurrency: 10`) — so for most users the setting is now inert and the sawtooth it used to cause is gone; and (2) `maxTasks: 0` now means "no backpressure at all" rather than the old effective "drain constantly." If you were using `maxTasks` to throttle memory, set it *below* your `concurrency` to keep having an effect. This is a behavior change to a field we otherwise froze for this release; we made it because the wave barrier was the direct cause of the throughput sawtooth fixed in C1, but it was not in the documented-contradiction list and is called out here for that reason.

- **A config array no longer forces `verbose: true`** (second half of B14): `setDefaults()` and `types.d.ts` have always documented `verbose` as defaulting to `false`, and the single-config path honored that, but the multi-config path defaulted it to `true` — so passing an array of configs printed a banner and progress bar that the identical work as a single config did silently. Both paths now default to `false`. Pass `verbose: true` on the first config to get the old array behavior back.

- **Invalid JSON responses now succeed instead of erroring**: Pre-2.1.0, a 200 response with `Content-Type: application/json` but unparseable JSON body produced an error (counted in `result.errors`). Now it resolves successfully with the raw text string as the response body. This matches the intended fallback behavior and enables handling of malformed JSON responses, but if your code relied on such responses surfacing as errors, you'll need to add explicit JSON validation.

- **Retry surface widened for network and timeout errors**: Connection resets (`ECONNRESET`, `ECONNREFUSED`, `EHOSTUNREACH`, etc.) and body/header timeouts are now correctly classified as retryable `NetworkError`/`TimeoutError` and will be retried by default when `retryOnNetworkError: true` (the default). This includes POST requests. If your endpoints are not idempotent, retrying failed requests may produce duplicate operations. Consider using `retryOn`/`retryHandler` to explicitly control retry behavior or set `retries: 0` for non-idempotent operations.

### Removed

- **Dependencies**: Removed unused/dead dependencies:
  - `fetch-retry` (never imported)
  - `form-data` (replaced with native FormData)
  - `json-stable-stringify` (imported but never called)
  - `querystring` (npm package, now uses Node.js built-in)
  - `readline` (npm package, Node.js built-in is used)
  - `run-queue` (replaced with internal TaskPool)

### Known tradeoffs

- **Peak heap on the `Minimal Memory` benchmark profile is higher, and we are shipping anyway.** The 2.1.0 spec set a gate of "no memory regression tolerated." One of six benchmark profiles missed it: `Minimal Memory` (`batchSize: 2000`, `concurrency: 3`, `storeResponses: false`, `maxResponseBuffer: 1`, `forceGC: true`) recorded 79.0MB peak heap on 2.1.0 against 46.4MB on main, at 26,929 rec/s against 32,174. That is a real number and we are not explaining it away, but local reproduction against a controlled server (100k records, 5 interleaved runs per branch) narrows what it means: peak heap does rise, by +38% (54.0MB vs 39.1MB), while *average* heap rises only +10%, peak RSS falls 6% (185.4MB vs 197.4MB), external/ArrayBuffer bytes fall 30%, and throughput on that profile *rises* 14% rather than falling. The throughput half of the original finding does not reproduce at all. Three follow-ups locate the cause: sweeping `maxTasks` from 3 to 25 changes peak heap not at all, so it is not the new backpressure model holding batches resident; throttling both branches to the same network-bound rate collapses the gap to +7%, inside noise; and running with `--expose-gc`, so that the profile's `forceGC: true` actually does something instead of silently no-opping, *inverts* the result — 45.1MB for 2.1.0 against 57.2MB for main. Peak `heapUsed` on this profile therefore measures how much garbage V8 tolerates before collecting, and 2.1.0 produces that garbage faster because it is faster. We accept it: every metric that reflects retained memory improved, the absolute peak is an order of magnitude below the 512MB default `maxMemoryUsage`, and the profile buys a 15-25% throughput gain across the rest of the suite. If peak heap is your binding constraint, run with `--expose-gc` so `forceGC` works, or lower `batchSize`. A live re-run of the benchmark suite is deferred. Details in `plans/completed/2.1.0/2.1.0-bench-results.md` §3.

- **`forceGC: true` is silently a no-op unless Node is started with `--expose-gc`.** `global.gc` does not otherwise exist, and ak-fetch guards on it rather than warning. This is unchanged from previous versions and is called out here because it is what made the benchmark result above so hard to read.

### Implementation Details

- Replaced node-fetch-style HTTP agents with undici `Agent` passed as `dispatcher` to native fetch
- Replaced wave-based RunQueue with continuous TaskPool for smooth concurrency. `TaskPool.submit()` resolves on *acceptance* (slot admission under the `maxTasks` backpressure cap), not completion — `drain()` is what awaits the work. Freed slots are handed directly to the next waiter in the same synchronous step so the pool can never over-admit past `concurrency`.
- `getStats()` keeps its pre-2.1.0 key shape, but undici 6's `Agent` exposes no `.stats`, so the `sockets`/`freeSockets` counts remain 0 rather than real socket counts
- Migrated multipart handling from `form-data` package to native FormData/Blob APIs
- Added case-insensitive header utilities (`getHeader`, `deleteHeader`)
- Fixed timeout coverage to include full request lifecycle (headers + body)
- Added proper 429 response body consumption before throwing RateLimitError
- Fixed logger TTY detection to prevent ANSI codes in non-TTY output
- Improved error messages to include underlying failure context

---

## [2.0.16] - 2025-07-03

Previous release. See git history for details.
