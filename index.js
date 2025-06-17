#! /usr/bin/env node

/**
 * ak-fetch - Modern HTTP client for bulk operations
 * 2025 production-ready version with advanced features
 */

const RunQueue = require("run-queue");
const { json, isJSONStr, comma, makeExist } = require("ak-tools");
const cli = require('./cli');
const { execSync } = require('child_process');
const { Readable } = require('stream');
const path = require('path');
const { createReadStream, existsSync } = require('fs');
require('dotenv').config({ debug: false, override: false });

// Import new modular components
const HttpClient = require('./lib/http-client');
const CircularBuffer = require('./lib/circular-buffer');
const StreamProcessors = require('./lib/stream-processors');
const { createLogger } = require('./lib/logger');
const { 
    AkFetchError, 
    NetworkError, 
    TimeoutError, 
    ValidationError,
    ConfigurationError,
    MemoryError 
} = require('./lib/errors');

/**
 * Configuration object for ak-fetch HTTP requests
 * @typedef {Object} BatchRequestConfig
 * 
 * @description Main configuration object that controls all aspects of HTTP request processing
 * 
 * @property {string} url - The target URL for HTTP requests
 * @example "https://api.example.com/users"
 * 
 * @property {Object[]|string|import('stream').Readable} [data] - Data to be sent in requests
 * @description Can be an array of objects, file path to JSON/JSONL, or a readable stream
 * @example [{ id: 1, name: "John" }, { id: 2, name: "Jane" }]
 * @example "./data.jsonl"
 * @example fs.createReadStream("./large-dataset.jsonl")
 * 
 * @property {number} [batchSize=1] - Number of records per HTTP request
 * @description Groups data into batches. Use 0 to disable batching
 * @example 100 // Send 100 records per request
 * 
 * @property {number} [concurrency=10] - Maximum concurrent HTTP requests
 * @description Controls how many requests run simultaneously
 * @example 5 // Run up to 5 requests at once
 * 
 * @property {number} [maxTasks=25] - Maximum queued tasks before pausing stream
 * @description Prevents memory overflow by controlling queue size
 * @example 50 // Allow up to 50 queued requests
 * 
 * @property {number} [delay=0] - Delay between requests in milliseconds
 * @description Adds intentional delay between requests for rate limiting
 * @example 1000 // Wait 1 second between requests
 * 
 * @property {Object} [searchParams] - URL query parameters
 * @description Object that gets converted to query string
 * @example { api_key: "123", format: "json" } // ?api_key=123&format=json
 * 
 * @property {Object} [bodyParams] - Additional body parameters
 * @description Extra parameters merged with data payload
 * @example { dataKey: "events" } // Wraps data in { events: [...] }
 * 
 * @property {Object} [headers={}] - HTTP headers for requests
 * @description Custom headers sent with each request
 * @example { "Authorization": "Bearer token123", "Content-Type": "application/json" }
 * 
 * @property {boolean} [verbose=true] - Enable detailed logging and progress display
 * @description Shows progress bars, timing, and throughput information
 * @example false // Silent operation
 * 
 * @property {boolean|string} [dryRun=false] - Test mode without making actual requests
 * @description Use "curl" to generate curl commands instead of requests
 * @example "curl" // Generate curl commands
 * @example true // Show request details without sending
 * 
 * @property {string} [logFile] - File path to save response data
 * @description Automatically saves all responses to specified file
 * @example "./responses.json"
 * @example "./results.csv"
 * 
 * @property {number|null} [retries=3] - Number of retry attempts for failed requests
 * @description Use null for fire-and-forget mode (no retries)
 * @example 5 // Retry up to 5 times
 * @example null // No retries, fire-and-forget
 * 
 * @property {number} [retryDelay=1000] - Base delay between retries in milliseconds
 * @description Used with exponential backoff unless useStaticRetryDelay is true
 * @example 2000 // Start with 2 second delay
 * 
 * @property {number[]} [retryOn] - HTTP status codes that trigger retries
 * @description Defaults to [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]
 * @example [500, 502, 503] // Only retry on these status codes
 * 
 * @property {number} [timeout=60000] - Request timeout in milliseconds
 * @description How long to wait for each request to complete
 * @example 30000 // 30 second timeout
 * 
 * @property {boolean} [keepAlive=true] - Use HTTP connection pooling
 * @description Reuses connections for better performance
 * @example false // Disable connection pooling
 * 
 * @property {Object} [shell] - Shell command configuration for dynamic headers
 * @description Execute shell command to get dynamic values (e.g., auth tokens)
 * @example { command: "aws sts get-session-token", header: "Authorization", prefix: "AWS4-HMAC-SHA256" }
 * 
 * @property {string} [method='POST'] - HTTP method to use
 * @description Supports GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
 * @example "PUT"
 * @example "GET"
 * 
 * @property {boolean} [debug=false] - Enable debug mode with detailed error info
 * @description Provides additional debugging information on failures
 * @example true // Enable debug mode
 * 
 * @property {number} [highWaterMark=16384] - Stream buffer size in bytes
 * @description Controls memory usage for stream processing
 * @example 32768 // 32KB buffer
 * 
 * @property {Function} [transform] - Data transformation function
 * @description Function to modify each data item before sending
 * @example (item) => ({ ...item, timestamp: Date.now() })
 * 
 * @property {Function} [errorHandler] - Custom error handling function
 * @description Function to handle request errors
 * @example (error) => console.log("Request failed:", error.message)
 * 
 * @property {Function} [responseHandler] - Response processing function
 * @description Function called with each successful response
 * @example (response) => console.log("Success:", response.status)
 * 
 * @property {Function} [retryHandler] - Custom retry logic function
 * @description Override default retry behavior
 * @example (error, attempt) => error.status === 429 && attempt < 5
 * 
 * @property {Function} [hook] - Post-processing hook for array configurations
 * @description Function to process all results after completion
 * @example (results) => results.map(r => r.data)
 * 
 * @property {boolean} [storeResponses=true] - Store responses in memory
 * @description Set to false to reduce memory usage for large operations
 * @example false // Don't store responses
 * 
 * @property {boolean} [clone=false] - Clone data before transformation
 * @description Prevents mutation of original data objects
 * @example true // Protect original data
 * 
 * @property {boolean} [forceGC=false] - Force garbage collection after batches
 * @description Helps with memory management in long-running operations
 * @example true // Force GC after each batch
 * 
 * @property {boolean} [noBatch=false] - Disable batching for single requests
 * @description Send data as single request instead of batching
 * @example true // Single request mode
 * 
 * @property {string} [format='json'] - Output format for log files
 * @description Supported formats: json, csv, ndjson
 * @example "csv" // Save as CSV file
 * 
 * @property {boolean} [responseHeaders=false] - Include response headers in output
 * @description Adds HTTP headers to response objects
 * @example true // Include headers
 * 
 * @property {boolean} [enableCookies=false] - Enable automatic cookie handling
 * @description Maintains session cookies across requests
 * @example true // Enable cookie jar
 * 
 * @property {number} [maxResponseBuffer=1000] - Maximum responses kept in memory
 * @description Uses circular buffer to prevent memory overflow
 * @example 500 // Keep last 500 responses
 * 
 * @property {number} [maxMemoryUsage] - Maximum memory usage in bytes before error
 * @description Throws error if memory usage exceeds limit
 * @example 1024 * 1024 * 1024 // 1GB limit
 * 
 * @property {boolean} [useStaticRetryDelay=false] - Use fixed retry delay instead of exponential backoff
 * @description Disables exponential backoff in favor of static delays
 * @example true // Use fixed delays
 * 
 * @property {boolean} [enableConnectionPooling=true] - Enable HTTP connection pooling
 * @description Improves performance by reusing TCP connections
 * @example false // Disable connection pooling
 * 
 * @property {number} [maxFileSize] - Maximum file size for uploads in bytes
 * @description Only used with multipart form data
 * @example 10 * 1024 * 1024 // 10MB limit
 */

