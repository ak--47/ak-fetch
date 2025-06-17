/**
 * Form data handler for multipart form data and file uploads
 */

const FormData = require('form-data');
const { createReadStream, statSync } = require('fs');
const { basename } = require('path');
const { ValidationError } = require('./errors');

class FormDataHandler {
    constructor(options = {}) {
        this.maxFileSize = options.maxFileSize || 100 * 1024 * 1024; // 100MB default
        this.allowedMimeTypes = options.allowedMimeTypes || null;
        this.encoding = options.encoding || 'utf8';
    }

    /**
     * Create FormData from various input types
     * @param {Object|Array|FormData} data - Data to convert to FormData
     * @param {Object} options - Options for form data creation
     * @returns {FormData} FormData instance
     */
    createFormData(data, options = {}) {
        const form = new FormData();

        if (data instanceof FormData) {
            return data;
        }

        if (Array.isArray(data)) {
            // Handle array of objects
            data.forEach((item, index) => {
                this.appendToForm(form, `item_${index}`, item);
            });
        } else if (typeof data === 'object' && data !== null) {
            // Handle object
            Object.entries(data).forEach(([key, value]) => {
                this.appendToForm(form, key, value);
            });
        } else {
            // Handle primitive values
            form.append('data', String(data));
        }

        return form;
    }

