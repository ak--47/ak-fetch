# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ak-fetch is a production-ready HTTP client designed for bulk operations and high-performance API interactions. Built as an ESM module with TypeScript definitions, it handles massive data transfers with features like connection pooling, exponential backoff, streaming, and comprehensive error handling.

Originally created for analytics APIs like Mixpanel, it's evolved into a robust solution for any bulk HTTP operation.

## Development Commands

### Testing
- `npm test` - Run all tests with Vitest
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:coverage` - Generate coverage report and open in browser
- `npm run test:types` - Run type tests
- `npm run test:types:consumer` - Test consumer type definitions
- `npm run typecheck` - Full typecheck (library + consumer definitions)

### Building
- `npm run build` - Build CommonJS distribution
- `npm run build:cjs` - Build main CommonJS distribution (same as build)

### Benchmarking
- `npm run bench:100k` - Run benchmarks with 100k dataset (requires --expose-gc)
- `npm run bench:1m` - Run benchmarks with 1m dataset (requires --expose-gc)

### Utilities
- `npm run prune` - Clean logs, coverage, benchmark results, and dist directories
- `npm run scratch` - Run development scratch file with nodemon

## Architecture

### Core Engine (`index.js`)
Main processing logic with streaming, batching, and concurrency control. Key functions:
- `main()` - Primary entry point handling single/multiple configurations
- `processSingleConfig()` - Processes one endpoint with batching and streaming
- `processDataStream()` - Core stream processing with HTTP requests and retry logic
- `createDataStream()` - Converts arrays/files/streams into standardized readable streams

### Modular Components (`lib/`)
- **http-client.js** - HTTP client using undici Agent dispatcher passed to native fetch for connection pooling, with retry strategies and cookie/form-data support
- **concurrency.js** - TaskPool implementation for continuous concurrency control (submit resolves on acceptance under maxTasks backpressure, drain awaits completion)
- **circular-buffer.js** - Memory-efficient response storage with configurable limits
- **stream-processors.js** - Data transformation, JSONL parsing, and file streaming utilities
- **logger.js** - Progress tracking with throughput metrics and memory monitoring
- **retry-strategy.js** - Exponential backoff with jitter and Retry-After header parsing
- **presets.js** - Vendor-specific transforms (Mixpanel, Amplitude, etc.)
- **errors.js** - Custom error classes for different failure types
- **cookie-jar.js** - Session management for stateful API interactions
- **form-data-handler.js** - Multipart form data and file upload support using native FormData/Blob (openAsBlob on Node >=19.8, Blob fallback on 18 via fs namespace import)

### Configuration System
Uses `BatchRequestConfig` interface with comprehensive options for:
- **Performance**: `batchSize`, `concurrency`, `maxTasks`, `enableConnectionPooling`
- **Retry Logic**: `retries`, `retryDelay`, `retryOn`, `useStaticRetryDelay`
- **Memory Management**: `maxResponseBuffer`, `maxMemoryUsage`, `forceGC`
- **Data Processing**: `transform`, `preset`, `clone`
- **Output Control**: `verbose`, `logFile`, `format`, `dryRun`

## Key Features & Patterns

### Data Flow Architecture
1. **Input Processing**: Arrays/files/streams → standardized readable streams
2. **Transformation Pipeline**: Preset transforms → user transforms → batching (transforms apply exactly once in the stream loop)
3. **HTTP Processing**: Connection pooled requests with retry logic
4. **Response Collection**: Circular buffer storage with memory limits
5. **Output**: Structured results with comprehensive metrics

### Connection Pooling
Real connection pooling via undici Agent dispatcher passed to native fetch. `enableConnectionPooling: true` (default) enables HTTP keep-alive for socket reuse.

### Concurrency Control
TaskPool provides continuous concurrency management:
- `submit()` resolves on acceptance (slot admission under maxTasks backpressure cap)
- `maxTasks` is a high-water mark - stream pauses when accepted-but-unfinished tasks reach maxTasks
- Effective only when maxTasks < concurrency (default maxTasks: 25 vs concurrency: 10 never triggers)
- `drain()` awaits all work completion

### Retry Semantics
- `retries: 0` = 1 attempt total (no retries)
- `retries: null` = fire-and-forget (1 attempt, no response storage)
- `retries: 3` = up to 4 attempts (1 + 3 retries)

### Batch Size
- `batchSize: 0` = one request with all records (Infinity batch)
- `batchSize: 1` = one request per record (default)

### Memory Management
- Circular buffers prevent unbounded memory growth
- Stream backpressure controls memory usage
- Optional garbage collection forcing (requires Node started with --expose-gc)
- Memory monitoring with configurable limits

### Error Handling Strategy
- Custom error classes: `NetworkError`, `TimeoutError`, `ValidationError`, etc.
- Retry logic with exponential backoff and jitter
- Configurable retry conditions and custom retry handlers
- Error responses stored alongside successful responses

### Multi-Config Processing
When processing arrays of configurations:
- Concurrent execution with shared concurrency limits
- Individual error handling doesn't stop other configs
- Optional `hook` function for result post-processing
- Comprehensive timing and error metrics

### Multipart Form Data
Native FormData/Blob APIs handle file uploads. On Node >=19.8, uses openAsBlob for zero-copy streaming. On Node 18, falls back to Blob constructor. The openAsBlob import is accessed via fs namespace (never static named import) to avoid ESM link-time failures on Node 18.

## Testing Strategy

- **Unit tests** (`test/unit/`) - Individual component testing
- **Integration tests** (`test/integration/`) - End-to-end functionality
- **Test fixtures** (`testData/`) - Sample data files for testing
- **Coverage threshold** - 80% for branches, functions, lines, statements
- **443 tests**, all pass offline in ~4 seconds with no live network dependencies (uses test/helpers/local-server.js)

## CLI Integration

The project includes a CLI (`cli.js`) that exposes all functionality via command-line interface with yargs argument parsing.

## Development Notes

- **ES Modules**: Project uses ESM with Node.js >=18.17 requirement
- **TypeScript**: Full type definitions in `types.d.ts` with JSDoc comments
- **CommonJS Distribution**: Built versions available in `dist/` for compatibility
- **Vendor Presets**: Built-in data transforms for popular APIs (Mixpanel, etc.)
- **Fire-and-forget Mode**: Setting `retries: null` disables response storage for max performance

## Conventions

Completed plan/meta documents move to `./plans/completed/<version>/` when a release ships. Active working docs live in `./plans/`.
