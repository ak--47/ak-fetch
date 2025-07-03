# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm test` - Run all Jest tests (unit + integration) with 10s timeout
- `npm run test:unit` - Run only unit tests
- `npm run test:integration` - Run only integration tests
- `npm run test:watch` - Run tests in watch mode for development
- `npm run test:coverage` - Generate coverage report and open in browser
- `npm run test:ci` - Run tests for CI with coverage
- `npm run prune` - Clean logs directory
- `npm run scratch` - Run scratch.mjs with nodemon for development

### Benchmarks
- `npm run bench:100k` - Run complete suite with 100k dataset only
- `npm run bench:1m` - Run complete suite with 1m dataset only

### Individual Benchmark Execution
Each benchmark can be run directly with Node.js (defaults to 100k dataset):
- `node benchmarks/batch-size-test.js` - Batch size optimization
- `node benchmarks/concurrency-test.js` - Concurrency optimization  
- `node benchmarks/memory-test.js` - Memory efficiency
- `node benchmarks/connection-pooling-test.js` - Connection pooling
- `node benchmarks/throughput-optimization.js` - Throughput optimization
- `node benchmarks/error-resilience-test.js` - Error resilience

### Benchmark Dataset Control
Set `DATASET_SIZE` environment variable to control dataset:
- `DATASET_SIZE=100k node benchmarks/batch-size-test.js` - Use 100k dataset
- `DATASET_SIZE=1m node benchmarks/batch-size-test.js` - Use 1m dataset

### Usage
- `node index.js` or `npx ak-fetch` - Run CLI
- `npx ak-fetch --help` - Show CLI help and options

## Architecture

ak-fetch is a Node.js HTTP client for bulk operations with batching, queuing, retry capabilities, and connection pooling. Built with a modular architecture for production use.

### Core Components

**Main Module (`index.js`)**
- Exports the main function that handles both single configs and arrays of configs
- Uses `run-queue` for concurrency control and `undici` for HTTP requests
- Supports streaming data from files, arrays, or readable streams
- Implements backpressure with configurable `maxTasks` to prevent memory issues

**CLI Interface (`cli.js`)**
- Uses `yargs` for command-line argument parsing
- Supports both camelCase and snake_case options
- Can accept data from files (JSON/JSONL), inline payloads, or as arguments
- Automatically detects and parses JSON vs JSONL format

**Modular Library (`lib/` directory)**
- `http-client.js` - HTTP connection pooling and request management
- `retry-strategy.js` - Exponential backoff and retry logic
- `circular-buffer.js` - Memory-efficient response storage
- `logger.js` - Progress tracking and performance monitoring
- `stream-processors.js` - Data transformation and streaming utilities
- `cookie-jar.js` - Session management with cookie support
- `form-data-handler.js` - File upload and multipart form data
- `presets.js` - Vendor-specific data transformations (Mixpanel, etc.)
- `errors.js` - Custom error classes for different failure modes

### Key Features
- **Connection Pooling**: HTTP/1.1 keep-alive and connection reuse
- **Batching**: Groups records into configurable batch sizes before sending
- **Streaming**: Processes large datasets without loading everything into memory
- **Queue Management**: Pauses/resumes streams based on queue size to control memory usage
- **Retry Logic**: Configurable retries with exponential backoff on specified HTTP status codes
- **Memory Management**: Circular buffers, memory monitoring, and garbage collection controls
- **Vendor Presets**: Built-in transformations for popular APIs (Mixpanel, Amplitude, Pendo)
- **File Uploads**: Multipart form data support for file uploads
- **Session Management**: Cookie jar for stateful API interactions
- **Output Formats**: Supports JSON, CSV, and NDJSON for logging responses

### Data Flow
1. Data input → Stream creation (from file, array, or readable stream)
2. Preset transformations → User transformations (if specified)
3. Stream processing → Batching records
4. Queue management → HTTP requests with connection pooling
5. Retry logic → Exponential backoff on failures
6. Response handling → Circular buffer storage → Optional file logging

### Testing Structure
- **Unit Tests** (`test/unit/`): Individual component testing with mocks
- **Integration Tests** (`test/integration/`): End-to-end functionality testing
- **Test Setup**: Jest with 10s timeout, coverage thresholds at 80%
- **Fixtures**: Sample data files in `test/fixtures/` and `testData/`

### Benchmark Suite
- **Real-world Testing**: All benchmarks use Mixpanel Import API with actual event data
- **Comprehensive Coverage**: 6 benchmark categories for production optimization
- **Batch Size Optimization** (`benchmarks/batch-size-test.js`): Tests 250-3000 events per batch
- **Concurrency Testing** (`benchmarks/concurrency-test.js`): Tests 5-40 concurrent requests
- **Memory Efficiency** (`benchmarks/memory-test.js`): Memory usage patterns and optimization
- **Connection Pooling** (`benchmarks/connection-pooling-test.js`): HTTP keep-alive performance benefits
- **Throughput Optimization** (`benchmarks/throughput-optimization.js`): Maximum events/second testing
- **Error Resilience** (`benchmarks/error-resilience-test.js`): Retry strategies and failure recovery
- **Complete Suite Runner** (`benchmarks/run-all.js`): Runs all benchmarks with comprehensive reporting
- **Requirements**: MIXPANEL_AUTH environment variable in `.env` file

### Configuration
The main function accepts a `BatchRequestConfig` object with comprehensive options for URL, data, batching, concurrency, retries, headers, memory management, authentication, and various HTTP parameters. The TypeScript definitions in `types.d.ts` provide complete interface documentation. CLI automatically maps command-line flags to this configuration object.