// @ts-nocheck
/**
 * Unit tests for FormDataHandler — native FormData/Blob (2.1.0)
 */

import FormDataHandler from '../../lib/form-data-handler.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('FormDataHandler', () => {
    let handler;
    const testFilePath = path.join(__dirname, '../fixtures/test-file.txt');

    beforeEach(() => {
        handler = new FormDataHandler();

        // Create test file
        writeFileSync(testFilePath, 'test file content');
    });

    afterEach(() => {
        // Clean up test file
        if (existsSync(testFilePath)) {
            unlinkSync(testFilePath);
        }
    });

    describe('constructor', () => {
        test('should create with default options', () => {
            const defaultHandler = new FormDataHandler();
            expect(defaultHandler.maxFileSize).toBe(100 * 1024 * 1024); // 100MB
            expect(defaultHandler.allowedMimeTypes).toBeNull();
        });

        test('should create with custom options', () => {
            const customHandler = new FormDataHandler({
                maxFileSize: 1024 * 1024, // 1MB
                allowedMimeTypes: ['image/jpeg', 'image/png']
            });

            expect(customHandler.maxFileSize).toBe(1024 * 1024);
            expect(customHandler.allowedMimeTypes).toEqual(['image/jpeg', 'image/png']);
        });
    });

    describe('createFormData', () => {
        test('should return native FormData instance', async () => {
            const data = { name: 'John', age: 30 };
            const form = await handler.createFormData(data);

            expect(form).toBeInstanceOf(FormData);
        });

        test('should create FormData from object', async () => {
            const data = { name: 'John', age: '30' };
            const form = await handler.createFormData(data);

            expect(form.get('name')).toBe('John');
            expect(form.get('age')).toBe('30');
        });

        test('should create FormData from array', async () => {
            const data = [{ id: 1 }, { id: 2 }];
            const form = await handler.createFormData(data);

            expect(form).toBeInstanceOf(FormData);
            expect(form.get('item_0[id]')).toBe('1');
            expect(form.get('item_1[id]')).toBe('2');
        });

        test('should return existing FormData unchanged', async () => {
            const existingForm = new FormData();
            const result = await handler.createFormData(existingForm);

            expect(result).toBe(existingForm);
        });

        test('should handle primitive values', async () => {
            const form = await handler.createFormData('simple string');
            expect(form).toBeInstanceOf(FormData);
            expect(form.get('data')).toBe('simple string');
        });

        test('should handle null and undefined', async () => {
            const form1 = await handler.createFormData(null);
            const form2 = await handler.createFormData(undefined);

            expect(form1).toBeInstanceOf(FormData);
            expect(form2).toBeInstanceOf(FormData);
        });
    });

    describe('appendToForm', () => {
        let form;

        beforeEach(() => {
            form = new FormData();
        });

        test('should append simple values', async () => {
            await handler.appendToForm(form, 'name', 'John');
            await handler.appendToForm(form, 'age', 30);
            await handler.appendToForm(form, 'active', true);

            expect(form.get('name')).toBe('John');
            expect(form.get('age')).toBe('30');
            expect(form.get('active')).toBe('true');
        });

        test('should handle null and undefined as empty strings', async () => {
            await handler.appendToForm(form, 'nullValue', null);
            await handler.appendToForm(form, 'undefinedValue', undefined);

            expect(form.get('nullValue')).toBe('');
            expect(form.get('undefinedValue')).toBe('');
        });

        test('should handle arrays with indexed keys', async () => {
            await handler.appendToForm(form, 'items', ['item1', 'item2']);

            expect(form.get('items[0]')).toBe('item1');
            expect(form.get('items[1]')).toBe('item2');
        });

        test('should handle nested objects with bracket notation', async () => {
            const nestedData = {
                name: 'John',
                age: 30
            };

            await handler.appendToForm(form, 'user', nestedData);

            expect(form.get('user[name]')).toBe('John');
            expect(form.get('user[age]')).toBe('30');
        });
    });

    describe('fileObjectToBlob', () => {
        test('should convert buffer to Blob', () => {
            const fileObj = {
                buffer: Buffer.from('test content'),
                contentType: 'text/plain'
            };

            const blob = handler.fileObjectToBlob(fileObj);

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe('text/plain');
        });

        test('should convert data to Blob', () => {
            const fileObj = {
                data: 'test content',
                type: 'application/json'
            };

            const blob = handler.fileObjectToBlob(fileObj);

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe('application/json');
        });

        test('should use default content type', () => {
            const fileObj = {
                buffer: Buffer.from('test content')
            };

            const blob = handler.fileObjectToBlob(fileObj);

            expect(blob.type).toBe('application/octet-stream');
        });

        test('should throw error for invalid file object', () => {
            const invalidFile = { filename: 'test.txt' }; // missing content

            expect(() => {
                handler.fileObjectToBlob(invalidFile);
            }).toThrow('Invalid file object');
        });

        // corrected in 2.1.0, see finding A5 in plans/2026-08-08-ak-fetch-2.1.0-review-findings.md
        test('should throw error for stream file objects', () => {
            const streamFile = {
                stream: {},
                filename: 'test.txt'
            };

            expect(() => {
                handler.fileObjectToBlob(streamFile);
            }).toThrow('Stream file objects are no longer supported');
        });
    });

    describe('appendFilePath', () => {
        let form;

        beforeEach(() => {
            form = new FormData();
        });

        test('should append file from path as Blob with correct name, type, and size', async () => {
            await handler.appendFilePath(form, 'file', testFilePath);

            const blob = form.get('file');
            expect(blob).toBeInstanceOf(Blob);
            expect(blob.name).toBe('test-file.txt');
            expect(blob.type).toBe('text/plain');
            expect(blob.size).toBe(17); // 'test file content' is 17 bytes
        });

        test('should throw error for non-existent file', async () => {
            await expect(async () => {
                await handler.appendFilePath(form, 'file', '/non/existent/file.txt');
            }).rejects.toThrow();
        });

        test('should throw error for directory path', async () => {
            const dirPath = path.dirname(testFilePath);

            await expect(async () => {
                await handler.appendFilePath(form, 'file', dirPath);
            }).rejects.toThrow('Path is not a file');
        });

        test('should throw ValidationError for oversized file', async () => {
            const smallHandler = new FormDataHandler({ maxFileSize: 10 }); // 10 bytes

            await expect(async () => {
                await smallHandler.appendFilePath(form, 'file', testFilePath);
            }).rejects.toThrow('File too large');
        });
    });

    describe('isFileObject', () => {
        test('should identify file objects', () => {
            expect(handler.isFileObject({ stream: {} })).toBe(true);
            expect(handler.isFileObject({ buffer: Buffer.from('test') })).toBe(true);
            expect(handler.isFileObject({ data: 'content' })).toBe(true);
            expect(handler.isFileObject({ filename: 'test.txt', data: 'data' })).toBe(true);
        });

        test('should reject non-file objects', () => {
            expect(handler.isFileObject(null)).toBe(false);
            expect(handler.isFileObject(undefined)).toBe(false);
            expect(handler.isFileObject('string')).toBe(false);
            expect(handler.isFileObject({ name: 'John' })).toBe(false);
            expect(handler.isFileObject([])).toBe(false);
        });
    });

    // corrected in 2.1.0, see finding A5 in plans/2026-08-08-ak-fetch-2.1.0-review-findings.md
    describe('isFilePath', () => {
        test('should identify actual file paths that exist', () => {
            expect(handler.isFilePath(testFilePath)).toBe(true);
        });

        test('should reject non-existent paths', () => {
            expect(handler.isFilePath('/path/to/nonexistent/file.txt')).toBe(false);
            expect(handler.isFilePath('relative/path/file.txt')).toBe(false);
        });

        test('should reject strings that look like paths but do not exist', () => {
            expect(handler.isFilePath('C:\\Windows\\file.txt')).toBe(false);
        });

        // corrected in 2.1.0, see finding A5 in plans/2026-08-08-ak-fetch-2.1.0-review-findings.md
        test('should reject strings containing slashes that are not paths', () => {
            expect(handler.isFilePath('application/json')).toBe(false);
            expect(handler.isFilePath('a/b/c')).toBe(false);
        });

        test('should reject non-file paths', () => {
            expect(handler.isFilePath(null)).toBe(false);
            expect(handler.isFilePath(undefined)).toBe(false);
            expect(handler.isFilePath(123)).toBe(false);
            expect(handler.isFilePath('simple string')).toBe(false);
            expect(handler.isFilePath('string\nwith\nnewlines')).toBe(false);
        });
    });

    describe('getMimeType', () => {
        test('should return correct MIME types', () => {
            expect(handler.getMimeType('file.txt')).toBe('text/plain');
            expect(handler.getMimeType('image.jpg')).toBe('image/jpeg');
            expect(handler.getMimeType('image.jpeg')).toBe('image/jpeg');
            expect(handler.getMimeType('image.png')).toBe('image/png');
            expect(handler.getMimeType('data.json')).toBe('application/json');
            expect(handler.getMimeType('script.js')).toBe('application/javascript');
        });

        test('should return default MIME type for unknown extensions', () => {
            expect(handler.getMimeType('file.unknown')).toBe('application/octet-stream');
            expect(handler.getMimeType('file')).toBe('application/octet-stream');
        });

        test('should be case insensitive', () => {
            expect(handler.getMimeType('FILE.TXT')).toBe('text/plain');
            expect(handler.getMimeType('IMAGE.JPG')).toBe('image/jpeg');
        });
    });

    describe('integration scenarios', () => {
        test('should handle complex nested data', async () => {
            const data = {
                user: {
                    name: 'John Doe',
                    profile: {
                        bio: 'Software developer'
                    }
                },
                settings: {
                    notifications: true,
                    theme: 'dark'
                }
            };

            const form = await handler.createFormData(data);
            expect(form).toBeInstanceOf(FormData);
            expect(form.get('user[name]')).toBe('John Doe');
            expect(form.get('user[profile][bio]')).toBe('Software developer');
            expect(form.get('settings[notifications]')).toBe('true');
            expect(form.get('settings[theme]')).toBe('dark');
        });

        test('should handle empty and null values', async () => {
            const data = {
                emptyString: '',
                nullValue: null,
                undefinedValue: undefined
            };

            const form = await handler.createFormData(data);
            expect(form).toBeInstanceOf(FormData);
            expect(form.get('emptyString')).toBe('');
            expect(form.get('nullValue')).toBe('');
            expect(form.get('undefinedValue')).toBe('');
        });

        test('should handle mixed file and data fields', async () => {
            const data = {
                name: 'document',
                file: {
                    buffer: Buffer.from('file content'),
                    filename: 'doc.txt',
                    type: 'text/plain'
                },
                description: 'A test file'
            };

            const form = await handler.createFormData(data);
            expect(form).toBeInstanceOf(FormData);
            expect(form.get('name')).toBe('document');
            expect(form.get('description')).toBe('A test file');

            const fileBlob = form.get('file');
            expect(fileBlob).toBeInstanceOf(Blob);
            expect(fileBlob.type).toBe('text/plain');
        });
    });
});
