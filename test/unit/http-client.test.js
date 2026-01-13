// @ts-nocheck
/**
 * Unit tests for HTTP Client
 */

import HttpClient from '../../lib/http-client.js';
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('HttpClient', () => {
    let httpClient;

    beforeEach(() => {
        httpClient = new HttpClient();
        vi.clearAllMocks();
    });

    describe('DELETE requests with body', () => {
        test('should process JSON body for DELETE requests', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                json: vi.fn().mockResolvedValue({ success: true })
            };

            global.fetch.mockResolvedValue(mockResponse);

            const data = { id: 123, reason: 'test deletion' };
            const config = {
                url: 'https://api.example.com/resource',
                method: 'DELETE',
                data
            };

            await httpClient.request(config);

            // Verify fetch was called with correct parameters
            expect(global.fetch).toHaveBeenCalled();
            const [url, options] = global.fetch.mock.calls[0];

            expect(url.toString()).toBe('https://api.example.com/resource');
            expect(options.method).toBe('DELETE');
            expect(options.body).toBe(JSON.stringify(data));
            expect(options.headers['Content-Type']).toBe('application/json');
        });

        test('should set Content-Type header for DELETE with JSON data', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                json: vi.fn().mockResolvedValue({ success: true })
            };

            global.fetch.mockResolvedValue(mockResponse);

            await httpClient.request({
                url: 'https://api.example.com/resource',
                method: 'DELETE',
                data: { test: true }
            });

            const callArgs = global.fetch.mock.calls[0][1];
            expect(callArgs.headers['Content-Type']).toBe('application/json');
        });

        test('should apply transforms to DELETE request data', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                json: vi.fn().mockResolvedValue({ success: true })
            };

            global.fetch.mockResolvedValue(mockResponse);

            const transform = (item) => ({ ...item, transformed: true });
            const data = [{ id: 1 }, { id: 2 }];

            await httpClient.request({
                url: 'https://api.example.com/resource',
                method: 'DELETE',
                data,
                transform
            });

            const expectedBody = JSON.stringify([
                { id: 1, transformed: true },
                { id: 2, transformed: true }
            ]);

            expect(global.fetch).toHaveBeenCalled();
            const callArgs = global.fetch.mock.calls[0][1];
            expect(callArgs.body).toBe(expectedBody);
        });

        test('should handle bodyParams wrapping for DELETE requests', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                json: vi.fn().mockResolvedValue({ success: true })
            };

            global.fetch.mockResolvedValue(mockResponse);

            const data = { id: 123 };
            const bodyParams = {
                dataKey: 'items',
                action: 'delete'
            };

            await httpClient.request({
                url: 'https://api.example.com/resource',
                method: 'DELETE',
                data,
                bodyParams
            });

            const expectedBody = JSON.stringify({
                items: data,
                action: 'delete'
            });

            expect(global.fetch).toHaveBeenCalled();
            const callArgs = global.fetch.mock.calls[0][1];
            expect(callArgs.body).toBe(expectedBody);
        });

        test('should clone data for DELETE requests when clone option is true', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                json: vi.fn().mockResolvedValue({ success: true })
            };

            global.fetch.mockResolvedValue(mockResponse);

            const originalData = { id: 123, nested: { value: 'test' } };
            const transform = (data) => {
                data.modified = true;
                return data;
            };

            await httpClient.request({
                url: 'https://api.example.com/resource',
                method: 'DELETE',
                data: originalData,
                clone: true,
                transform
            });

            // Original data should not be modified when clone is true
            expect(originalData.modified).toBeUndefined();
            expect(originalData).toEqual({ id: 123, nested: { value: 'test' } });

            // But the sent data should have the transformation
            const sentBody = JSON.parse(global.fetch.mock.calls[0][1].body);
            expect(sentBody.modified).toBe(true);
        });

        test('should handle form-urlencoded content type for DELETE', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'text/plain']]),
                text: vi.fn().mockResolvedValue('success')
            };

            global.fetch.mockResolvedValue(mockResponse);

            const data = { id: 123, action: 'delete' };

            await httpClient.request({
                url: 'https://api.example.com/resource',
                method: 'DELETE',
                data,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const callArgs = global.fetch.mock.calls[0][1];
            expect(callArgs.body).toBe('id=123&action=delete');
            expect(callArgs.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        });
    });

    describe('Other HTTP methods', () => {
        test('should still process POST requests with body', async () => {
            const mockResponse = {
                ok: true,
                status: 201,
                statusText: 'Created',
                headers: new Map([['content-type', 'application/json']]),
                json: vi.fn().mockResolvedValue({ id: 456 })
            };

            global.fetch.mockResolvedValue(mockResponse);

            const data = { name: 'test', value: 123 };

            await httpClient.request({
                url: 'https://api.example.com/resource',
                method: 'POST',
                data
            });

            expect(global.fetch).toHaveBeenCalled();
            const [url, options] = global.fetch.mock.calls[0];

            expect(url.toString()).toBe('https://api.example.com/resource');
            expect(options.method).toBe('POST');
            expect(options.body).toBe(JSON.stringify(data));
            expect(options.headers['Content-Type']).toBe('application/json');
        });

        test('should still process PUT requests with body', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                json: vi.fn().mockResolvedValue({ updated: true })
            };

            global.fetch.mockResolvedValue(mockResponse);

            const data = { id: 789, name: 'updated' };

            await httpClient.request({
                url: 'https://api.example.com/resource/789',
                method: 'PUT',
                data
            });

            expect(global.fetch).toHaveBeenCalled();
            const [url, options] = global.fetch.mock.calls[0];

            expect(url.toString()).toBe('https://api.example.com/resource/789');
            expect(options.method).toBe('PUT');
            expect(options.body).toBe(JSON.stringify(data));
        });

        test('should still process PATCH requests with body', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                json: vi.fn().mockResolvedValue({ patched: true })
            };

            global.fetch.mockResolvedValue(mockResponse);

            const data = { field: 'newValue' };

            await httpClient.request({
                url: 'https://api.example.com/resource/123',
                method: 'PATCH',
                data
            });

            expect(global.fetch).toHaveBeenCalled();
            const [url, options] = global.fetch.mock.calls[0];

            expect(url.toString()).toBe('https://api.example.com/resource/123');
            expect(options.method).toBe('PATCH');
            expect(options.body).toBe(JSON.stringify(data));
        });

        test('should not send body for GET requests even if data provided', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                json: vi.fn().mockResolvedValue({ results: [] })
            };

            global.fetch.mockResolvedValue(mockResponse);

            await httpClient.request({
                url: 'https://api.example.com/resource',
                method: 'GET',
                data: { shouldBeIgnored: true }
            });

            const callArgs = global.fetch.mock.calls[0][1];
            expect(callArgs.body).toBeUndefined();
            expect(callArgs.method).toBe('GET');
        });
    });
});