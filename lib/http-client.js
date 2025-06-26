/**
 * HTTP client with connection pooling and advanced features
 */

const { Agent } = require('https');
const { Agent: HttpAgent } = require('http');
const { URL } = require('url');
const { 
    NetworkError, 
    TimeoutError, 
    RateLimitError, 
    SSLError,
    AkFetchError 
} = require('./errors');
const RetryStrategy = require('./retry-strategy');
const AkCookieJar = require('./cookie-jar');
const FormDataHandler = require('./form-data-handler');

class HttpClient {
    constructor(options = {}) {
        this.options = {
            timeout: options.timeout || 60000,
            keepAlive: options.keepAlive !== false,
            maxSockets: options.maxSockets || 256,
            maxFreeSockets: options.maxFreeSockets || 256,
            freeSocketTimeout: options.freeSocketTimeout || 30000,
            ...options
        };

        // Create HTTP agents with connection pooling
        this.httpsAgent = new Agent({
            keepAlive: this.options.keepAlive,
            maxSockets: this.options.maxSockets,
            maxFreeSockets: this.options.maxFreeSockets,
            timeout: this.options.freeSocketTimeout,
            rejectUnauthorized: this.options.rejectUnauthorized !== false
        });

        this.httpAgent = new HttpAgent({
            keepAlive: this.options.keepAlive,
            maxSockets: this.options.maxSockets,
            maxFreeSockets: this.options.maxFreeSockets,
            timeout: this.options.freeSocketTimeout
        });

        // Initialize components
        this.retryStrategy = new RetryStrategy(options.retry || {});
        this.cookieJar = new AkCookieJar(options.cookies || {});
        this.formDataHandler = new FormDataHandler(options.formData || {});

        // Supported HTTP methods
        this.supportedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    }

    /**
     * Make an HTTP request with all features
     * @param {Object} config - Request configuration
     * @returns {Promise<Object>} Response object
     */
    async request(config) {
        const {
            url,
            method = 'GET',
            data,
            headers = {},
            searchParams,
            bodyParams,
            timeout = this.options.timeout,
            responseHeaders = false,
            transform,
            clone = false,
            dryRun = false,
            verbose = false
        } = config;

        // Validate method
        if (!this.supportedMethods.includes(method.toUpperCase())) {
            throw new AkFetchError(`Unsupported HTTP method: ${method}`, {
                method,
                url,
                code: 'UNSUPPORTED_METHOD'
            });
        }

        // Create request context for retry strategy
        const context = {
            url,
            method: method.toUpperCase(),
            verbose,
            config
        };

        // Execute with retry strategy
        return await this.retryStrategy.execute(async (ctx, attempt) => {
            return await this.executeRequest({
                ...config,
                method: method.toUpperCase(),
                attempt
            });
        }, context);
    }

    /**
     * Execute a single HTTP request
     * @param {Object} config - Request configuration
     * @returns {Promise<Object>} Response object
     */
    async executeRequest(config) {
        const {
            url,
            method,
            data,
            headers = {},
            searchParams,
            bodyParams,
            timeout,
            responseHeaders = false,
            transform,
            clone = false,
            dryRun = false,
            verbose = false,
            attempt = 0
        } = config;

        let requestUrl = new URL(url);
        
        // Add search parameters
        if (searchParams) {
            Object.entries(searchParams).forEach(([key, value]) => {
                requestUrl.searchParams.set(key, value);
            });
        }

        // Prepare headers
        let requestHeaders = { ...headers };
        
        // Add default headers
        if (!requestHeaders['User-Agent']) {
            requestHeaders['User-Agent'] = 'ak-fetch/1.0';
        }

        // Add cookies to headers
        requestHeaders = await this.cookieJar.addCookiesToHeaders(requestHeaders, requestUrl.toString());

        // Prepare request body
        let requestBody = null;
        let processedData = data;

        if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
            if (clone) {
                processedData = JSON.parse(JSON.stringify(data));
            }

            if (transform && typeof transform === 'function') {
                if (Array.isArray(processedData)) {
                    processedData = processedData.map(transform);
                } else {
                    processedData = transform(processedData);
                }
            }

            // Handle different content types
            if (requestHeaders['Content-Type'] === 'application/x-www-form-urlencoded') {
                const querystring = require('querystring');
                let payload = processedData;
                
                if (bodyParams) {
                    if (bodyParams.dataKey) {
                        payload = { [bodyParams.dataKey]: JSON.stringify(processedData), ...bodyParams };
                        delete payload.dataKey;
                    } else {
                        payload = { ...bodyParams, ...processedData };
                    }
                }
                
                requestBody = querystring.stringify(payload);
            } else if (requestHeaders['Content-Type'] && requestHeaders['Content-Type'].startsWith('multipart/form-data')) {
                // Handle multipart form data
                const formData = this.formDataHandler.createFormData(processedData);
                const formRequestData = await this.formDataHandler.getFormRequestData(formData);
                
                requestHeaders = { ...requestHeaders, ...formRequestData.headers };
                requestBody = formRequestData.body;
            } else {
                // Default to JSON
                if (!requestHeaders['Content-Type']) {
                    requestHeaders['Content-Type'] = 'application/json';
                }
                
                if (bodyParams) {
                    const payload = { [bodyParams.dataKey || 'data']: processedData, ...bodyParams };
                    if (bodyParams.dataKey) delete payload.dataKey;
                    requestBody = JSON.stringify(payload);
                } else {
                    requestBody = JSON.stringify(processedData);
                }
            }
        }

