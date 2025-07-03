/**
 * Cookie jar implementation for session management
 */

import { CookieJar } from 'tough-cookie';

class AkCookieJar {
    constructor(options = {}) {
        this.jar = new CookieJar(options.store, options);
        this.enabled = options.enabled !== false;
        this.rejectPublicSuffixes = options.rejectPublicSuffixes !== false;
        this.allowSpecialUseDomain = options.allowSpecialUseDomain || false;
    }

    /**
     * Set a cookie from a Set-Cookie header
     * @param {string} cookieString - Cookie string from Set-Cookie header
     * @param {string} url - URL where the cookie was set
     * @returns {Promise<Cookie|null>} The cookie that was set
     */
    async setCookie(cookieString, url) {
        if (!this.enabled) return null;
        
        try {
            return await this.jar.setCookie(cookieString, url);
        } catch (error) {
            console.warn(`Failed to set cookie: ${error.message}`);
            return null;
        }
    }

    /**
     * Set multiple cookies from Set-Cookie headers
     * @param {string[]} cookieStrings - Array of cookie strings
     * @param {string} url - URL where the cookies were set
     * @returns {Promise<Cookie[]>} Array of cookies that were set
     */
    async setCookies(cookieStrings, url) {
        if (!this.enabled || !Array.isArray(cookieStrings)) return [];
        
        const cookies = [];
        for (const cookieString of cookieStrings) {
            const cookie = await this.setCookie(cookieString, url);
            if (cookie) cookies.push(cookie);
        }
        return cookies;
    }

    /**
     * Get cookies for a URL as a Cookie header value
     * @param {string} url - URL to get cookies for
     * @returns {Promise<string>} Cookie header value
     */
    async getCookieString(url) {
        if (!this.enabled) return '';
        
        try {
            return await this.jar.getCookieString(url);
        } catch (error) {
            console.warn(`Failed to get cookies: ${error.message}`);
            return '';
        }
    }

    /**
     * Get cookies for a URL as Cookie objects
     * @param {string} url - URL to get cookies for
     * @returns {Promise<Cookie[]>} Array of cookies
     */
    async getCookies(url) {
        if (!this.enabled) return [];
        
        try {
            return await this.jar.getCookies(url);
        } catch (error) {
            console.warn(`Failed to get cookies: ${error.message}`);
            return [];
        }
    }

    /**
     * Remove cookies that match the criteria
     * @param {string} domain - Domain to remove cookies from
     * @param {string} path - Path to remove cookies from
     * @param {string} name - Name of cookie to remove
     * @returns {Promise<number>} Number of cookies removed
     */
    async removeCookies(domain, path, name) {
        if (!this.enabled) return 0;
        
        try {
            const cookies = await this.jar.getCookies(`http://${domain}${path || '/'}`);
            let removed = 0;
            
            for (const cookie of cookies) {
                if (!name || cookie.key === name) {
                    await this.jar.store.removeCookie(cookie.domain, cookie.path, cookie.key);
                    removed++;
                }
            }
            
            return removed;
        } catch (error) {
            console.warn(`Failed to remove cookies: ${error.message}`);
            return 0;
        }
    }

    /**
     * Clear all cookies
     * @returns {Promise<void>}
     */
    async clear() {
        if (!this.enabled) return;
        
        try {
            // Use removeAllCookies if available
            const store = this.jar.store;
            if (store.removeAllCookies) {
                return await new Promise((resolve, reject) => {
                    store.removeAllCookies((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            } else {
                // Fallback: get all cookies and remove them
                const domains = await this.getAllDomains();
                for (const domain of domains) {
                    await this.removeCookies(domain, '/', null);
                }
            }
        } catch (error) {
            console.warn(`Failed to clear cookies: ${error.message}`);
        }
    }

    /**
     * Get all domains that have cookies
     * @returns {Promise<string[]>} Array of domains
     */
    async getAllDomains() {
        if (!this.enabled) return [];
        
        try {
            const domains = new Set();
            const allCookies = await this.getAllCookies();
            
            for (const cookie of allCookies) {
                domains.add(cookie.domain);
            }
            
            return Array.from(domains);
        } catch (error) {
            console.warn(`Failed to get domains: ${error.message}`);
            return [];
        }
    }

    /**
     * Get all cookies from the jar
     * @returns {Promise<Cookie[]>} Array of all cookies
     */
    async getAllCookies() {
        if (!this.enabled) return [];
        
        try {
            // This is a workaround since tough-cookie doesn't have a direct getAllCookies method
            const cookies = [];
            const store = this.jar.store;
            
            if (store.getAllCookies) {
                return await new Promise((resolve, reject) => {
                    store.getAllCookies((err, allCookies) => {
                        if (err) reject(err);
                        else resolve(allCookies || []);
                    });
                });
            }
            
            return cookies;
        } catch (error) {
            console.warn(`Failed to get all cookies: ${error.message}`);
            return [];
        }
    }

    /**
     * Export cookies to JSON
     * @returns {Promise<Object>} Serialized cookies
     */
    async serialize() {
        if (!this.enabled) return {};
        
        try {
            return await new Promise((resolve, reject) => {
                this.jar.serialize((err, serialized) => {
                    if (err) reject(err);
                    else resolve(serialized);
                });
            });
        } catch (error) {
            console.warn(`Failed to serialize cookies: ${error.message}`);
            return {};
        }
    }

    /**
     * Import cookies from JSON
     * @param {Object} serialized - Serialized cookies
     * @returns {Promise<void>}
     */
    async deserialize(serialized) {
        if (!this.enabled || !serialized) return;
        
        try {
            this.jar = await CookieJar.deserialize(serialized);
        } catch (error) {
            console.warn(`Failed to deserialize cookies: ${error.message}`);
        }
    }

    /**
     * Process response headers to extract and store cookies
     * @param {Object} headers - Response headers
     * @param {string} url - URL of the response
     * @returns {Promise<Cookie[]>} Cookies that were set
     */
    async processResponseHeaders(headers, url) {
        if (!this.enabled || !headers) return [];
        
        const setCookieHeaders = [];
        
        // Handle different header formats
        if (headers['set-cookie']) {
            if (Array.isArray(headers['set-cookie'])) {
                setCookieHeaders.push(...headers['set-cookie']);
            } else {
                setCookieHeaders.push(headers['set-cookie']);
            }
        }
        
        if (setCookieHeaders.length === 0) return [];
        
        return await this.setCookies(setCookieHeaders, url);
    }

    /**
     * Add cookies to request headers
     * @param {Object} headers - Request headers object
     * @param {string} url - URL of the request
     * @returns {Promise<Object>} Modified headers
     */
    async addCookiesToHeaders(headers, url) {
        if (!this.enabled) return headers;
        
        const cookieString = await this.getCookieString(url);
        
        if (cookieString) {
            headers = { ...headers };
            headers['Cookie'] = cookieString;
        }
        
        return headers;
    }

    /**
     * Get cookie statistics
     * @returns {Promise<Object>} Cookie statistics
     */
    async getStats() {
        if (!this.enabled) return { enabled: false, count: 0, domains: 0 };
        
        const allCookies = await this.getAllCookies();
        const domains = await this.getAllDomains();
        
        return {
            enabled: true,
            count: allCookies.length,
            domains: domains.length,
            domainList: domains
        };
    }

    /**
     * Enable or disable the cookie jar
     * @param {boolean} enabled - Whether to enable cookies
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Check if cookies are enabled
     * @returns {boolean} True if enabled
     */
    isEnabled() {
        return this.enabled;
    }
}

export default AkCookieJar;