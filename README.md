# ak-fetch

## tldr;

A production-ready HTTP client for bulk operations with modern features like connection pooling, exponential backoff, streaming, and comprehensive error handling:

<img src="https://aktunes.neocities.org/ak-fetch.gif" />

## 🌍 Overview

`ak-fetch` is a powerful, modern HTTP client designed for bulk data operations and high-performance API interactions. Built from the ground up with 2025 production standards, it provides enterprise-grade features like connection pooling, intelligent retry strategies, memory-efficient streaming, and comprehensive monitoring.

Originally created for **[hello-mixpanel](https://github.com/ak--47/hello-mixpanel)** to handle massive data transfers to analytics APIs, ak-fetch has evolved into a robust solution for any bulk HTTP operation.

### ✨ Key Features

- 🚀 **High Performance**: HTTP connection pooling, keep-alive, and concurrent processing
- 🔄 **Smart Retries**: Exponential backoff with jitter and Retry-After header parsing
- 💾 **Memory Efficient**: Circular buffers and streaming to handle massive datasets
- 🔒 **Production Ready**: Comprehensive error handling and structured logging
- 🍪 **Session Management**: Built-in cookie jar for stateful API interactions
- 📊 **Real-time Monitoring**: Progress bars, throughput metrics, and memory tracking
- 🛠 **Developer Friendly**: Full TypeScript definitions and comprehensive JSDoc
- 📁 **File Upload**: Multipart form data and file upload support

## 🚀 Installation

```bash
npm install ak-fetch
```

Or use with npx:

```bash
npx ak-fetch --help
```

## 🖥️ Quick Start

### Basic Usage

```javascript
const akFetch = require('ak-fetch');

const result = await akFetch({
    url: 'https://api.example.com/bulk',
    data: [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
        { id: 3, name: 'Bob' }
    ],
    batchSize: 100,
    concurrency: 10,
    verbose: true
});

console.log(`Processed ${result.rowCount} records in ${result.clockTime}`);
```

### Streaming Large Files

```javascript
const result = await akFetch({
    url: 'https://api.example.com/events',
    data: './million-records.jsonl',
    batchSize: 1000,
    concurrency: 20,
    enableConnectionPooling: true,
    logFile: './results.json'
});
```

### Multiple Endpoints

```javascript
const results = await akFetch([
    {
        url: 'https://api1.example.com/users',
        data: userData,
        method: 'POST'
    },
    {
        url: 'https://api2.example.com/events',
        data: eventData,
        method: 'PUT'
    }
]);
```

### Command Line Interface

```bash
# Basic batch processing
npx ak-fetch ./data.json --url https://api.example.com --batchSize 50

# Advanced usage with all features
npx ak-fetch ./events.jsonl \
  --url https://api.example.com/events \
  --method POST \
  --batchSize 1000 \
  --concurrency 15 \
  --retries 5 \
  --enableCookies \
  --enableConnectionPooling \
  --verbose \
  --logFile ./results.json
```

## 📖 Comprehensive Configuration

### Core Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | **required** | Target API endpoint |
| `data` | `Array\|string\|Stream` | **required** | Data to send (array, file path, or stream) |
| `method` | `string` | `'POST'` | HTTP method (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS) |
| `batchSize` | `number` | `1` | Records per HTTP request (0 disables batching) |
| `concurrency` | `number` | `10` | Maximum concurrent requests |
| `headers` | `Object` | `{}` | Custom HTTP headers |

### Performance & Memory

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableConnectionPooling` | `boolean` | `true` | HTTP connection pooling for performance |
| `keepAlive` | `boolean` | `true` | Keep TCP connections alive |
| `maxTasks` | `number` | `25` | Max queued tasks before pausing stream |
| `maxResponseBuffer` | `number` | `1000` | Max responses kept in memory (circular buffer) |
| `maxMemoryUsage` | `number` | `undefined` | Memory limit in bytes |
| `forceGC` | `boolean` | `false` | Force garbage collection after batches |
| `highWaterMark` | `number` | `16384` | Stream buffer size |

### Retry Strategy

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `retries` | `number\|null` | `3` | Max retry attempts (null = fire-and-forget) |
| `retryDelay` | `number` | `1000` | Base retry delay in milliseconds |
| `retryOn` | `number[]` | `[408,429,500,502,503,504,520,521,522,523,524]` | HTTP status codes to retry |
| `useStaticRetryDelay` | `boolean` | `false` | Use fixed delays vs exponential backoff |
| `timeout` | `number` | `60000` | Request timeout in milliseconds |

### Logging & Output

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `verbose` | `boolean` | `true` | Enable progress display and logging |
| `logFile` | `string` | `undefined` | Save responses to file |
| `format` | `string` | `'json'` | Output format (json, csv, ndjson) |
| `responseHeaders` | `boolean` | `false` | Include response headers in output |
| `dryRun` | `boolean\|string` | `false` | Test mode (true or "curl" for curl commands) |

### Advanced Features

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableCookies` | `boolean` | `false` | Automatic cookie handling |
| `noBatch` | `boolean` | `false` | Send as single request without batching |
| `searchParams` | `Object` | `undefined` | URL query parameters |
| `bodyParams` | `Object` | `undefined` | Additional body parameters |
| `delay` | `number` | `0` | Delay between requests in milliseconds |
| `transform` | `Function` | `undefined` | Transform function for each record |
| `clone` | `boolean` | `false` | Clone data before transformation |

### Callbacks & Hooks

| Option | Type | Description |
|--------|------|-------------|
| `responseHandler` | `Function` | Called for each successful response |
| `errorHandler` | `Function` | Called for each failed request |
| `retryHandler` | `Function` | Custom retry decision logic |
| `hook` | `Function` | Post-processing for array configurations |

### Authentication

| Option | Type | Description |
|--------|------|-------------|
| `shell` | `Object` | Execute shell command for dynamic headers |
| `shell.command` | `string` | Shell command to run |
| `shell.header` | `string` | Header name (default: 'Authorization') |
| `shell.prefix` | `string` | Header value prefix (default: 'Bearer') |

## 🛠 Advanced Usage Examples

### File Upload with Multipart Form Data

```javascript
const result = await akFetch({
    url: 'https://api.example.com/upload',
    method: 'POST',
    data: [{
        name: 'document',
        file: './important-file.pdf',
        description: 'Important document'
    }],
    headers: { 'Content-Type': 'multipart/form-data' }
});
```

### Dynamic Authentication with Shell Commands

```javascript
const result = await akFetch({
    url: 'https://api.example.com/secure',
    data: records,
    shell: {
        command: 'aws sts get-session-token --query "Credentials.SessionToken" --output text',
        header: 'Authorization',
        prefix: 'AWS4-HMAC-SHA256'
    }
});
```

### Memory-Efficient Large Dataset Processing

```javascript
const result = await akFetch({
    url: 'https://api.example.com/bulk',
    data: './100gb-dataset.jsonl',
    batchSize: 5000,
    concurrency: 25,
    maxResponseBuffer: 100,      // Keep only last 100 responses
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB limit
    storeResponses: false,       // Don't store responses
    forceGC: true,              // Force garbage collection
    verbose: true
});
```

### Custom Error Handling and Transformation

```javascript
const result = await akFetch({
    url: 'https://api.example.com/process',
    data: rawData,
    transform: (record) => ({
        ...record,
        timestamp: Date.now(),
        source: 'ak-fetch'
    }),
    responseHandler: (response) => {
        console.log(`✅ Batch processed: ${response.status}`);
    },
    errorHandler: (error) => {
        console.error(`❌ Batch failed: ${error.message}`);
        // Custom error logging or recovery
    },
    retryHandler: (error, attempt) => {
        // Custom retry logic
        return error.status === 429 && attempt < 10;
    }
});
```

### Session Management with Cookies

```javascript
const result = await akFetch({
    url: 'https://api.example.com/authenticated',
    data: userData,
    enableCookies: true,
    method: 'POST'
});
// Cookies automatically maintained across requests
```

### Comprehensive Monitoring Setup

```javascript
const result = await akFetch({
    url: 'https://api.example.com/analytics',
    data: './events.jsonl',
    batchSize: 1000,
    concurrency: 15,
    verbose: true,
    logFile: './processing-results.json',
    format: 'ndjson',
    responseHeaders: true
});

console.log(`
📊 Processing Complete:
   • Requests: ${result.reqCount}
   • Records: ${result.rowCount}
   • Duration: ${result.clockTime}
   • Throughput: ${result.rps} req/s
   • Errors: ${result.errors}
   • Memory: ${result.stats.heapUsed}MB
`);
```

## 📊 Response Object

The response object contains comprehensive metrics:

```javascript
{
    responses: [...],           // Array of API responses
    duration: 30000,           // Total time in milliseconds
    clockTime: "30.0s",        // Human-readable duration
    reqCount: 150,             // Number of HTTP requests made
    rowCount: 15000,           // Number of records processed
    rps: 5,                    // Requests per second
    errors: 2,                 // Number of failed requests
    stats: {                   // Memory usage statistics
        heapUsed: 45.2,        // MB
        heapTotal: 67.8,       // MB
        external: 3.1,         // MB
        rss: 89.5              // MB
    }
}
```

## 🧪 Testing & Development

Run the test suite:

```bash
npm test
```

Run integration tests:

```bash
npm run test:integration
```

Generate coverage report:

```bash
npm run test:coverage
```

## 🏗 Architecture

ak-fetch is built with a modular architecture:

- **Core Engine** (`index.js`): Main processing logic and stream handling
- **HTTP Client** (`lib/http-client.js`): Connection pooling and request management
- **Retry Strategy** (`lib/retry-strategy.js`): Exponential backoff and error handling
- **Circular Buffer** (`lib/circular-buffer.js`): Memory-efficient response storage
- **Logger** (`lib/logger.js`): Progress tracking and performance monitoring
- **Stream Processors** (`lib/stream-processors.js`): Data transformation and streaming
- **Cookie Jar** (`lib/cookie-jar.js`): Session management
- **Form Data Handler** (`lib/form-data-handler.js`): File upload support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

### Development Setup

```bash
git clone https://github.com/ak--47/ak-fetch.git
cd ak-fetch
npm install
npm test
```

## 📄 License

ak-fetch is ISC licensed.

---

**Built with ❤️ for high-performance data processing**