/**
 * Result object returned by ak-fetch operations
 * @typedef {Object} Result
 * 
 * @property {Object[]} responses - Array of HTTP response objects from the API
 * @description Each response contains the parsed response data and metadata
 * @example [{ data: { success: true }, status: 200, statusText: "OK" }]
 * 
 * @property {number} duration - Total operation duration in milliseconds
 * @description Time from start to completion of all requests
 * @example 5432 // 5.432 seconds
 * 
 * @property {string} clockTime - Human-readable duration string
 * @description Formatted duration for easy reading
 * @example "5.4s" or "2m 15s"
 * 
 * @property {number} reqCount - Total number of HTTP requests made
 * @description Includes both successful and failed requests
 * @example 150 // Made 150 HTTP requests
 * 
 * @property {number} rowCount - Total number of data records processed
 * @description Number of individual data items that were sent
 * @example 15000 // Processed 15,000 records
 * 
 * @property {number} rps - Requests per second throughput
 * @description Average request rate during the operation
 * @example 27 // 27 requests per second
 * 
 * @property {number} [errors=0] - Number of failed requests
 * @description Count of requests that ultimately failed after retries
 * @example 3 // 3 requests failed
 * 
 * @property {Object} stats - Performance and memory statistics
 * @description Detailed metrics about memory usage and performance
 * @property {number} stats.heapUsed - Heap memory used in MB
 * @property {number} stats.heapTotal - Total heap memory in MB
 * @property {number} stats.external - External memory in MB
 * @property {number} stats.rss - Resident set size in MB
 * @example { heapUsed: 25.5, heapTotal: 50.2, external: 2.1, rss: 75.8 }
 * 
 * @property {number} [configCount] - Number of configurations processed (array mode only)
 * @description Only present when processing multiple configurations
 * @example 5 // Processed 5 different endpoint configurations
 */

