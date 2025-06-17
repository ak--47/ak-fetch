# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm test` - Run Jest tests with 60s timeout
- `npm run coverage` - Generate coverage report and open in browser
- `npm run prune` - Clean logs directory
- `npm run scratch` - Run scratch.mjs with nodemon for development

### Usage
- `node index.js` or `npx ak-fetch` - Run CLI
- `npx ak-fetch --help` - Show CLI help and options

## Architecture

ak-fetch is a Node.js HTTP client for bulk POST requests with batching, queuing, and retry capabilities.

### Core Components

**Main Module (`index.js`)**
- Exports the main function that handles both single configs and arrays of configs
- Uses `run-queue` for concurrency control and `fetch-retry` for HTTP requests
- Supports streaming data from files, arrays, or readable streams
- Implements backpressure with configurable `maxTasks` to prevent memory issues

**CLI Interface (`cli.js`)**
- Uses `yargs` for command-line argument parsing
- Supports both camelCase and snake_case options
- Can accept data from files (JSON/JSONL), inline payloads, or as arguments
- Automatically detects and parses JSON vs JSONL format

**Key Features**
- Batching: Groups records into configurable batch sizes before sending
- Streaming: Processes large datasets without loading everything into memory
- Queue Management: Pauses/resumes streams based on queue size to control memory usage
- Retry Logic: Configurable retries with exponential backoff on specified HTTP status codes
- Output Formats: Supports JSON, CSV, and NDJSON for logging responses

### Data Flow
1. Data input → Stream creation (from file, array, or readable stream)
2. Stream processing → Batching records
3. Queue management → HTTP requests with retry logic
4. Response handling → Optional logging to file

### Configuration
The main function accepts a `BatchRequestConfig` object with options for URL, data, batching, concurrency, retries, headers, and various other HTTP parameters. CLI automatically maps command-line flags to this configuration object.