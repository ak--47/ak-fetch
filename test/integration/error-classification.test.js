// test/integration/error-classification.test.js
import { describe, test, expect, vi, afterEach } from 'vitest';
import http from 'http';
import HttpClient from '../../lib/http-client.js';
import RetryStrategy from '../../lib/retry-strategy.js';
import { NetworkError, TimeoutError, RetryError, AkFetchError } from '../../lib/errors.js';
import { makeServer } from '../helpers/local-server.js';

/**
 * Finding M-2.
 *
 * `fetch()` never rejects with the underlying socket error. It rejects with a
 * bare `TypeError` — "fetch failed" or "terminated" — and hides the real failure
 * on `.cause`. The catch block in executeRequest only looked at `error.code` on
 * that wrapper, so it was always `undefined`: ECONNREFUSED/ENOTFOUND never became
 * `NetworkError`, undici's body/headers deadlines never became `TimeoutError`, and
 * because `isNetworkError()` had the same blind spot none of them were retried
 * either. Everything collapsed into `AkFetchError: Request failed: fetch failed`.
 *
 * The error shapes asserted here were recorded from real Node fetch rejections.
 */

/** A port nothing is listening on: bind, read the port, close. */
async function closedPort() {
    const probe = http.createServer(() => {});
    await new Promise((r) => probe.listen(0, '127.0.0.1', r));
    const { port } = probe.address();
    await new Promise((r) => probe.close(r));
    return port;
}

