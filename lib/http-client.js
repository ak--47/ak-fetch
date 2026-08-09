/**
 * HTTP client with connection pooling and advanced features
 */

import { Agent as UndiciAgent } from 'undici';
import { URL } from 'url';
import querystring from 'node:querystring';
import { 
    NetworkError, 
    TimeoutError, 
    RateLimitError, 
    SSLError,
    AkFetchError 
} from './errors.js';
import RetryStrategy from './retry-strategy.js';
import AkCookieJar from './cookie-jar.js';
import FormDataHandler from './form-data-handler.js';

/**
 * Case-insensitive header lookup (finding B4)
 * @param {Object} headers - Headers object
 * @param {string} name - Header name to find
 * @returns {any} Header value or undefined
 */
function getHeader(headers, name) {
    const target = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === target) return headers[key];
    }
    return undefined;
}

/**
 * Case-insensitive header deletion (finding B4)
 * @param {Object} headers - Headers object
 * @param {string} name - Header name to delete
 */
function deleteHeader(headers, name) {
    const target = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === target) delete headers[key];
    }
}

class HttpClient {
    constructor(options = {}) {
        this.options = {
            timeout: options.timeout || 60000,
            keepAlive: options.keepAlive !== false,
            maxSockets: options.maxSockets || 256,
            maxFreeSockets: options.maxFreeSockets || 256,
            freeSocketTimeout: options.freeSocketTimeout || 30000,
            rejectUnauthorized: options.rejectUnauthorized !== false,
            ...options
        };

        // Create undici dispatcher with real connection pooling
        this.dispatcher = new UndiciAgent({
            connections: this.options.maxSockets,
            pipelining: this.options.keepAlive ? 1 : 0,   // 0 disables keep-alive → per-request connections
            keepAliveTimeout: this.options.freeSocketTimeout,
            headersTimeout: this.options.timeout,
            bodyTimeout: this.options.timeout,            // finding B6: body reads honor the deadline
            connect: { rejectUnauthorized: this.options.rejectUnauthorized }
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

        const effectiveTimeout = timeout ?? this.options.timeout;

        let requestUrl = new URL(url);
        
        // Add search parameters
        if (searchParams) {
            Object.entries(searchParams).forEach(([key, value]) => {
                requestUrl.searchParams.set(key, value);
            });
        }

        // Prepare headers
        let requestHeaders = { ...headers };

        // Add default headers (finding B4: case-insensitive check)
        if (!getHeader(requestHeaders, 'user-agent')) {
            requestHeaders['User-Agent'] = 'ak-fetch/2';
        }

        // Add cookies to headers
        requestHeaders = await this.cookieJar.addCookiesToHeaders(requestHeaders, requestUrl.toString());

        // Prepare request body
        let requestBody = null;
        let processedData = data;

        if (data && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
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

            // Handle different content types (finding B4: case-insensitive routing)
            const contentType = getHeader(requestHeaders, 'content-type');
            if (contentType === 'application/x-www-form-urlencoded') {
                // Using imported querystring module
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
            } else if (contentType && contentType.startsWith('multipart/form-data')) {
                // Native FormData: let fetch set the boundary header itself
                deleteHeader(requestHeaders, 'content-type');
                requestBody = await this.formDataHandler.createFormData(processedData);
            } else {
                // Default to JSON
                if (!contentType) {
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

        // Create fetch options
        const fetchOptions = {
            method,
            headers: requestHeaders,
            body: requestBody,
            dispatcher: this.dispatcher,   // finding B1: the option native fetch actually honors
            redirect: 'follow'
        };

        // Remove body for GET, HEAD, and OPTIONS requests
        if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            delete fetchOptions.body;
        }

        try {
            const response = await this.fetchWithTimeout(requestUrl, fetchOptions, effectiveTimeout);

            // Process cookies from response (finding B2: use getSetCookie for multi-cookie support)
            if (this.cookieJar.isEnabled()) {
                const setCookies = typeof response.headers.getSetCookie === 'function'
                    ? response.headers.getSetCookie()                 // Node ≥18.14
                    : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
                if (setCookies.length > 0) {
                    await this.cookieJar.setCookies(setCookies, requestUrl.toString());
                }
            }

            // Handle rate limiting
            if (response.status === 429) {
                const errorBody = await this.getResponseBody(response).catch(() => null);
                const rateLimitError = this.retryStrategy.createRateLimitError(
                    Object.fromEntries(response.headers.entries()),
                    response.status
                );
                rateLimitError.body = errorBody;
                rateLimitError.url = requestUrl.toString();
                rateLimitError.method = method;
                throw rateLimitError;
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
                throw new TimeoutError(`Request timeout after ${effectiveTimeout}ms`, {
                    timeout: effectiveTimeout,
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
     * @param {string | FormData} body - Request body. Multipart bodies arrive here
     *   as native FormData, which curl cannot express via `-d` (it needs one `-F`
     *   per field) and which cannot be iterated without consuming it — so it
     *   renders as a placeholder instead of stringifying to "[object FormData]".
     * @returns {string} Curl command
     */
    generateCurlCommand(url, method, headers, body) {
        let curlCommand = `curl -X ${method} "${url}"`;
        
        Object.entries(headers).forEach(([key, value]) => {
            curlCommand += ` \\\n  -H "${key}: ${value}"`;
        });

        if (body) {
            const bodyStr = typeof body === 'string' ? body : '[FormData - use multipart/form-data]';
            curlCommand += ` \\\n  -d '${bodyStr}'`;
        }

        return curlCommand;
    }

    /**
     * Get HTTP client statistics.
     *
     * NOTE: undici 6's `Agent` exposes no `.stats` property, so `sockets` and
     * `freeSockets` are always 0. The keys are kept for shape compatibility
     * with pre-2.1.0 consumers — do not read them as real socket counts.
     *
     * @returns {Object} Statistics
     */
    getStats() {
        // @ts-expect-error - undici 6's Agent has no `stats` property (see the JSDoc
        // above): the nullish coalescing is the whole point, it yields the documented
        // shape-compatible zeros. undici 7 does not add it either, and would drop
        // Node 18 support, so this stays until the keys can be removed in a major.
        const s = this.dispatcher.stats ?? {};
        const agentStats = {
            maxSockets: this.options.maxSockets,
            maxFreeSockets: this.options.maxFreeSockets,
            sockets: s.connected ?? 0,
            freeSockets: s.free ?? 0
        };
        return {
            httpsAgent: agentStats,
            httpAgent: agentStats,
            retryStrategy: this.retryStrategy.getStats(),
            cookieJar: this.cookieJar.getStats()
        };
    }

    /**
     * Close HTTP client and clean up resources
     */
    destroy() {
        this.dispatcher.destroy();
    }
}

export default HttpClient;