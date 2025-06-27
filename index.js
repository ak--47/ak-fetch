#! /usr/bin/env node
// @ts-check

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
const { getPresetTransform, applyPresetTransform } = require('./lib/presets');
const { 
    AkFetchError, 
    NetworkError, 
    TimeoutError, 
    ValidationError,
    ConfigurationError,
    MemoryError 
} = require('./lib/errors');


/** @typedef {import("./types").BatchRequestConfig} BatchRequestConfig */
/** @typedef {import("./types").Result} Result */


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
 * @param {BatchRequestConfig[]} configs - Array of configurations to process ITS RIGHT HERE!!!!!
 * @returns {Promise<Result>} 
 */
async function processMultipleConfigs(configs) {
    const startTime = Date.now();
	/** @type {BatchRequestConfig} */
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
        // @ts-ignore
        count: configs.length,
        concurrency,
        delay: delay ? `${delay}ms` : 'none'
    });

    const queue = new RunQueue({ maxConcurrency: concurrency });
	/** @type {Result[]} */
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
                // @ts-ignore
                logger.error(`Config ${reqCount} failed:`, error.message);
                // @ts-ignore
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
        reqCount,
        rowCount: reqCount,
        rps: Math.floor(reqCount / (duration / 1000)),
        errors: errorCount,
        configCount: totalCount
    };

    logger.complete(finalStats);

    // Return comprehensive stats for multiple configurations
    return {
        responses: finalResults,
        duration,
        clockTime: prettyTime(duration),
        reqCount,
        rowCount: totalCount,
        rps: Math.floor(reqCount / (duration / 1000)),
        errors: errorCount,
        configCount: totalCount
    };
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

    // Handle shell commands for dynamic headers (execute even in dry run for testing)
    if (processedConfig.shell) {
        // @ts-ignore
        processedConfig.headers = await executeShellCommand(processedConfig.shell, processedConfig.headers);
    }

    if (isMainJob) {
        logger.start('Starting HTTP request job', sanitizeConfig(processedConfig));
    }

    // Handle dry run mode
    if (processedConfig.dryRun) {
        if (processedConfig.dryRun === 'curl') {
            return await handleCurlGeneration(processedConfig, logger, isMainJob);
        } else {
            return await handleDryRun(processedConfig, logger, isMainJob);
        }
    }

    // Handle no-batch mode (single request)
    if (processedConfig.noBatch) {
        const result = await executeSingleRequest(processedConfig, logger);
        
        if (isMainJob) {
            // @ts-ignore
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
		if (!processedConfig.format) processedConfig.format = /** @type {"json"} */ ('json');
		if (processedConfig.verbose === undefined) processedConfig.verbose = false;
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
    const defaults = {
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
        format: /** @type {"json"|"csv"|"ndjson"} */ ('json'),
        enableCookies: false,
        maxResponseBuffer: 1000,
        useStaticRetryDelay: false,
        enableConnectionPooling: true,
        dryRun: false,
        headers: {},
        searchParams: null,
        bodyParams: null,
        transform: null,
        shell: null,
        ...config
    };

    // Fire-and-forget mode: automatically disable response storage when retries is null
    // (unless explicitly overridden by user)
    if (defaults.retries === null && !config.hasOwnProperty('storeResponses')) {
        defaults.storeResponses = false;
    }

    return defaults;
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

    // Use optional chaining and default values for type safety
    const method = config.method || 'POST';
    const batchSize = config.batchSize ?? 1;
    const concurrency = config.concurrency ?? 10;
    const timeout = config.timeout ?? 60000;

    if (!config.data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        throw new ConfigurationError(`${method} request requires data`);
    }

    if (batchSize < 0) {
        throw new ConfigurationError('batchSize must be non-negative');
    }

    if (concurrency < 1) {
        throw new ConfigurationError('concurrency must be at least 1');
    }

    if (timeout < 1000) {
        throw new ConfigurationError('timeout must be at least 1000ms');
    }

    if (config.transform !== null && config.transform !== undefined && typeof config.transform !== 'function') {
        throw new ConfigurationError('transform must be a function or null');
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
        // @ts-ignore
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
 * @param {any} logger - Logger instance for output
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
    // Create a type-safe configuration with proper defaults
    const httpClientConfig = {
        timeout: config.timeout ?? 60000,
        enableConnectionPooling: config.enableConnectionPooling ?? true,
        keepAlive: config.keepAlive ?? true,
        concurrency: config.concurrency ?? 10,
        retries: config.retries ?? 3,
        retryDelay: config.retryDelay ?? 1000,
        retryOn: config.retryOn ?? [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
        retryHandler: config.retryHandler || undefined,
        useStaticRetryDelay: config.useStaticRetryDelay ?? false,
        enableCookies: config.enableCookies ?? false,
        maxFileSize: config.maxFileSize ?? undefined,
        // Include required properties for BatchRequestConfig compatibility
        url: config.url,
        data: config.data,
        method: config.method ?? 'POST',
        headers: config.headers ?? {}
    };

    const httpClient = createHttpClient(httpClientConfig);
    
    try {
        if (logger && logger.isVerbose()) {
            logger.info('Executing single request (no batching)');
        }
        
        const response = await httpClient.request(config);
        
        const endTime = Date.now();
        const startTime = endTime; // Single request, minimal duration
        const duration = endTime - startTime;
        
        const result = {
            responses: [response],
            duration,
            clockTime: prettyTime(duration),
            reqCount: 1,
            rowCount: Array.isArray(config.data) ? config.data.length : 1,
            rps: 0,
            errors: 0,
            stats: getMemoryStats()
        };
        return result;
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
            // File path - check extension to determine if it's JSON or JSONL
            const filePath = path.resolve(data);
            const fileExt = path.extname(filePath).toLowerCase();
            
            if (fileExt === '.json') {
                // Regular JSON file - read and parse as array
                const fileContent = require('fs').readFileSync(filePath, 'utf8');
                const jsonData = JSON.parse(fileContent);
                return Readable.from(Array.isArray(jsonData) ? jsonData : [jsonData]);
            } else {
                // JSONL file or other text file
                return createReadStream(filePath, { highWaterMark })
                    .pipe(streamProcessors.createJSONLTransform());
            }
        } else if (isJSONStr(data)) {
            // JSON string
            const parsed = JSON.parse(data);
            return Readable.from(Array.isArray(parsed) ? parsed : [parsed]);
        } else if (data.split('\n').every(line => line.trim() === '' || isJSONStr(line))) {
            // JSONL string
            return Readable.from(data.split('\n').filter(line => line.trim()).map(line => JSON.parse(line)));
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
    const method = config.method || 'POST';
    if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
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
 * 
 * 
 * @param {any} logger - Logger instance for progress tracking
 * @description Used for progress updates and error reporting
 * 
 * @returns {Promise<Array<any>>} Promise resolving to processing results
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
        batchSize = 1,
        concurrency = 10,
        maxTasks = 25,
        delay = 0,
        maxResponseBuffer = 1000,
        maxMemoryUsage,
        storeResponses = true,
        forceGC = false
    } = config;

    let queue = new RunQueue({ maxConcurrency: concurrency });
    const responseBuffer = storeResponses ? new CircularBuffer(maxResponseBuffer) : null;
    const streamProcessors = new StreamProcessors({ maxMemoryUsage });
    
    // Create type-safe http client config with defaults
    const httpClientConfig = {
        timeout: config.timeout ?? 60000,
        enableConnectionPooling: config.enableConnectionPooling ?? true,
        keepAlive: config.keepAlive ?? true,
        concurrency: config.concurrency ?? 10,
        retries: config.retries ?? 3,
        retryDelay: config.retryDelay ?? 1000,
        retryOn: config.retryOn ?? [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
        retryHandler: config.retryHandler || undefined,
        useStaticRetryDelay: config.useStaticRetryDelay ?? false,
        enableCookies: config.enableCookies ?? false,
        maxFileSize: config.maxFileSize ?? undefined,
        // Required properties for BatchRequestConfig compatibility
        url: config.url,
        data: config.data,
        method: config.method ?? 'POST',
        headers: config.headers ?? {}
    };
    
    const httpClient = createHttpClient(httpClientConfig);

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
            let processedData = data;
            
            // Clone data if requested to avoid mutations (do this before any transforms)
            if (config.clone) {
                processedData = typeof data === 'object' && data !== null ? 
                    JSON.parse(JSON.stringify(data)) : data;
            }
            
            // Apply preset transform first (if specified)
            if (config.preset) {
                try {
                    processedData = applyPresetTransform(processedData, config.preset, config.errorHandler);
                } catch (error) {
                    // @ts-ignore
                    logger.error(`Preset transform error (${config.preset}): ${error.message}`);
                    if (config.errorHandler && typeof config.errorHandler === 'function') {
                        config.errorHandler(error, processedData);
                    } else {
                        throw error; // Preset transform errors should fail the operation
                    }
                }
            }
            
            // Apply user transform function (if provided) - runs AFTER preset transform
            if (typeof config.transform === 'function') {
                try {
                    const transformed = config.transform(processedData);
                    if (transformed !== undefined) {
                        processedData = transformed;
                        
                        // When not cloning, also update the original data object (but only for objects, not arrays)
                        if (!config.clone && typeof data === 'object' && data !== null && !Array.isArray(data) && typeof transformed === 'object' && !Array.isArray(transformed)) {
                            Object.assign(data, transformed);
                        }
                    }
                } catch (error) {
                    // @ts-ignore
                    logger.error(`Transform error: ${error.message}`);
                    if (config.errorHandler && typeof config.errorHandler === 'function') {
                        config.errorHandler(error, processedData);
                    } else {
                        throw error; // Transform errors should fail the operation
                    }
                }
            }
            
            batch.push(processedData);
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
    if (forceGC && global.gc) {
        global.gc();
    }

    return [responses, reqCount, rowCount, errorCount];
    /**
     * @param  {Array<any>} currentBatch
     */
    function addBatchToQueue(currentBatch) {
        const batchData = currentBatch.slice(); // Create copy
        
        queue.add(0, async () => {
            try {
                const requestConfig = {
                    ...config,
                    data: batchData.length === 1 ? batchData[0] : batchData
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
                logger.progress(reqCount, Math.ceil(rowCount / (batchSize || 1)), rowCount);

                // Handle response callback
                if (config.responseHandler && typeof config.responseHandler === 'function') {
                    config.responseHandler(response);
                }

            } catch (error) {
                errorCount++;
                // @ts-ignore
                logger.error('Batch processing failed:', error.message);
                
                if (config.errorHandler && typeof config.errorHandler === 'function') {
                    config.errorHandler(error);
                } else {
                    // Store error in response buffer if enabled
                    if (responseBuffer) {
                        // @ts-ignore
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
    const concurrency = config.concurrency ?? 10;
    const clientOptions = {
        timeout: config.timeout,
        keepAlive: config.enableConnectionPooling ? config.keepAlive : false,
        maxSockets: concurrency * 2,
        maxFreeSockets: concurrency,
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
        // @ts-ignore
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
 * @param {BatchRequestConfig} config - Configuration object to sanitize
 * @description Original object is not modified
 * 
 * @returns {BatchRequestConfig} Sanitized configuration object
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
                // @ts-ignore
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
 * Handle curl generation mode - generate curl commands instead of making requests
 * 
 * @description
 * Processes configuration to generate curl commands that would be equivalent
 * to the HTTP requests that would be made. Useful for debugging, sharing,
 * and understanding what requests would be sent.
 * 
 * @param {BatchRequestConfig} config - Configuration object for curl generation
 * @param {any} logger - Logger instance for output
 * @param {boolean} isMainJob - Whether this is the primary operation
 * @returns {Promise<Result>} Promise resolving to result with curl commands
 * 
 * @example
 * const result = await handleCurlGeneration(config, logger, true);
 * console.log(result.responses[0]); // "curl -X POST https://api.example.com/data ..."
 * 
 * @since 2.0.0
 */
async function handleCurlGeneration(config, logger, isMainJob) {
    const startTime = Date.now();
    
    if (logger.isVerbose()) {
        logger.info('Generating curl commands - no actual requests will be made');
    }

    // Create data stream to process items
    const stream = await createDataStream(config);
    let rowCount = 0;
    const curlCommands = [];

    // Process data items and generate curl commands
    for await (const data of stream) {
        if (data !== null) {
            rowCount++;
            
            let processedData = data;
            
            // Apply transform for curl generation if provided
            if (typeof config.transform === 'function') {
                try {
                    if (config.clone) {
                        processedData = typeof data === 'object' && data !== null ? 
                            JSON.parse(JSON.stringify(data)) : data;
                    }
                    
                    const transformed = config.transform(processedData);
                    if (transformed !== undefined) {
                        processedData = transformed;
                    }
                } catch (error) {
                    logger.error(`Transform error in curl generation: ${error.message}`);
                    throw error;
                }
            }
            
            // Generate curl command for this data item
            const curlCommand = generateCurlCommand(config, processedData);
            curlCommands.push(curlCommand);
        }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = {
        responses: curlCommands,
        duration,
        clockTime: prettyTime(duration),
        reqCount: 0, // No actual requests made
        rowCount,
        rps: 0,
        errors: 0,
        stats: getMemoryStats()
    };

    if (isMainJob) {
        logger.complete(result);
    }

    return result;
}

/**
 * Generate a curl command for a given configuration and data
 * 
 * @description
 * Creates a curl command string that represents the HTTP request
 * that would be made with the given configuration and data.
 * 
 * @param {BatchRequestConfig} config - Request configuration
 * @param {any} data - Data payload for the request
 * @returns {string} Curl command string
 * 
 * @since 2.0.0
 */
function generateCurlCommand(config, data) {
    const parts = ['curl'];
    
    // Add method
    if (config.method && config.method !== 'GET') {
        parts.push(`-X ${config.method}`);
    }
    
    // Add headers
    if (config.headers) {
        Object.entries(config.headers).forEach(([key, value]) => {
            parts.push(`-H "${key}: ${value}"`);
        });
    }
    
    // Add data payload for POST/PUT/PATCH methods
    if (['POST', 'PUT', 'PATCH'].includes(config.method?.toUpperCase()) && data) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        parts.push(`-d '${payload}'`);
        
        // Add content-type if not already specified
        const hasContentType = config.headers && 
            Object.keys(config.headers).some(key => key.toLowerCase() === 'content-type');
        if (!hasContentType) {
            parts.push(`-H "Content-Type: application/json"`);
        }
    }
    
    // Add URL with search params
    let url = config.url;
    if (config.searchParams) {
        const params = new URLSearchParams(config.searchParams);
        url += `?${params.toString()}`;
    }
    parts.push(`"${url}"`);
    
    return parts.join(' ');
}

/**
 * Handle dry run mode - simulate operations without making actual requests
 * 
 * @description
 * Processes configuration in dry run mode, counting data items and simulating
 * request processing without making actual HTTP calls. Useful for testing
 * configuration validity and estimating request counts.
 * 
 * @param {BatchRequestConfig} config - Configuration object for dry run
 * @param {any} logger - Logger instance for output
 * @param {boolean} isMainJob - Whether this is the primary operation
 * @returns {Promise<Result>} Promise resolving to simulated result
 * 
 * @example
 * const result = await handleDryRun(config, logger, true);
 * console.log(`Would make ${result.reqCount} requests for ${result.rowCount} items`);
 * 
 * @since 2.0.0
 */
async function handleDryRun(config, logger, isMainJob) {
    const startTime = Date.now();
    
    if (logger.isVerbose()) {
        logger.info('Running in dry run mode - no actual requests will be made');
    }

    // Create data stream to count items
    const stream = await createDataStream(config);
    let rowCount = 0;
    const responses = [];

    // Count data items and simulate batching
    for await (const data of stream) {
        if (data !== null) {
            rowCount++;
            let processedData = data;
            
            // Clone data if requested to avoid mutations (do this before any transforms)
            if (config.clone) {
                processedData = typeof data === 'object' && data !== null ? 
                    JSON.parse(JSON.stringify(data)) : data;
            }
            
            // Apply preset transform first (if specified)
            if (config.preset) {
                try {
                    processedData = applyPresetTransform(processedData, config.preset, config.errorHandler);
                } catch (error) {
                    logger.error(`Preset transform error in dry run (${config.preset}): ${error.message}`);
                    if (config.errorHandler && typeof config.errorHandler === 'function') {
                        config.errorHandler(error, processedData);
                    } else {
                        throw error; // Preset transform errors should fail the operation
                    }
                }
            }
            
            // Apply user transform for testing if provided (runs AFTER preset transform)
            if (typeof config.transform === 'function') {
                try {
                    const transformed = config.transform(processedData);
                    if (transformed !== undefined) {
                        processedData = transformed;
                        
                        // When not cloning, also update the original data object (but only for objects, not arrays)
                        if (!config.clone && typeof data === 'object' && data !== null && !Array.isArray(data) && typeof transformed === 'object' && !Array.isArray(transformed)) {
                            Object.assign(data, transformed);
                        }
                    }
                } catch (error) {
                    logger.error(`Transform error in dry run: ${error.message}`);
                    if (config.errorHandler && typeof config.errorHandler === 'function') {
                        config.errorHandler(error, processedData);
                    } else {
                        throw error; // Transform errors should fail the operation
                    }
                }
            }
            
            // Store transformed data in responses for inspection (only if transforms are used)
            if (config.preset || config.transform) {
                responses.push(processedData);
                
                // Print transformed data to console if showData or showSample is enabled
                if ((config.showData || config.showSample) && logger.isVerbose()) {
                    const maxRecords = config.showSample ? 3 : 100;
                    if (responses.length <= maxRecords) {
                        logger.info(`Transformed record ${responses.length}:`, JSON.stringify(processedData, null, 2));
                    } else if (responses.length === maxRecords + 1) {
                        logger.info(`... (showing only first ${maxRecords} transformed records)`);
                    }
                }
            }
        }
    }

    const reqCount = config.batchSize > 0 ? Math.ceil(rowCount / config.batchSize) : Math.max(1, rowCount);
    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = {
        responses,
        duration,
        clockTime: prettyTime(duration),
        reqCount: 0, // No actual requests made
        rowCount,
        rps: 0,
        errors: 0,
        stats: getMemoryStats()
    };

    if (isMainJob) {
        logger.complete(result);
    }

    return result;
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
    
    const seconds = parseFloat((totalSeconds % 60).toFixed(2));
    levels.push([seconds, 'seconds']);
    
    let result = '';
    for (let i = 0; i < levels.length; i++) {
        if (levels[i][0] == 0 || (i === levels.length - 1 && levels[i][0] == 0)) continue;
        const unit = levels[i][0] === 1 ? String(levels[i][1]).slice(0, -1) : levels[i][1];
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