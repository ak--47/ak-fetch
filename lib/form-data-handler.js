/**
 * Form data handler — native web FormData/Blob (what undici fetch understands).
 */
import { statSync, existsSync, openAsBlob } from 'fs';
import { readFile } from 'fs/promises';
import { basename } from 'path';
import { ValidationError } from './errors.js';

class FormDataHandler {
    constructor(options = {}) {
        this.maxFileSize = options.maxFileSize || 100 * 1024 * 1024; // 100MB default
        this.allowedMimeTypes = options.allowedMimeTypes || null;
    }

    /**
     * @param {Object|Array|FormData} data
     * @returns {Promise<FormData>} native FormData ready for fetch
     */
    async createFormData(data) {
        if (data instanceof FormData) return data;
        const form = new FormData();
        if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) await this.appendToForm(form, `item_${i}`, data[i]);
        } else if (typeof data === 'object' && data !== null) {
            for (const [key, value] of Object.entries(data)) await this.appendToForm(form, key, value);
        } else {
            form.append('data', String(data));
        }
        return form;
    }

    async appendToForm(form, key, value) {
        if (value === null || value === undefined) { form.append(key, ''); return; }
        if (this.isFileObject(value)) { form.append(key, this.fileObjectToBlob(value), value.filename || value.name || 'file'); return; }
        if (typeof value === 'string' && this.isFilePath(value)) { await this.appendFilePath(form, key, value); return; }
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) await this.appendToForm(form, `${key}[${i}]`, value[i]);
            return;
        }
        if (typeof value === 'object') {
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
                await this.appendToForm(form, `${key}[${nestedKey}]`, nestedValue);
            }
            return;
        }
        form.append(key, String(value));
    }

    fileObjectToBlob(fileObj) {
        const type = fileObj.contentType || fileObj.type || 'application/octet-stream';
        const content = fileObj.buffer ?? fileObj.data ?? fileObj.content;
        if (content === undefined && !fileObj.stream) {
            throw new ValidationError('Invalid file object', { value: fileObj });
        }
        if (fileObj.stream) {
            throw new ValidationError('Stream file objects are no longer supported; pass a file path, buffer, or data', { value: fileObj });
        }
        return new Blob([content], { type });
    }

    async appendFilePath(form, key, filePath) {
        const stats = statSync(filePath);
        if (!stats.isFile()) throw new ValidationError(`Path is not a file: ${filePath}`, { field: key, value: filePath });
        if (stats.size > this.maxFileSize) {
            throw new ValidationError(`File too large: ${filePath} (${stats.size} bytes, max: ${this.maxFileSize})`, { field: key, value: filePath });
        }
        const type = this.getMimeType(filePath);
        const blob = typeof openAsBlob === 'function'
            ? await openAsBlob(filePath, { type })                       // Node ≥19.8: lazy, streams from disk
            : new Blob([await readFile(filePath)], { type });            // Node 18 fallback: buffered
        form.append(key, blob, basename(filePath));
    }

    isFileObject(value) {
        if (!value || typeof value !== 'object') return false;
        return Boolean(value.stream || value.buffer || value.data || (value.filename && (value.content || value.data)));
    }

    isFilePath(value) {
        if (typeof value !== 'string') return false;
        // must LOOK like a path AND exist — bare strings like "application/json" pass through as fields
        return (value.includes('/') || value.includes('\\')) && !value.includes('\n') && existsSync(value);
    }

    getMimeType(filePath) {
        const ext = filePath.toLowerCase().split('.').pop();
        const mimeTypes = {
            'txt': 'text/plain', 'html': 'text/html', 'css': 'text/css',
            'js': 'application/javascript', 'json': 'application/json', 'xml': 'application/xml',
            'pdf': 'application/pdf', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
            'png': 'image/png', 'gif': 'image/gif', 'svg': 'image/svg+xml',
            'mp4': 'video/mp4', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
            'zip': 'application/zip', 'tar': 'application/x-tar', 'gz': 'application/gzip'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}

export default FormDataHandler;