/** A server that accepts the connection and then says nothing at all. */
async function silentServer() {
    const server = http.createServer(() => {});
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

describe('transport error classification (finding M-2)', () => {
    afterEach(() => vi.restoreAllMocks());

    describe('connect failures become NetworkError', () => {
        test('ECONNREFUSED on a closed port', async () => {
            const port = await closedPort();
            const client = new HttpClient();

            const error = await client.executeRequest({
                url: `http://127.0.0.1:${port}/`, method: 'POST', data: { a: 1 }
            }).then(() => null, (e) => e);

            expect(error).toBeInstanceOf(NetworkError);
            expect(error.code).toBe('ECONNREFUSED');
            expect(error.type).toBe('NETWORK_ERROR');
            client.destroy();
        });

        test('ECONNREFUSED behind an AggregateError (dual-stack localhost)', async () => {
            const port = await closedPort();
            const client = new HttpClient();

            const error = await client.executeRequest({
                url: `http://localhost:${port}/`, method: 'POST', data: { a: 1 }
            }).then(() => null, (e) => e);

            expect(error).toBeInstanceOf(NetworkError);
            expect(error.code).toBe('ECONNREFUSED');
            client.destroy();
        });

        test('ENOTFOUND arriving on .cause', async () => {
            // synthesised rather than resolved for real so the test never depends
            // on a DNS server (some resolvers hijack NXDOMAIN); the shape is copied
            // verbatim from a real `fetch('http://x.invalid')` rejection
            const wrapped = new TypeError('fetch failed');
            wrapped.cause = Object.assign(new Error('getaddrinfo ENOTFOUND x.invalid'), { code: 'ENOTFOUND' });
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(wrapped);

            const client = new HttpClient();
            const error = await client.executeRequest({
                url: 'http://x.invalid/', method: 'POST', data: { a: 1 }
            }).then(() => null, (e) => e);

            expect(error).toBeInstanceOf(NetworkError);
            expect(error.code).toBe('ENOTFOUND');
            client.destroy();
        });
    });

    describe('undici deadlines become TimeoutError', () => {
        // The client's own AbortController and undici's headers/body timeouts are
        // both driven by `options.timeout`, so they race. Passing a long per-request
        // timeout keeps the abort out of the way and isolates the undici code.
        test('UND_ERR_BODY_TIMEOUT when the body trickles and never ends', async () => {
            const server = await makeServer((req, res) => {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.write('{"partial":');     // headers + a byte, then silence forever
                return true;
            });
            const client = new HttpClient({ timeout: 300 });

            const error = await client.executeRequest({
                url: server.url, method: 'POST', data: { a: 1 }, timeout: 15000
            }).then(() => null, (e) => e);

            expect(error).toBeInstanceOf(TimeoutError);
            expect(error.code).toBe('UND_ERR_BODY_TIMEOUT');
            expect(error.type).toBe('TIMEOUT_ERROR');
            client.destroy();
            await server.close();
        }, 20000);

        test('UND_ERR_HEADERS_TIMEOUT when the server never responds', async () => {
            const server = await silentServer();
            const client = new HttpClient({ timeout: 300 });

            const error = await client.executeRequest({
                url: server.url, method: 'POST', data: { a: 1 }, timeout: 15000
            }).then(() => null, (e) => e);

            expect(error).toBeInstanceOf(TimeoutError);
            expect(error.code).toBe('UND_ERR_HEADERS_TIMEOUT');
            client.destroy();
            await server.close();
        }, 20000);

        test('our own AbortController deadline still yields TimeoutError', async () => {
            const server = await silentServer();
            const client = new HttpClient({ timeout: 15000 });

            const error = await client.executeRequest({
                url: server.url, method: 'POST', data: { a: 1 }, timeout: 300
            }).then(() => null, (e) => e);

            expect(error).toBeInstanceOf(TimeoutError);
            expect(error.timeout).toBe(300);
            client.destroy();
            await server.close();
        }, 20000);
    });

    describe('response body parsing does not swallow the real error', () => {
        test('invalid JSON under a JSON content-type falls back to raw text', async () => {
            // `response.json()` consumes the stream before parsing, so the old
            // `catch { return response.text() }` fallback always threw
            // "Body is unusable" instead of returning the payload.
            const server = await makeServer((req, res) => {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end('this is not json');
                return true;
            });
            const client = new HttpClient();

            const result = await client.executeRequest({ url: server.url, method: 'POST', data: { a: 1 } });

            expect(result.status).toBe(200);
            expect(result.data).toBe('this is not json');
            client.destroy();
            await server.close();
        });

        test('an empty body under a JSON content-type is not an error', async () => {
            const server = await makeServer((req, res) => {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end('');
                return true;
            });
            const client = new HttpClient();

            const result = await client.executeRequest({ url: server.url, method: 'POST', data: { a: 1 } });

            expect(result.status).toBe(200);
            expect(result.data).toBe('');
            client.destroy();
            await server.close();
        });

        test('well-formed JSON still parses to an object', async () => {
            const server = await makeServer();
            const client = new HttpClient();

            const result = await client.executeRequest({ url: server.url, method: 'POST', data: { a: 1 } });

            expect(result.data).toEqual({ echo: { a: 1 } });
            client.destroy();
            await server.close();
        });
    });

    describe('classification and retry stay in agreement', () => {
        test('isNetworkError() sees a code hidden on .cause', () => {
            const strategy = new RetryStrategy();
            const wrapped = new TypeError('fetch failed');
            wrapped.cause = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });

            expect(strategy.isNetworkError(wrapped)).toBe(true);
            expect(strategy.isNetworkError(new NetworkError('x', { code: 'ECONNREFUSED' }))).toBe(true);
            expect(strategy.isNetworkError(new AkFetchError('plain'))).toBe(false);
        });

        test('a refused connection is actually retried, then reported as NetworkError', async () => {
            const port = await closedPort();
            const client = new HttpClient({ retry: { maxRetries: 2, baseDelay: 10, maxDelay: 20 } });
            const spy = vi.spyOn(globalThis, 'fetch');

            const error = await client.request({
                url: `http://127.0.0.1:${port}/`, method: 'POST', data: { a: 1 }
            }).then(() => null, (e) => e);

            expect(spy).toHaveBeenCalledTimes(3);            // 1 attempt + 2 retries
            expect(error).toBeInstanceOf(RetryError);
            expect(error.lastError).toBeInstanceOf(NetworkError);
            expect(error.lastError.code).toBe('ECONNREFUSED');
            client.destroy();
        }, 20000);

        test('a body timeout is retried too (TimeoutError is retryable by name)', async () => {
            const server = await makeServer((req, res) => {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.write('{"partial":');
                return true;
            });
            const client = new HttpClient({ timeout: 200, retry: { maxRetries: 1, baseDelay: 10, maxDelay: 20 } });

            const error = await client.request({
                url: server.url, method: 'POST', data: { a: 1 }, timeout: 15000
            }).then(() => null, (e) => e);

            expect(server.requests.length).toBe(2);          // 1 attempt + 1 retry
            expect(error).toBeInstanceOf(RetryError);
            expect(error.lastError).toBeInstanceOf(TimeoutError);
            client.destroy();
            await server.close();
        }, 20000);
    });
});