/**
 * Main ak-fetch function for HTTP request processing
 * 
 * @description
 * Primary entry point for ak-fetch. Handles both single configurations and arrays of 
 * configurations for multiple endpoints. Provides intelligent batching, retry logic,
 * connection pooling, and comprehensive error handling.
 * 
 * @param {BatchRequestConfig|BatchRequestConfig[]} PARAMS - Configuration object or array
 * @description
 * - Single config: Process one endpoint with data batching
 * - Array of configs: Process multiple endpoints with concurrency control
 * 
 * @returns {Promise<Result|Result[]>} Promise resolving to results
 * @description
 * - Single config: Returns Result object
 * - Array of configs: Returns array of Result objects or processed results from hook
 * 
 * @throws {ValidationError} When required parameters are missing or invalid
 * @throws {ConfigurationError} When configuration values are invalid
 * @throws {NetworkError} When network connectivity issues occur
 * @throws {TimeoutError} When requests exceed timeout limits
 * @throws {RetryError} When all retry attempts are exhausted
 * @throws {MemoryError} When memory usage exceeds configured limits
 * 
 * @example
 * // Simple POST request with data array
 * const result = await akFetch({
 *   url: 'https://api.example.com/users',
 *   data: [{ name: 'John' }, { name: 'Jane' }],
 *   batchSize: 10,
 *   concurrency: 5
 * });
 * console.log(`Processed ${result.rowCount} records in ${result.clockTime}`);
 * 
 * @example
 * // File upload with multipart form data
 * const result = await akFetch({
 *   url: 'https://api.example.com/upload',
 *   method: 'POST',
 *   data: [{
 *     name: 'document',
 *     file: './important-file.pdf',
 *     description: 'Important document'
 *   }],
 *   headers: { 'Content-Type': 'multipart/form-data' }
 * });
 * 
 * @example
 * // High-performance streaming from large file
 * const result = await akFetch({
 *   url: 'https://api.example.com/events',
 *   data: './million-records.jsonl',
 *   batchSize: 1000,
 *   concurrency: 20,
 *   enableConnectionPooling: true,
 *   verbose: true,
 *   logFile: './results.json'
 * });
 * 
 * @example
 * // Multiple endpoints with custom processing
 * const results = await akFetch([
 *   {
 *     url: 'https://api1.example.com/data',
 *     data: dataset1,
 *     method: 'POST'
 *   },
 *   {
 *     url: 'https://api2.example.com/sync',
 *     data: dataset2,
 *     method: 'PUT',
 *     retries: 5
 *   }
 * ]);
 * 
 * @example
 * // Advanced configuration with all features
 * const result = await akFetch({
 *   url: 'https://api.example.com/analytics',
 *   data: './events.jsonl',
 *   method: 'POST',
 *   batchSize: 500,
 *   concurrency: 10,
 *   retries: 3,
 *   retryDelay: 2000,
 *   useStaticRetryDelay: false, // Use exponential backoff
 *   enableCookies: true,
 *   enableConnectionPooling: true,
 *   maxResponseBuffer: 1000,
 *   verbose: true,
 *   logFile: './analytics-results.json',
 *   headers: {
 *     'Authorization': 'Bearer token123',
 *     'X-API-Version': '2.0'
 *   },
 *   transform: (item) => ({
 *     ...item,
 *     timestamp: Date.now(),
 *     processed: true
 *   }),
 *   responseHandler: (response) => {
 *     console.log(`Batch completed: ${response.status}`);
 *   },
 *   errorHandler: (error) => {
 *     console.error(`Batch failed: ${error.message}`);
 *   }
 * });
 * 
 * @since 1.0.0
 * @version 2.0.0
 */
async function main(PARAMS) {
    validateInput(PARAMS);

    // Handle array of configurations (multiple endpoints)
    if (Array.isArray(PARAMS)) {
        return await processMultipleConfigs(PARAMS);
    }

    // Process single configuration
    return await processSingleConfig(PARAMS);
}

/**
 * Validate input parameters for ak-fetch operations
 * 
 * @description
 * Validates the input parameters to ensure they meet the basic requirements.
 * Checks for URL presence and validates array configurations.
 * 
 * @param {any} PARAMS - Parameters to validate
 * @throws {ValidationError} When parameters are invalid or missing required fields
 * 
 * @example
 * validateInput({ url: 'https://api.example.com' }); // Valid
 * validateInput([{ url: 'https://api1.com' }, { url: 'https://api2.com' }]); // Valid array
 * validateInput({}); // Throws ValidationError - no URL
 * 
 * @since 2.0.0
 */
function validateInput(PARAMS) {
    if (!PARAMS) {
        throw new ValidationError('No parameters provided');
    }

    if (Array.isArray(PARAMS)) {
        if (PARAMS.length === 0) {
            throw new ValidationError('Empty configuration array provided');
        }
        PARAMS.forEach((config, index) => {
            if (!config.url) {
                throw new ValidationError(`No URL provided for config at index ${index}`);
            }
        });
    } else {
        if (!PARAMS.url) {
            throw new ValidationError('No URL provided');
        }
    }
}

/**
 * Process multiple configurations with concurrency control
 * 
 * @description
 * Handles multiple endpoint configurations concurrently. Each configuration
 * is processed independently with shared concurrency limits and timing.
 * Results can be post-processed with a hook function.
 * 
 * @param {BatchRequestConfig[]} configs - Array of configurations to process
 * @description Each config represents a different endpoint or operation
 * 
 * @returns {Promise<Result[]>} Promise resolving to array of results
 * @description Returns array of Result objects or processed results if hook is provided
 * 
 * @throws {ValidationError} When configurations are invalid
 * @throws {NetworkError} When network issues occur
 * @throws {TimeoutError} When operations exceed timeout limits
 * 
 * @example
 * // Process multiple API endpoints
 * const results = await processMultipleConfigs([
 *   {
 *     url: 'https://api1.example.com/users',
 *     data: userData,
 *     method: 'POST'
 *   },
 *   {
 *     url: 'https://api2.example.com/events',
 *     data: eventData,
 *     method: 'PUT'
 *   }
 * ]);
 * 
 * @example
 * // With custom hook processing
 * const configs = [...];
 * configs[0].hook = (results) => results.map(r => r.responses).flat();
 * const flatResults = await processMultipleConfigs(configs);
 * 
 * @since 2.0.0
 */
