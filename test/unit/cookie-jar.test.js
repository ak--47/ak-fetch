/**
 * Unit tests for AkCookieJar
 */

const AkCookieJar = require('../../lib/cookie-jar');

describe('AkCookieJar', () => {
    let cookieJar;
    const testUrl = 'https://example.com';

    beforeEach(() => {
        cookieJar = new AkCookieJar({ enabled: true });
    });

    describe('constructor', () => {
        test('should create enabled cookie jar by default', () => {
            const jar = new AkCookieJar();
            expect(jar.isEnabled()).toBe(true);
        });

        test('should create disabled cookie jar when specified', () => {
            const jar = new AkCookieJar({ enabled: false });
            expect(jar.isEnabled()).toBe(false);
        });
    });

    describe('setCookie', () => {
        test('should set a simple cookie', async () => {
            const cookie = await cookieJar.setCookie('test=value', testUrl);
            
            expect(cookie).toBeTruthy();
            expect(cookie.key).toBe('test');
            expect(cookie.value).toBe('value');
        });

        test('should set cookie with attributes', async () => {
            const cookieString = 'session=abc123; Path=/; HttpOnly; Secure';
            const cookie = await cookieJar.setCookie(cookieString, testUrl);
            
            expect(cookie).toBeTruthy();
            expect(cookie.key).toBe('session');
            expect(cookie.value).toBe('abc123');
            expect(cookie.path).toBe('/');
            expect(cookie.httpOnly).toBe(true);
            expect(cookie.secure).toBe(true);
        });

        test('should return null when disabled', async () => {
            cookieJar.setEnabled(false);
            const cookie = await cookieJar.setCookie('test=value', testUrl);
            
            expect(cookie).toBeNull();
        });

        test('should handle invalid cookie strings gracefully', async () => {
            const cookie = await cookieJar.setCookie('invalid-cookie', testUrl);
            expect(cookie).toBeNull();
        });
    });

    describe('setCookies', () => {
        test('should set multiple cookies', async () => {
            const cookieStrings = [
                'cookie1=value1',
                'cookie2=value2; Path=/',
                'cookie3=value3; HttpOnly'
            ];
            
            const cookies = await cookieJar.setCookies(cookieStrings, testUrl);
            
            expect(cookies).toHaveLength(3);
            expect(cookies[0].key).toBe('cookie1');
            expect(cookies[1].key).toBe('cookie2');
            expect(cookies[2].key).toBe('cookie3');
        });

        test('should handle empty array', async () => {
            const cookies = await cookieJar.setCookies([], testUrl);
            expect(cookies).toHaveLength(0);
        });

        test('should skip invalid cookies', async () => {
            const cookieStrings = [
                'valid=cookie',
                'invalid-cookie',
                'another=valid'
            ];
            
            const cookies = await cookieJar.setCookies(cookieStrings, testUrl);
            
            // Should only set valid cookies
            expect(cookies.length).toBeLessThanOrEqual(2);
            expect(cookies.some(c => c.key === 'valid')).toBe(true);
        });
    });

    describe('getCookieString', () => {
        test('should return cookie string for URL', async () => {
            await cookieJar.setCookie('test=value', testUrl);
            await cookieJar.setCookie('another=cookie', testUrl);
            
            const cookieString = await cookieJar.getCookieString(testUrl);
            
            expect(cookieString).toContain('test=value');
            expect(cookieString).toContain('another=cookie');
        });

        test('should return empty string when no cookies', async () => {
            const cookieString = await cookieJar.getCookieString(testUrl);
            expect(cookieString).toBe('');
        });

        test('should return empty string when disabled', async () => {
            await cookieJar.setCookie('test=value', testUrl);
            cookieJar.setEnabled(false);
            
            const cookieString = await cookieJar.getCookieString(testUrl);
            expect(cookieString).toBe('');
        });

        test('should respect domain restrictions', async () => {
            await cookieJar.setCookie('test=value', 'https://example.com');
            
            const cookieString1 = await cookieJar.getCookieString('https://example.com');
            const cookieString2 = await cookieJar.getCookieString('https://other.com');
            
            expect(cookieString1).toContain('test=value');
            expect(cookieString2).toBe('');
        });
    });

    describe('getCookies', () => {
        test('should return cookie objects for URL', async () => {
            await cookieJar.setCookie('test=value', testUrl);
            
            const cookies = await cookieJar.getCookies(testUrl);
            
            expect(cookies).toHaveLength(1);
            expect(cookies[0].key).toBe('test');
            expect(cookies[0].value).toBe('value');
        });

        test('should return empty array when no cookies', async () => {
            const cookies = await cookieJar.getCookies(testUrl);
            expect(cookies).toHaveLength(0);
        });
    });

    describe('removeCookies', () => {
        beforeEach(async () => {
            await cookieJar.setCookie('cookie1=value1', testUrl);
            await cookieJar.setCookie('cookie2=value2', testUrl);
            await cookieJar.setCookie('cookie3=value3', testUrl);
        });

        test('should remove specific cookie by name', async () => {
            const removed = await cookieJar.removeCookies('example.com', '/', 'cookie1');
            
            expect(removed).toBeGreaterThan(0);
            
            const remaining = await cookieJar.getCookies(testUrl);
            expect(remaining.some(c => c.key === 'cookie1')).toBe(false);
            expect(remaining.some(c => c.key === 'cookie2')).toBe(true);
        });

        test('should remove all cookies when no name specified', async () => {
            const removed = await cookieJar.removeCookies('example.com', '/');
            
            expect(removed).toBeGreaterThan(0);
            
            const remaining = await cookieJar.getCookies(testUrl);
            expect(remaining).toHaveLength(0);
        });

        test('should return 0 when disabled', async () => {
            cookieJar.setEnabled(false);
            const removed = await cookieJar.removeCookies('example.com', '/', 'cookie1');
            expect(removed).toBe(0);
        });
    });

    describe('clear', () => {
        test('should clear all cookies', async () => {
            await cookieJar.setCookie('cookie1=value1', testUrl);
            await cookieJar.setCookie('cookie2=value2', 'https://other.com');
            
            await cookieJar.clear();
            
            const cookies1 = await cookieJar.getCookies(testUrl);
            const cookies2 = await cookieJar.getCookies('https://other.com');
            
            expect(cookies1).toHaveLength(0);
            expect(cookies2).toHaveLength(0);
        });

        test('should handle empty cookie jar', async () => {
            await expect(cookieJar.clear()).resolves.not.toThrow();
        });
    });

    describe('processResponseHeaders', () => {
        test('should process Set-Cookie header (string)', async () => {
            const headers = {
                'set-cookie': 'session=abc123; Path=/'
            };
            
            const cookies = await cookieJar.processResponseHeaders(headers, testUrl);
            
            expect(cookies).toHaveLength(1);
            expect(cookies[0].key).toBe('session');
        });

        test('should process Set-Cookie header (array)', async () => {
            const headers = {
                'set-cookie': [
                    'cookie1=value1',
                    'cookie2=value2; HttpOnly'
                ]
            };
            
            const cookies = await cookieJar.processResponseHeaders(headers, testUrl);
            
            expect(cookies).toHaveLength(2);
            expect(cookies[0].key).toBe('cookie1');
            expect(cookies[1].key).toBe('cookie2');
        });

        test('should return empty array when no Set-Cookie header', async () => {
            const headers = { 'content-type': 'application/json' };
            
            const cookies = await cookieJar.processResponseHeaders(headers, testUrl);
            
            expect(cookies).toHaveLength(0);
        });

        test('should handle null headers', async () => {
            const cookies = await cookieJar.processResponseHeaders(null, testUrl);
            expect(cookies).toHaveLength(0);
        });
    });

    describe('addCookiesToHeaders', () => {
        test('should add cookies to request headers', async () => {
            await cookieJar.setCookie('test=value', testUrl);
            
            const headers = { 'content-type': 'application/json' };
            const updatedHeaders = await cookieJar.addCookiesToHeaders(headers, testUrl);
            
            expect(updatedHeaders.Cookie).toContain('test=value');
            expect(updatedHeaders['content-type']).toBe('application/json');
        });

        test('should not modify headers when no cookies', async () => {
            const headers = { 'content-type': 'application/json' };
            const updatedHeaders = await cookieJar.addCookiesToHeaders(headers, testUrl);
            
            expect(updatedHeaders).toEqual(headers);
            expect(updatedHeaders.Cookie).toBeUndefined();
        });

        test('should not modify original headers object', async () => {
            await cookieJar.setCookie('test=value', testUrl);
            
            const originalHeaders = { 'content-type': 'application/json' };
            const updatedHeaders = await cookieJar.addCookiesToHeaders(originalHeaders, testUrl);
            
            expect(originalHeaders.Cookie).toBeUndefined();
            expect(updatedHeaders.Cookie).toBeDefined();
        });
    });

    describe('serialize/deserialize', () => {
        test('should serialize and deserialize cookies', async () => {
            await cookieJar.setCookie('test=value', testUrl);
            await cookieJar.setCookie('session=abc123', testUrl);
            
            const serialized = await cookieJar.serialize();
            expect(serialized).toBeTruthy();
            
            const newJar = new AkCookieJar();
            await newJar.deserialize(serialized);
            
            const cookies = await newJar.getCookies(testUrl);
            expect(cookies.length).toBeGreaterThan(0);
        });

        test('should handle empty cookie jar serialization', async () => {
            const serialized = await cookieJar.serialize();
            expect(serialized).toBeDefined();
        });

        test('should handle invalid serialized data', async () => {
            await expect(cookieJar.deserialize('invalid')).resolves.not.toThrow();
        });
    });

    describe('getStats', () => {
        test('should return cookie statistics', async () => {
            await cookieJar.setCookie('cookie1=value1', testUrl);
            await cookieJar.setCookie('cookie2=value2', 'https://other.com');
            
            const stats = await cookieJar.getStats();
            
            expect(stats.enabled).toBe(true);
            expect(stats.count).toBeGreaterThanOrEqual(2);
            expect(stats.domains).toBeGreaterThanOrEqual(1);
            expect(Array.isArray(stats.domainList)).toBe(true);
        });

        test('should return disabled stats when disabled', async () => {
            cookieJar.setEnabled(false);
            const stats = await cookieJar.getStats();
            
            expect(stats.enabled).toBe(false);
            expect(stats.count).toBe(0);
            expect(stats.domains).toBe(0);
        });
    });

    describe('enabled/disabled behavior', () => {
        test('should toggle enabled state', () => {
            expect(cookieJar.isEnabled()).toBe(true);
            
            cookieJar.setEnabled(false);
            expect(cookieJar.isEnabled()).toBe(false);
            
            cookieJar.setEnabled(true);
            expect(cookieJar.isEnabled()).toBe(true);
        });

        test('should disable all operations when disabled', async () => {
            cookieJar.setEnabled(false);
            
            const setCookieResult = await cookieJar.setCookie('test=value', testUrl);
            const getCookieResult = await cookieJar.getCookieString(testUrl);
            const getCookiesResult = await cookieJar.getCookies(testUrl);
            
            expect(setCookieResult).toBeNull();
            expect(getCookieResult).toBe('');
            expect(getCookiesResult).toHaveLength(0);
        });
    });
});