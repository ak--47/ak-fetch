/**
 * Stream processing utilities for efficient data handling
 */

import { Transform, Readable, Writable } from 'stream';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { MemoryError } from './errors.js';

class StreamProcessors {
    constructor(options = {}) {
        this.highWaterMark = options.highWaterMark || 16384;
        this.maxMemoryUsage = options.maxMemoryUsage || 1024 * 1024 * 1024; // 1GB default
    }

    /**
     * Transform JSONL to JSON objects
     * @param {Object} options - Transform options
     * @returns {Transform} Transform stream
     */
    createJSONLTransform(options = {}) {
        let buffer = '';
        const highWaterMark = options.highWaterMark || this.highWaterMark;

        return new Transform({
            readableObjectMode: true,
            highWaterMark,
            transform(chunk, encoding, callback) {
                buffer += chunk.toString();
                let lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine) {
                        try {
                            this.push(JSON.parse(trimmedLine));
                        } catch (error) {
                            this.emit('error', new Error(`Invalid JSON line: ${trimmedLine}`));
                            return;
                        }
                    }
                }
                callback();
            },
            flush(callback) {
                if (buffer.trim()) {
                    try {
                        this.push(JSON.parse(buffer));
                    } catch (error) {
                        this.emit('error', new Error(`Invalid JSON in buffer: ${buffer}`));
                        return;
                    }
                }
                callback();
            }
        });
    }

    /**
     * Transform objects to JSONL format
     * @param {Object} options - Transform options
     * @returns {Transform} Transform stream
     */
    createJSONLStringifyTransform(options = {}) {
        return new Transform({
            writableObjectMode: true,
            readableObjectMode: false,
            transform(chunk, encoding, callback) {
                try {
                    const jsonString = JSON.stringify(chunk) + '\n';
                    callback(null, jsonString);
                } catch (error) {
                    callback(new Error(`Failed to stringify object: ${error.message}`));
                }
            }
        });
    }

    /**
     * Transform objects to CSV format
     * @param {Object} options - Transform options
     * @returns {Transform} Transform stream
     */
    createCSVTransform(options = {}) {
        let isFirstRow = true;
        let headers = options.headers || null;

        return new Transform({
            writableObjectMode: true,
            readableObjectMode: false,
            transform(chunk, encoding, callback) {
                try {
                    // Auto-detect headers from first object
                    if (isFirstRow && !headers) {
                        headers = Object.keys(chunk);
                        const headerRow = headers.join(',') + '\n';
                        this.push(headerRow);
                    }

                    // Ensure all nested objects are stringified
                    const processedChunk = { ...chunk };
                    for (const key in processedChunk) {
                        if (typeof processedChunk[key] === 'object' && processedChunk[key] !== null) {
                            processedChunk[key] = JSON.stringify(processedChunk[key]);
                        }
                    }

                    // Create CSV row
                    const row = headers.map(header => {
                        const value = processedChunk[header] || '';
                        const stringValue = String(value).replace(/"/g, '""');
                        return `"${stringValue}"`;
                    }).join(',') + '\n';

                    isFirstRow = false;
                    callback(null, row);
                } catch (error) {
                    callback(new Error(`Failed to create CSV row: ${error.message}`));
                }
            }
        });
    }

    /**
     * Batch objects into arrays
     * @param {number} batchSize - Size of each batch
     * @param {Object} options - Batch options
     * @returns {Transform} Transform stream
     */
    createBatchTransform(batchSize, options = {}) {
        let batch = [];
        const flushIncomplete = options.flushIncomplete !== false;

        return new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                batch.push(chunk);
                
                if (batch.length >= batchSize) {
                    callback(null, batch);
                    batch = [];
                } else {
                    callback();
                }
            },
            flush(callback) {
                if (batch.length > 0 && flushIncomplete) {
                    callback(null, batch);
                } else {
                    callback();
                }
            }
        });
    }

    /**
     * Memory monitoring transform
     * @param {Object} options - Memory options
     * @returns {Transform} Transform stream
     */
    createMemoryMonitorTransform(options = {}) {
        const maxMemory = options.maxMemory || this.maxMemoryUsage;
        const checkInterval = options.checkInterval || 100;
        let itemCount = 0;

        return new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                itemCount++;
                
                if (itemCount % checkInterval === 0) {
                    const memUsage = process.memoryUsage();
                    
                    if (memUsage.heapUsed > maxMemory) {
                        callback(new MemoryError(`Memory usage exceeded limit: ${memUsage.heapUsed} > ${maxMemory}`, {
                            memoryUsage: memUsage,
                            limit: maxMemory
                        }));
                        return;
                    }
                }
                
                callback(null, chunk);
            }
        });
    }

    /**
     * Create a backpressure-aware transform
     * @param {Function} transformFn - Transform function
     * @param {Object} options - Transform options
     * @returns {Transform} Transform stream
     */
    createBackpressureTransform(transformFn, options = {}) {
        const maxBuffer = options.maxBuffer || 100;
        let bufferCount = 0;

        return new Transform({
            objectMode: true,
            highWaterMark: maxBuffer,
            transform(chunk, encoding, callback) {
                bufferCount++;
                
                try {
                    const result = transformFn(chunk);
                    
                    if (result instanceof Promise) {
                        result
                            .then(data => {
                                bufferCount--;
                                callback(null, data);
                            })
                            .catch(error => {
                                bufferCount--;
                                callback(error);
                            });
                    } else {
                        bufferCount--;
                        callback(null, result);
                    }
                } catch (error) {
                    bufferCount--;
                    callback(error);
                }
            }
        });
    }

    /**
     * Create a rate-limited transform
     * @param {number} maxPerSecond - Maximum items per second
     * @param {Object} options - Rate limit options
     * @returns {Transform} Transform stream
     */
    createRateLimitTransform(maxPerSecond, options = {}) {
        const intervalMs = 1000 / maxPerSecond;
        let lastProcessTime = 0;

        return new Transform({
            objectMode: true,
            async transform(chunk, encoding, callback) {
                const now = Date.now();
                const timeSinceLastProcess = now - lastProcessTime;
                
                if (timeSinceLastProcess < intervalMs) {
                    const delay = intervalMs - timeSinceLastProcess;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                lastProcessTime = Date.now();
                callback(null, chunk);
            }
        });
    }

    /**
     * Create a stream that writes to multiple outputs
     * @param {Array} outputs - Array of writable streams
     * @param {Object} options - Tee options
     * @returns {Writable} Writable stream
     */
    createTeeStream(outputs, options = {}) {
        return new Writable({
            objectMode: options.objectMode || false,
            write(chunk, encoding, callback) {
                let completed = 0;
                const totalOutputs = outputs.length;
                
                if (totalOutputs === 0) {
                    callback();
                    return;
                }
                
                let hasError = false;
                
                outputs.forEach(output => {
                    output.write(chunk, encoding, (error) => {
                        if (error && !hasError) {
                            hasError = true;
                            callback(error);
                            return;
                        }
                        
                        completed++;
                        if (completed === totalOutputs && !hasError) {
                            callback();
                        }
                    });
                });
            }
        });
    }

    /**
     * Stream data to file with format selection
     * @param {string} filePath - Output file path
     * @param {string} format - Output format (json, csv, ndjson)
     * @param {Object} options - Stream options
     * @returns {Promise<string>} File path when complete
     */
    async streamToFile(dataStream, filePath, format = 'json', options = {}) {
        const writeStream = createWriteStream(filePath, { encoding: 'utf8' });
        
        try {
            switch (format.toLowerCase()) {
                case 'json':
                    await this.streamJSON(dataStream, writeStream, options);
                    break;
                case 'csv':
                    await this.streamCSV(dataStream, writeStream, options);
                    break;
                case 'ndjson':
                case 'jsonl':
                    await this.streamNDJSON(dataStream, writeStream, options);
                    break;
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }
            
            return filePath;
        } catch (error) {
            writeStream.destroy();
            throw error;
        }
    }

    /**
     * Stream data as JSON array
     * @param {Readable} dataStream - Input stream
     * @param {Writable} writeStream - Output stream
     * @param {Object} options - Options
     */
    async streamJSON(dataStream, writeStream, options = {}) {
        writeStream.write('[');
        
        let isFirst = true;
        const transformStream = new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                const prefix = isFirst ? '' : ',';
                isFirst = false;
                callback(null, prefix + JSON.stringify(chunk, null, options.indent));
            }
        });
        
        await pipeline(dataStream, transformStream, writeStream, { end: false });
        writeStream.write(']');
        
        // Wait for the write stream to finish flushing to disk
        await new Promise((resolve, reject) => {
            writeStream.end();
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
    }

    /**
     * Stream data as CSV
     * @param {Readable} dataStream - Input stream
     * @param {Writable} writeStream - Output stream
     * @param {Object} options - Options
     */
    async streamCSV(dataStream, writeStream, options = {}) {
        const csvTransform = this.createCSVTransform(options);
        await pipeline(dataStream, csvTransform, writeStream);
    }

    /**
     * Stream data as NDJSON
     * @param {Readable} dataStream - Input stream
     * @param {Writable} writeStream - Output stream
     * @param {Object} options - Options
     */
    async streamNDJSON(dataStream, writeStream, options = {}) {
        const ndjsonTransform = this.createJSONLStringifyTransform(options);
        await pipeline(dataStream, ndjsonTransform, writeStream);
    }

    /**
     * Get unique keys from a stream of objects
     * @param {Readable} dataStream - Input stream
     * @returns {Promise<Array>} Array of unique keys
     */
    async getUniqueKeys(dataStream) {
        const keysSet = new Set();
        
        const keyExtractor = new Writable({
            objectMode: true,
            write(chunk, encoding, callback) {
                if (chunk && typeof chunk === 'object') {
                    Object.keys(chunk).forEach(key => keysSet.add(key));
                }
                callback();
            }
        });
        
        await pipeline(dataStream, keyExtractor);
        return Array.from(keysSet);
    }
}

export default StreamProcessors;