async function processMultipleConfigs(configs) {
    const startTime = Date.now();
    const firstConfig = configs[0];
    const concurrency = firstConfig?.concurrency || 10;
    const delay = firstConfig?.delay || 0;
    const verbose = firstConfig?.verbose !== false;
    const logFile = firstConfig?.logFile;
    const format = firstConfig?.format || 'json';
    const hook = firstConfig?.hook;

    // Create logger for this operation
    const logger = createLogger({ 
        verbose,
        showThroughput: true,
        logPrefix: '🌍'
    });

    logger.start('Processing multiple endpoints', {
        endpoints: configs.length,
        concurrency,
        delay: delay ? `${delay}ms` : 'none'
    });

    const queue = new RunQueue({ maxConcurrency: concurrency });
    const results = [];
    let reqCount = 0;
    let errorCount = 0;
    const totalCount = configs.length;

    for (const config of configs) {
        queue.add(0, async () => {
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            try {
                reqCount++;
                const result = await processSingleConfig(config, false);
                
                if (Array.isArray(result)) {
                    results.push(...result);
                } else {
                    results.push(result);
                }

                logger.progress(reqCount, totalCount);
            } catch (error) {
                errorCount++;
                logger.error(`Config ${reqCount} failed:`, error.message);
                results.push({ error: error.message, config: sanitizeConfig(config) });
                
                logger.progress(reqCount, totalCount);
            }
        });
    }

    await queue.run();

    const endTime = Date.now();
    const duration = endTime - startTime;
    const finalResults = typeof hook === 'function' ? hook(results) : results;

    // Write log file if specified
    if (logFile) {
        logger.fileOperation('Writing', logFile, format);
        await writeLogFile(logFile, finalResults, format, verbose);
    }

    const finalStats = {
        responses: finalResults,
        duration,
        clockTime: prettyTime(duration),
        configCount: totalCount,
        rps: Math.floor(reqCount / (duration / 1000)),
        errors: errorCount
    };

    logger.complete(finalStats);

    return finalStats;
}

/**
 * Process a single configuration with streaming and batching
 * 
 * @description
 * Main processing function for a single endpoint configuration. Handles
 * data streaming, batching, HTTP requests, and result aggregation.
 * Supports both batch and single request modes.
 * 
 * @param {BatchRequestConfig} config - Configuration object defining the operation
 * @param {boolean} [isMainJob=true] - Whether this is the primary operation (affects logging)
 * @description When false, reduces logging output for multi-config operations
 * 
 * @returns {Promise<Result>} Promise resolving to result object with metrics
 * @description Contains responses, timing, throughput, and error statistics
 * 
 * @throws {ValidationError} When configuration is invalid
 * @throws {ConfigurationError} When configuration values are invalid
 * @throws {NetworkError} When network issues occur
 * @throws {TimeoutError} When requests exceed timeout
 * @throws {RetryError} When all retry attempts fail
 * @throws {MemoryError} When memory limits are exceeded
 * 
 * @example
 * // Standard batch processing
 * const result = await processSingleConfig({
 *   url: 'https://api.example.com/bulk',
 *   data: largeDataset,
 *   batchSize: 100,
 *   concurrency: 5
 * });
 * console.log(`Processed ${result.rowCount} records in ${result.clockTime}`);
 * 
 * @example
 * // Single request mode
 * const result = await processSingleConfig({
 *   url: 'https://api.example.com/single',
 *   data: { id: 123, name: 'test' },
 *   noBatch: true,
 *   method: 'PUT'
 * });
 * 
 * @since 2.0.0
 */
async function processSingleConfig(config, isMainJob = true) {
    const startTime = Date.now();
    
    // Set defaults and validate
    const processedConfig = setDefaults(config);
    validateConfig(processedConfig);

    // Create logger for this operation
    const logger = createLogger({ 
        verbose: processedConfig.verbose,
        showThroughput: true,
        showMemory: processedConfig.verbose && isMainJob
    });

    // Handle shell commands for dynamic headers
    if (processedConfig.shell) {
        processedConfig.headers = await executeShellCommand(processedConfig.shell, processedConfig.headers);
    }

    if (isMainJob) {
        logger.start('Starting HTTP request job', sanitizeConfig(processedConfig));
    }

    // Handle no-batch mode (single request)
    if (processedConfig.noBatch) {
        const result = await executeSingleRequest(processedConfig, logger);
        
        if (isMainJob) {
            logger.complete(result);
        }
        
        return result;
    }

    // Process with streaming and batching
    const stream = await createDataStream(processedConfig);
    const [responses, reqCount, rowCount, errorCount] = await processDataStream(stream, processedConfig, logger);

    const endTime = Date.now();
    const duration = endTime - startTime;
    const rps = Math.floor(reqCount / (duration / 1000));

    const result = {
        responses,
        duration,
        clockTime: prettyTime(duration),
        reqCount,
        rowCount,
        rps,
        errors: errorCount || 0,
        stats: getMemoryStats()
    };

    // Write log file if specified
    if (processedConfig.logFile && isMainJob) {
        logger.fileOperation('Writing', processedConfig.logFile, processedConfig.format);
        await writeLogFile(
            processedConfig.logFile, 
            responses, 
            processedConfig.format, 
            processedConfig.verbose
        );
    }

    if (isMainJob) {
        logger.complete(result);
    }

    return result;
}

/**
 * Set default values for configuration object
 * 
 * @description
 * Applies sensible defaults to configuration options while preserving
 * user-specified values. Ensures all required properties exist with
 * appropriate default values for production use.
 * 
 * @param {BatchRequestConfig} config - Input configuration object
 * @description User-provided configuration that may have partial settings
 * 
 * @returns {BatchRequestConfig} Complete configuration with defaults applied
 * @description All optional properties will have default values set
 * 
 * @example
 * const config = setDefaults({ url: 'https://api.example.com' });
 * // Returns config with batchSize: 1, concurrency: 10, retries: 3, etc.
 * 
 * @example
 * const config = setDefaults({
 *   url: 'https://api.example.com',
 *   concurrency: 20,  // User override
 *   verbose: true     // User override
 * });
 * // Returns config with user values preserved and other defaults applied
 * 
 * @since 2.0.0
 */
