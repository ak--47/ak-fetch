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
- **B8**: Fixed CLI reading `./package.json` from CWD instead of package directory
- **B9**: Fixed CLI `parse()` error handler referencing undefined `this.verbose`
- **B10**: Fixed `engines: node >=16` when Node 16 lacks native fetch (now requires `>=18`)
- **B11**: Fixed `CircularBuffer(0)` silently corrupting storage with NaN indexes
- **B12**: Fixed logger writing ANSI cursor codes to non-TTY streams, polluting logs/CI output
- **B13**: Fixed `executeSingleRequest` always reporting `duration: 0`
- **B14**: Fixed multi-config stats being self-inconsistent between logs and return value
- **B15**: Fixed CLI `batch_size` default of 2 contradicting library default of 1

#### Performance & Architecture
- **C1**: Fixed wave-based concurrency causing sawtooth throughput — replaced with continuous task pool
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
  - Migration: Use `batchSize: 1` for per-record requests
  - This matches the documented behavior in README, CLI help, and types

- **Connection pooling now real**: Socket reuse is now functional. `enableConnectionPooling: true` (default) uses persistent HTTP connections with proper keep-alive. Throughput improvements expected for multi-request workloads.

- **Multipart uploads now work**: File uploads with `Content-Type: multipart/form-data` now function correctly using native FormData/Blob APIs.

- **Node.js >=18 required** (was >=16 which never worked): Documented engine requirement now matches reality. Native fetch requires Node 18+.

### Removed

- **Dependencies**: Removed unused/dead dependencies:
  - `fetch-retry` (never imported)
  - `form-data` (replaced with native FormData)
  - `json-stable-stringify` (imported but never called)
  - `querystring` (npm package, now uses Node.js built-in)
  - `readline` (npm package, Node.js built-in is used)
  - `run-queue` (replaced with internal TaskPool)

### Implementation Details

- Replaced node-fetch-style HTTP agents with undici `Agent` passed as `dispatcher` to native fetch
- Replaced wave-based RunQueue with continuous TaskPool for smooth concurrency
- Migrated multipart handling from `form-data` package to native FormData/Blob APIs
- Added case-insensitive header utilities (`getHeader`, `deleteHeader`)
- Fixed timeout coverage to include full request lifecycle (headers + body)
- Added proper 429 response body consumption before throwing RateLimitError
- Fixed logger TTY detection to prevent ANSI codes in non-TTY output
- Improved error messages to include underlying failure context

---

## [2.0.16] - 2025-07-03

Previous release. See git history for details.