        // Handle dry run
        if (dryRun) {
            if (dryRun === 'curl') {
                return this.generateCurlCommand(requestUrl, method, requestHeaders, requestBody);
            }
            return {
                url: requestUrl.toString(),
                method,
                headers: requestHeaders,
                body: requestBody
            };
        }

        // Select appropriate agent
        const agent = requestUrl.protocol === 'https:' ? this.httpsAgent : this.httpAgent;

        // Create fetch options
        const fetchOptions = {
            method,
            headers: requestHeaders,
            body: requestBody,
            agent,
            timeout,
            redirect: 'follow',
            compress: true
        };

        // Remove body for GET, HEAD, and OPTIONS requests
        if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            delete fetchOptions.body;
        }

        try {
            const response = await this.fetchWithTimeout(requestUrl, fetchOptions, timeout);
            
            // Process cookies from response
            await this.cookieJar.processResponseHeaders(
                Object.fromEntries(response.headers.entries()),
                requestUrl.toString()
            );

            // Handle rate limiting
            if (response.status === 429) {
                throw this.retryStrategy.createRateLimitError(
                    Object.fromEntries(response.headers.entries()),
                    response.status
                );
            }

            // Handle non-2xx responses
            if (!response.ok) {
                const errorBody = await this.getResponseBody(response);
                throw new AkFetchError(`HTTP ${response.status}: ${response.statusText}`, {
                    statusCode: response.status,
                    url: requestUrl.toString(),
                    method,
                    body: errorBody,
                    headers: Object.fromEntries(response.headers.entries())
                });
            }

            // Process response
            const responseBody = await this.getResponseBody(response);
            const result = {
                data: responseBody,
                status: response.status,
                statusText: response.statusText,
                url: requestUrl.toString(),
                method
            };

            if (responseHeaders) {
                result.headers = Object.fromEntries(response.headers.entries());
            }

            return result;

        } catch (error) {
            if (error instanceof AkFetchError) {
                throw error;
            }

            // Handle network errors
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                throw new NetworkError(`Network error: ${error.message}`, {
                    code: error.code,
                    url: requestUrl.toString(),
                    method
                });
            }

            // Handle timeout errors
            if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
                throw new TimeoutError(`Request timeout after ${timeout}ms`, {
                    timeout,
                    url: requestUrl.toString(),
                    method
                });
            }

            // Handle SSL errors
            if (error.code && error.code.startsWith('UNABLE_TO_VERIFY_LEAF_SIGNATURE')) {
                throw new SSLError(`SSL verification failed: ${error.message}`, {
                    code: error.code,
                    url: requestUrl.toString(),
                    method
                });
            }

            // Generic error
            throw new AkFetchError(`Request failed: ${error.message}`, {
                code: error.code,
                url: requestUrl.toString(),
                method,
                originalError: error
            });
        }
    }

    /**
     * Fetch with timeout support
     * @param {URL} url - Request URL
     * @param {Object} options - Fetch options
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Response>} Fetch response
     */
    async fetchWithTimeout(url, options, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Get response body with proper parsing
     * @param {Response} response - Fetch response
     * @returns {Promise<any>} Parsed response body
     */
    async getResponseBody(response) {
        const contentType = response.headers.get('content-type');
        
        if (!contentType) {
            return await response.text();
        }

        if (contentType.includes('application/json')) {
            try {
                return await response.json();
            } catch (error) {
                return await response.text();
            }
        }

        if (contentType.includes('text/')) {
            return await response.text();
        }

        // For binary content, return as buffer
        return await response.arrayBuffer();
    }

    /**
     * Generate curl command for dry run
     * @param {URL} url - Request URL
     * @param {string} method - HTTP method
     * @param {Object} headers - Request headers
     * @param {string} body - Request body
     * @returns {string} Curl command
     */
    generateCurlCommand(url, method, headers, body) {
        let curlCommand = `curl -X ${method} "${url}"`;
        
        Object.entries(headers).forEach(([key, value]) => {
            curlCommand += ` \\\n  -H "${key}: ${value}"`;
        });

        if (body) {
            curlCommand += ` \\\n  -d '${body}'`;
        }

        return curlCommand;
    }

    /**
     * Get HTTP client statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            httpsAgent: {
                maxSockets: this.httpsAgent.maxSockets,
                maxFreeSockets: this.httpsAgent.maxFreeSockets,
                sockets: Object.keys(this.httpsAgent.sockets).length,
                freeSockets: Object.keys(this.httpsAgent.freeSockets).length
            },
            httpAgent: {
                maxSockets: this.httpAgent.maxSockets,
                maxFreeSockets: this.httpAgent.maxFreeSockets,
                sockets: Object.keys(this.httpAgent.sockets).length,
                freeSockets: Object.keys(this.httpAgent.freeSockets).length
            },
            retryStrategy: this.retryStrategy.getStats(),
            cookieJar: this.cookieJar.getStats()
        };
    }

    /**
     * Close HTTP client and clean up resources
     */
    destroy() {
        this.httpsAgent.destroy();
        this.httpAgent.destroy();
    }
}

module.exports = HttpClient;