    /**
     * Append a value to FormData with proper handling
     * @param {FormData} form - FormData instance
     * @param {string} key - Field key
     * @param {any} value - Value to append
     */
    appendToForm(form, key, value) {
        if (value === null || value === undefined) {
            form.append(key, '');
            return;
        }

        // Handle file objects
        if (this.isFileObject(value)) {
            this.appendFile(form, key, value);
            return;
        }

        // Handle file paths
        if (typeof value === 'string' && this.isFilePath(value)) {
            this.appendFilePath(form, key, value);
            return;
        }

        // Handle arrays
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                this.appendToForm(form, `${key}[${index}]`, item);
            });
            return;
        }

        // Handle nested objects
        if (typeof value === 'object') {
            Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                this.appendToForm(form, `${key}[${nestedKey}]`, nestedValue);
            });
            return;
        }

        // Handle primitive values
        form.append(key, String(value));
    }

    /**
     * Append a file object to FormData
     * @param {FormData} form - FormData instance
     * @param {string} key - Field key
     * @param {Object} fileObj - File object
     */
    appendFile(form, key, fileObj) {
        const options = {
            filename: fileObj.filename || fileObj.name || 'file',
            contentType: fileObj.contentType || fileObj.type || 'application/octet-stream'
        };

        if (fileObj.stream) {
            form.append(key, fileObj.stream, options);
        } else if (fileObj.buffer) {
            form.append(key, fileObj.buffer, options);
        } else if (fileObj.data) {
            form.append(key, fileObj.data, options);
        } else {
            throw new ValidationError(`Invalid file object for key "${key}"`, { field: key, value: fileObj });
        }
    }

    /**
     * Append a file path to FormData
     * @param {FormData} form - FormData instance
     * @param {string} key - Field key
     * @param {string} filePath - Path to file
     */
    appendFilePath(form, key, filePath) {
        try {
            const stats = statSync(filePath);
            
            if (!stats.isFile()) {
                throw new ValidationError(`Path is not a file: ${filePath}`, { field: key, value: filePath });
            }

            if (stats.size > this.maxFileSize) {
                throw new ValidationError(`File too large: ${filePath} (${stats.size} bytes, max: ${this.maxFileSize})`, { 
                    field: key, 
                    value: filePath 
                });
            }

            const stream = createReadStream(filePath);
            const filename = basename(filePath);
            
            form.append(key, stream, {
                filename,
                contentType: this.getMimeType(filePath)
            });
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ValidationError(`Failed to read file: ${filePath}`, { field: key, value: filePath });
        }
    }

    /**
     * Check if a value is a file object
     * @param {any} value - Value to check
     * @returns {boolean} True if file object
     */
    isFileObject(value) {
        if (!value || typeof value !== 'object') return false;
        
        return (
            value.stream || 
            value.buffer || 
            value.data ||
            (value.filename && (value.content || value.data))
        );
    }

    /**
     * Check if a string is a file path
     * @param {string} value - Value to check
     * @returns {boolean} True if file path
     */
    isFilePath(value) {
        if (typeof value !== 'string') return false;
        
        // Simple heuristic: contains path separators and no newlines
        return (value.includes('/') || value.includes('\\')) && !value.includes('\n');
    }

    /**
     * Get MIME type for a file path
     * @param {string} filePath - File path
     * @returns {string} MIME type
     */
    getMimeType(filePath) {
        const ext = filePath.toLowerCase().split('.').pop();
        
        const mimeTypes = {
            'txt': 'text/plain',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'json': 'application/json',
            'xml': 'application/xml',
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'mp4': 'video/mp4',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'zip': 'application/zip',
            'tar': 'application/x-tar',
            'gz': 'application/gzip'
        };

        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Convert FormData to headers and body for fetch
     * @param {FormData} form - FormData instance
     * @returns {Promise<Object>} Headers and body
     */
    async getFormRequestData(form) {
        return new Promise((resolve, reject) => {
            // Let FormData set the Content-Type with boundary
            const headers = form.getHeaders();
            
            // Get the form data as a buffer
            form.getLength((err, length) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (length) {
                    headers['Content-Length'] = length;
                }
                
                resolve({
                    headers,
                    body: form
                });
            });
        });
    }

    /**
     * Validate form data before sending
     * @param {FormData} form - FormData to validate
     * @param {Object} options - Validation options
     * @returns {Promise<boolean>} True if valid
     */
    async validateFormData(form, options = {}) {
        const maxSize = options.maxSize || this.maxFileSize;
        
        return new Promise((resolve, reject) => {
            form.getLength((err, length) => {
                if (err) {
                    reject(new ValidationError('Failed to calculate form data length', { value: form }));
                    return;
                }
                
                if (length > maxSize) {
                    reject(new ValidationError(`Form data too large: ${length} bytes (max: ${maxSize})`, { 
                        value: length, 
                        limit: maxSize 
                    }));
                    return;
                }
                
                resolve(true);
            });
        });
    }

    /**
     * Create multipart form data from mixed content
     * @param {Object} data - Data object with mixed content types
     * @param {Object} options - Options
     * @returns {FormData} FormData instance
     */
    createMixedFormData(data, options = {}) {
        const form = new FormData();
        
        // Separate files from regular data
        const files = {};
        const regularData = {};
        
        Object.entries(data).forEach(([key, value]) => {
            if (this.isFileObject(value) || (typeof value === 'string' && this.isFilePath(value))) {
                files[key] = value;
            } else {
                regularData[key] = value;
            }
        });
        
        // Add regular data as JSON if specified
        if (options.jsonData && Object.keys(regularData).length > 0) {
            form.append('data', JSON.stringify(regularData), {
                contentType: 'application/json'
            });
        } else {
            // Add regular data as individual fields
            Object.entries(regularData).forEach(([key, value]) => {
                this.appendToForm(form, key, value);
            });
        }
        
        // Add files
        Object.entries(files).forEach(([key, value]) => {
            this.appendToForm(form, key, value);
        });
        
        return form;
    }

    /**
     * Get statistics about form data
     * @param {FormData} form - FormData instance
     * @returns {Promise<Object>} Statistics
     */
    async getFormStats(form) {
        return new Promise((resolve, reject) => {
            form.getLength((err, length) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                resolve({
                    contentLength: length,
                    boundary: form.getBoundary(),
                    headers: form.getHeaders()
                });
            });
        });
    }
}

module.exports = FormDataHandler;