function setDefaults(config) {
    return {
        batchSize: 1,
        concurrency: 10,
        maxTasks: 25,
        delay: 0,
        verbose: false,
        retries: 3,
        retryDelay: 1000,
        retryOn: [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
        timeout: 60000,
        keepAlive: true,
        method: 'POST',
        debug: false,
        highWaterMark: 16384,
        storeResponses: true,
        responseHeaders: false,
        forceGC: false,
        clone: false,
        noBatch: false,
        format: 'json',
        enableCookies: false,
        maxResponseBuffer: 1000,
        useStaticRetryDelay: false,
        enableConnectionPooling: true,
        headers: {},
        searchParams: null,
        bodyParams: null,
        ...config
    };
}

/**
 * Validate configuration object for correctness and consistency
 * 
 * @description
 * Performs comprehensive validation of configuration values to ensure
 * they are within acceptable ranges and logically consistent. Prevents
 * runtime errors by catching invalid configurations early.
 * 
 * @param {BatchRequestConfig} config - Configuration object to validate
 * @description Must be a complete configuration object (after defaults applied)
 * 
 * @throws {ConfigurationError} When configuration values are invalid
 * @throws {ValidationError} When required fields are missing
 * 
 * @example
 * validateConfig({
 *   url: 'https://api.example.com',
 *   method: 'POST',
 *   data: [{ test: true }],
 *   batchSize: 10,
 *   concurrency: 5
 * }); // Valid - no error thrown
 * 
 * @example
 * validateConfig({
 *   url: 'https://api.example.com',
 *   method: 'POST',
 *   // No data provided
 *   batchSize: -1,  // Invalid
 *   concurrency: 0  // Invalid
 * }); // Throws ConfigurationError
 * 
 * @since 2.0.0
 */
function validateConfig(config) {
    if (!config.url) {
        throw new ConfigurationError('URL is required');
    }

    if (!config.data && ['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase())) {
        throw new ConfigurationError(`${config.method} request requires data`);
    }

    if (config.batchSize < 0) {
        throw new ConfigurationError('batchSize must be non-negative');
    }

    if (config.concurrency < 1) {
        throw new ConfigurationError('concurrency must be at least 1');
    }

    if (config.timeout < 1000) {
        throw new ConfigurationError('timeout must be at least 1000ms');
    }
}

/**
 * Execute shell command for dynamic header generation
 * 
 * @description
 * Executes a shell command to generate dynamic header values, typically
 * for authentication tokens that need to be refreshed. Commonly used
 * with AWS CLI, gcloud, or other authentication tools.
 * 
 * @param {Object} shellConfig - Shell command configuration
 * @param {string} shellConfig.command - Shell command to execute
 * @param {string} [shellConfig.header='Authorization'] - Header name to set
 * @param {string} [shellConfig.prefix='Bearer'] - Prefix for the header value
 * 
 * @param {Object} [headers={}] - Existing headers to merge with
 * @description New header will be added to existing headers
 * 
 * @returns {Promise<Object>} Promise resolving to updated headers object
 * @description Contains all original headers plus the new dynamic header
 * 
 * @throws {ConfigurationError} When shell command fails or returns invalid output
 * 
 * @example
 * // AWS token generation
 * const headers = await executeShellCommand({
 *   command: 'aws sts get-session-token --query "Credentials.SessionToken" --output text',
 *   header: 'Authorization',
 *   prefix: 'AWS4-HMAC-SHA256'
 * }, { 'Content-Type': 'application/json' });
 * // Returns: { 'Content-Type': 'application/json', 'Authorization': 'AWS4-HMAC-SHA256 token...' }
 * 
 * @example
 * // Google Cloud token
 * const headers = await executeShellCommand({
 *   command: 'gcloud auth print-access-token',
 *   header: 'Authorization',
 *   prefix: 'Bearer'
 * });
 * 
 * @since 2.0.0
 */
async function executeShellCommand(shellConfig, headers = {}) {
    try {
        const commandOutput = execSync(shellConfig.command, { encoding: 'utf8' }).trim();
        const headerName = shellConfig.header || 'Authorization';
        const prefix = shellConfig.prefix || 'Bearer';
        
        return {
            ...headers,
            [headerName]: `${prefix} ${commandOutput}`
        };
    } catch (error) {
        throw new ConfigurationError(`Shell command failed: ${error.message}`);
    }
}

/**
 * Execute a single HTTP request without batching
 * 
 * @description
 * Performs a single HTTP request without any batching logic. Used when
 * noBatch is true or for simple single-item operations. Creates and
 * destroys HTTP client for the single request.
 * 
 * @param {BatchRequestConfig} config - Configuration object for the request
 * @description Must include url, method, and any data to send
 * 
 * @param {Object} logger - Logger instance for output
 * @description Used for verbose logging and error reporting
 * 
 * @returns {Promise<Result>} Promise resolving to result object
 * @description Contains single response, timing, and memory statistics
 * 
 * @throws {NetworkError} When network issues occur
 * @throws {TimeoutError} When request exceeds timeout
 * @throws {RetryError} When all retry attempts fail
 * 
 * @example
 * const result = await executeSingleRequest({
 *   url: 'https://api.example.com/item/123',
 *   method: 'PUT',
 *   data: { name: 'Updated Item' },
 *   noBatch: true
 * }, logger);
 * console.log(result.responses[0]); // Single response object
 * 
 * @since 2.0.0
 */
async function executeSingleRequest(config, logger) {
    const httpClient = createHttpClient(config);
    
    try {
        if (logger && logger.isVerbose()) {
            logger.info('Executing single request (no batching)');
        }
        
        const response = await httpClient.request(config);
        
        return {
            responses: [response],
            duration: 0,
            clockTime: '0 seconds',
            reqCount: 1,
            rowCount: Array.isArray(config.data) ? config.data.length : 1,
            rps: 0,
            errors: 0,
            stats: getMemoryStats()
        };
    } finally {
        httpClient.destroy();
    }
}

/**
 * Create data stream from various input types
 * 
 * @description
 * Converts different data input types (arrays, files, strings, streams)
 * into a standardized readable stream for processing. Handles JSON, JSONL,
 * file paths, and existing streams with appropriate transformations.
 * 
 * @param {BatchRequestConfig} config - Configuration containing data source
 * @param {Object[]|string|import('stream').Readable} config.data - Data source to convert
 * @param {number} config.highWaterMark - Stream buffer size
 * @param {string} config.method - HTTP method (affects GET/HEAD/OPTIONS handling)
 * 
 * @returns {Promise<import('stream').Readable>} Promise resolving to readable stream
 * @description Stream will emit data objects ready for batching and HTTP requests
 * 
 * @throws {ValidationError} When data format is invalid or unsupported
 * 
 * @example
 * // From array
 * const stream = await createDataStream({
 *   data: [{ id: 1 }, { id: 2 }],
 *   highWaterMark: 16384
 * });
 * 
 * @example
 * // From file path
 * const stream = await createDataStream({
 *   data: './data.jsonl',
 *   method: 'POST'
 * });
 * 
 * @example
 * // From existing stream
 * const stream = await createDataStream({
 *   data: fs.createReadStream('./large-file.jsonl'),
 *   highWaterMark: 32768
 * });
 * 
 * @since 2.0.0
 */
async function createDataStream(config) {
    const { data, highWaterMark } = config;
    const streamProcessors = new StreamProcessors({ highWaterMark });

    if (data instanceof Readable) {
        return data.readableObjectMode ? data : data.pipe(streamProcessors.createJSONLTransform());
    }

    if (typeof data === 'string') {
        if (existsSync(path.resolve(data))) {
            // File path
            return createReadStream(path.resolve(data), { highWaterMark })
                .pipe(streamProcessors.createJSONLTransform());
        } else if (isJSONStr(data)) {
            // JSON string
            return Readable.from(JSON.parse(data));
        } else if (data.split('\n').every(line => line.trim() === '' || isJSONStr(line))) {
            // JSONL string
            return Readable.from(data.split('\n').filter(line => line.trim()).map(JSON.parse));
        } else {
            throw new ValidationError('Invalid data format');
        }
    }

    if (Array.isArray(data)) {
        return Readable.from(data);
    }

    if (typeof data === 'object' && data !== null) {
        return Readable.from([data]);
    }

    // For GET/HEAD/OPTIONS requests without data
    if (['GET', 'HEAD', 'OPTIONS'].includes(config.method.toUpperCase())) {
        return Readable.from([null]);
    }

    throw new ValidationError('No valid data source provided');
}

/**
 * Process data stream with batching and HTTP requests
 * 
 * @description
 * Main stream processing engine that handles batching, concurrency control,
 * HTTP requests, retry logic, and response collection. Manages memory usage
 * and provides backpressure control for large datasets.
 * 
 * @param {import('stream').Readable} stream - Data stream to process
 * @description Stream should emit objects ready for HTTP requests
 * 
 * @param {BatchRequestConfig} config - Configuration for processing
 * @param {number} config.batchSize - Items per HTTP request
 * @param {number} config.concurrency - Maximum concurrent requests
 * @param {number} config.maxTasks - Queue size before pausing stream
 * @param {number} config.delay - Delay between requests in ms
 * @param {number} config.maxResponseBuffer - Maximum responses to keep
 * @param {number} [config.maxMemoryUsage] - Memory limit in bytes
 * @param {boolean} config.storeResponses - Whether to store responses
 * 
 * @param {Object} logger - Logger instance for progress tracking
 * @description Used for progress updates and error reporting
 * 
 * @returns {Promise<Array>} Promise resolving to processing results
 * @description Returns [responses, reqCount, rowCount, errorCount] tuple
 * 
 * @throws {MemoryError} When memory usage exceeds configured limits
 * @throws {NetworkError} When network issues occur during processing
 * @throws {TimeoutError} When requests exceed timeout limits
 * 
 * @example
 * const [responses, reqCount, rowCount, errors] = await processDataStream(
 *   dataStream,
 *   {
 *     batchSize: 100,
 *     concurrency: 10,
 *     maxTasks: 25,
 *     delay: 0,
 *     maxResponseBuffer: 1000,
 *     storeResponses: true
 *   },
 *   logger
 * );
 * console.log(`Processed ${rowCount} records in ${reqCount} requests with ${errors} errors`);
 * 
 * @since 2.0.0
 */
async function processDataStream(stream, config, logger) {
    const {
        batchSize,
        concurrency,
        maxTasks,
        delay,
        maxResponseBuffer,
        maxMemoryUsage,
        storeResponses
    } = config;

    const queue = new RunQueue({ maxConcurrency: concurrency });
    const responseBuffer = storeResponses ? new CircularBuffer(maxResponseBuffer) : null;
    const streamProcessors = new StreamProcessors({ maxMemoryUsage });
    const httpClient = createHttpClient(config);

    let reqCount = 0;
    let rowCount = 0;
    let errorCount = 0;
    let batch = [];
    let isStreamPaused = false;

    // Add memory monitoring if specified
    if (maxMemoryUsage) {
        stream = stream.pipe(streamProcessors.createMemoryMonitorTransform());
    }

    stream.on('error', error => {
        logger.error('Stream error:', error.message);
        cleanup();
    });

    stream.on('end', () => {
        if (logger.isVerbose()) {
            logger.info(`Stream ended: processed ${comma(rowCount)} records, ${comma(reqCount)} requests`);
        }
        cleanup();
    });

    // Process stream data
    for await (const data of stream) {
        if (data !== null) {  // Skip null data for GET requests
            batch.push(data);
            rowCount++;
        }

        // Process batch when it reaches batchSize
        if (batch.length >= batchSize || (data === null && batch.length > 0)) {
            addBatchToQueue(batch);
            batch = [];
        }

        // Pause stream if queue is full
        if (queue.queued >= maxTasks && !isStreamPaused) {
            if (logger.isVerbose()) {
                logger.info(`Pausing stream: queue size ${queue.queued}/${maxTasks}`);
            }
            stream.pause();
            isStreamPaused = true;
            
            await queue.run();
            queue = new RunQueue({ maxConcurrency: concurrency });
            
            if (logger.isVerbose()) {
                logger.info(`Resuming stream: ${comma(reqCount)} requests completed`);
            }
            stream.resume();
            isStreamPaused = false;
        }
    }

    // Process any remaining batch
    if (batch.length > 0) {
        addBatchToQueue(batch);
    }

    // Wait for all requests to complete
    await queue.run();
    
    // Cleanup
    cleanup();
    httpClient.destroy();

    const responses = responseBuffer ? responseBuffer.toArray() : [];
    
    // Force garbage collection if enabled
    if (config.forceGC && global.gc) {
        global.gc();
    }

    return [responses, reqCount, rowCount, errorCount];

    function addBatchToQueue(currentBatch) {
        const batchData = currentBatch.slice(); // Create copy
        
        queue.add(0, async () => {
            try {
                const requestConfig = {
                    ...config,
                    data: currentBatch.length === 1 ? currentBatch[0] : currentBatch
                };

                const response = await httpClient.request(requestConfig);
                
                if (responseBuffer) {
                    responseBuffer.push(response);
                }

                reqCount++;

                if (delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Update progress
                logger.progress(reqCount, Math.ceil(rowCount / batchSize), rowCount);

                // Handle response callback
                if (config.responseHandler && typeof config.responseHandler === 'function') {
                    config.responseHandler(response);
                }

            } catch (error) {
                errorCount++;
                logger.error('Batch processing failed:', error.message);
                
                if (config.errorHandler && typeof config.errorHandler === 'function') {
                    config.errorHandler(error);
                } else {
                    // Store error in response buffer if enabled
                    if (responseBuffer) {
                        responseBuffer.push({ error: error.message, batch: batchData });
                    }
                }
            }
        });
    }

    function cleanup() {
        if (stream && typeof stream.destroy === 'function') {
            stream.removeAllListeners();
            stream.destroy();
        }
    }
}

/**
 * Create HTTP client with configuration
 * 
 * @description
 * Factory function that creates and configures an HTTP client with
 * connection pooling, retry strategies, cookie handling, and form data
 * support based on the provided configuration.
 * 
 * @param {BatchRequestConfig} config - Configuration for HTTP client
 * @param {number} config.timeout - Request timeout in ms
 * @param {boolean} config.enableConnectionPooling - Enable connection pooling
 * @param {boolean} config.keepAlive - Keep connections alive
 * @param {number} config.concurrency - Concurrency level (affects socket pools)
 * @param {number} config.retries - Maximum retry attempts
 * @param {number} config.retryDelay - Base retry delay in ms
 * @param {number[]} config.retryOn - HTTP status codes to retry
 * @param {Function} [config.retryHandler] - Custom retry logic
 * @param {boolean} config.useStaticRetryDelay - Use fixed delays vs exponential backoff
 * @param {boolean} config.enableCookies - Enable cookie jar
 * @param {number} [config.maxFileSize] - Maximum file size for uploads
 * 
 * @returns {HttpClient} Configured HTTP client instance
 * @description Client with connection pooling, retry logic, and session management
 * 
 * @example
 * const client = createHttpClient({
 *   timeout: 30000,
 *   enableConnectionPooling: true,
 *   concurrency: 10,
 *   retries: 3,
 *   retryDelay: 1000,
 *   enableCookies: true
 * });
 * 
 * @since 2.0.0
 */
function createHttpClient(config) {
    const clientOptions = {
        timeout: config.timeout,
        keepAlive: config.enableConnectionPooling ? config.keepAlive : false,
        maxSockets: config.concurrency * 2,
        maxFreeSockets: config.concurrency,
        retry: {
            maxRetries: config.retries,
            baseDelay: config.retryDelay,
            retryOn: config.retryOn,
            retryHandler: config.retryHandler,
            useStaticDelay: config.useStaticRetryDelay,
            staticRetryDelay: config.retryDelay
        },
        cookies: {
            enabled: config.enableCookies
        },
        formData: {
            maxFileSize: config.maxFileSize
        }
    };

    return new HttpClient(clientOptions);
}


/**
 * Write results to log file in specified format
 * 
 * @description
 * Writes operation results to a file in the specified format (JSON, CSV, NDJSON).
 * Creates parent directories if needed and handles streaming for large datasets.
 * 
 * @param {string} filePath - Destination file path
 * @description File will be created if it doesn't exist, overwritten if it does
 * 
 * @param {any} data - Data to write to file
 * @description Can be array of responses, single response, or any serializable data
 * 
 * @param {string} format - Output format
 * @description Supported: 'json', 'csv', 'ndjson'
 * 
 * @param {boolean} verbose - Enable verbose logging
 * @description Controls whether success/error messages are displayed
 * 
 * @throws {Error} When file write operations fail
 * 
 * @example
 * await writeLogFile('./results.json', responses, 'json', true);
 * // Writes responses array as JSON with success logging
 * 
 * @example
 * await writeLogFile('./output.csv', responses, 'csv', false);
 * // Writes responses as CSV without logging
 * 
 * @example
 * await writeLogFile('./stream.ndjson', largeDataset, 'ndjson', true);
 * // Writes as newline-delimited JSON for streaming
 * 
 * @since 2.0.0
 */
async function writeLogFile(filePath, data, format, verbose) {
    try {
        await makeExist(filePath);
        const streamProcessors = new StreamProcessors();
        const dataStream = Readable.from(Array.isArray(data) ? data : [data]);
        
        await streamProcessors.streamToFile(dataStream, filePath, format);
        
        if (verbose) {
            const logger = createLogger({ verbose });
            logger.success(`Log written to ${filePath}`);
        }
    } catch (error) {
        const logger = createLogger({ verbose: true });
        logger.error(`Failed to write log file: ${error.message}`);
    }
}

/**
 * Sanitize configuration for logging (remove sensitive data)
 * 
 * @description
 * Creates a copy of configuration object with sensitive information removed
 * or masked. Prevents secrets from appearing in logs while preserving
 * useful debugging information.
 * 
 * @param {Object} config - Configuration object to sanitize
 * @description Original object is not modified
 * 
 * @returns {Object} Sanitized configuration object
 * @description Copy with sensitive headers masked and data removed
 * 
 * @example
 * const clean = sanitizeConfig({
 *   url: 'https://api.example.com',
 *   headers: {
 *     'Authorization': 'Bearer secret123',
 *     'Content-Type': 'application/json',
 *     'X-API-Key': 'apikey456'
 *   },
 *   data: [{ sensitive: 'info' }]
 * });
 * // Returns:
 * // {
 * //   url: 'https://api.example.com',
 * //   headers: {
 * //     'Authorization': '[REDACTED]',
 * //     'Content-Type': 'application/json',
 * //     'X-API-Key': '[REDACTED]'
 * //   }
 * //   // data property removed
 * // }
 * 
 * @since 2.0.0
 */
function sanitizeConfig(config) {
    const sanitized = { ...config };
    delete sanitized.data;
    
    // Mask sensitive headers
    if (sanitized.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
        sanitized.headers = { ...sanitized.headers };
        
        Object.keys(sanitized.headers).forEach(key => {
            if (sensitiveHeaders.includes(key.toLowerCase())) {
                sanitized.headers[key] = '[REDACTED]';
            }
        });
    }
    
    return sanitized;
}

/**
 * Get current memory usage statistics
 * 
 * @description
 * Retrieves current Node.js process memory usage and formats it
 * into readable megabyte values for monitoring and reporting.
 * 
 * @returns {Object} Memory statistics object
 * @property {number} heapUsed - Used heap memory in MB
 * @property {number} heapTotal - Total heap memory in MB  
 * @property {number} external - External memory in MB
 * @property {number} rss - Resident set size in MB
 * 
 * @example
 * const stats = getMemoryStats();
 * console.log(`Heap: ${stats.heapUsed}/${stats.heapTotal}MB, RSS: ${stats.rss}MB`);
 * // Output: "Heap: 25.5/50.2MB, RSS: 75.8MB"
 * 
 * @since 2.0.0
 */
function getMemoryStats() {
    const memUsage = process.memoryUsage();
    return {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
        rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100 // MB
    };
}

/**
 * Convert milliseconds to human-readable time string
 * 
 * @description
 * Converts millisecond durations into friendly time strings with
 * appropriate units (years, days, hours, minutes, seconds). Automatically
 * selects the most relevant time units for readability.
 * 
 * @param {number} milliseconds - Duration in milliseconds
 * @description Must be a positive number
 * 
 * @returns {string} Human-readable time string
 * @description Formatted duration like "5.4s", "2m 15s", "1h 30m"
 * 
 * @example
 * prettyTime(1500);     // "1.50 seconds"
 * prettyTime(65000);    // "1 minute 5 seconds" 
 * prettyTime(3661000);  // "1 hour 1 minute"
 * prettyTime(90061000); // "1 day 1 hour"
 * 
 * @example
 * const duration = Date.now() - startTime;
 * console.log(`Operation completed in ${prettyTime(duration)}`);
 * 
 * @since 2.0.0
 */
function prettyTime(milliseconds) {
    const totalSeconds = milliseconds / 1000;
    
    const levels = [
        [Math.floor(totalSeconds / 31536000), 'years'],
        [Math.floor((totalSeconds % 31536000) / 86400), 'days'],
        [Math.floor(((totalSeconds % 31536000) % 86400) / 3600), 'hours'],
        [Math.floor((((totalSeconds % 31536000) % 86400) % 3600) / 60), 'minutes']
    ];
    
    const seconds = (totalSeconds % 60).toFixed(2);
    levels.push([seconds, 'seconds']);
    
    let result = '';
    for (let i = 0; i < levels.length; i++) {
        if (levels[i][0] == 0 || (i === levels.length - 1 && levels[i][0] == "0.00")) continue;
        const unit = levels[i][0] === 1 ? levels[i][1].slice(0, -1) : levels[i][1];
        result += ` ${levels[i][0]} ${unit}`;
    }
    
    return result.trim() || '0 seconds';
}

// CLI execution
if (require.main === module) {
    cli()
        .then(params => {
            return main(params).then(results => ({ params, results }));
        })
        .then(({ params, results }) => {
            if (params.verbose) {
                const logger = createLogger({ verbose: true });
                logger.log('\n📋 Final Results Summary:');
                logger.log(json(results));
            }
        })
        .catch(error => {
            const logger = createLogger({ verbose: true });
            logger.error('Operation failed:', error.message);
            
            if (error.stack && process.env.NODE_ENV === 'development') {
                console.error('\nStack trace:');
                console.error(error.stack);
            }
            
            process.exit(1);
        })
        .finally(() => {
            process.exit(0);
        });
}

module.exports = main;