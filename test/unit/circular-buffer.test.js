// @ts-nocheck
/**
 * Unit tests for CircularBuffer
 */

import CircularBuffer from '../../lib/circular-buffer.js';

describe('CircularBuffer', () => {
    let buffer;

    beforeEach(() => {
        buffer = new CircularBuffer(5); // Small buffer for testing
    });

    describe('constructor', () => {
        test('should create buffer with correct size', () => {
            expect(buffer.maxSize).toBe(5);
            expect(buffer.getSize()).toBe(0);
            expect(buffer.isBufferFull()).toBe(false);
        });

        test('should create default size buffer', () => {
            const defaultBuffer = new CircularBuffer();
            expect(defaultBuffer.maxSize).toBe(1000);
        });
    });

    describe('push', () => {
        test('should add items to buffer', () => {
            buffer.push('item1');
            buffer.push('item2');
            
            expect(buffer.getSize()).toBe(2);
            expect(buffer.toArray()).toEqual(['item1', 'item2']);
        });

        test('should handle buffer overflow', () => {
            // Fill buffer to capacity
            for (let i = 0; i < 5; i++) {
                buffer.push(`item${i}`);
            }
            
            expect(buffer.isBufferFull()).toBe(true);
            expect(buffer.getSize()).toBe(5);
            
            // Add one more item (should overwrite oldest)
            buffer.push('item5');
            
            expect(buffer.getSize()).toBe(5);
            expect(buffer.toArray()).toEqual(['item1', 'item2', 'item3', 'item4', 'item5']);
            
            // Add another item
            buffer.push('item6');
            expect(buffer.toArray()).toEqual(['item2', 'item3', 'item4', 'item5', 'item6']);
        });

        test('should handle null and undefined values', () => {
            buffer.push(null);
            buffer.push(undefined);
            buffer.push('item');
            
            expect(buffer.getSize()).toBe(3);
            expect(buffer.toArray()).toEqual([null, undefined, 'item']);
        });
    });

    describe('toArray', () => {
        test('should return empty array for empty buffer', () => {
            expect(buffer.toArray()).toEqual([]);
        });

        test('should return correct order when not full', () => {
            buffer.push('a');
            buffer.push('b');
            buffer.push('c');
            
            expect(buffer.toArray()).toEqual(['a', 'b', 'c']);
        });

        test('should return correct order when buffer wraps around', () => {
            // Fill beyond capacity
            for (let i = 0; i < 7; i++) {
                buffer.push(i);
            }
            
            expect(buffer.toArray()).toEqual([2, 3, 4, 5, 6]);
        });
    });

    describe('clear', () => {
        test('should clear all items', () => {
            buffer.push('item1');
            buffer.push('item2');
            
            buffer.clear();
            
            expect(buffer.getSize()).toBe(0);
            expect(buffer.isBufferFull()).toBe(false);
            expect(buffer.toArray()).toEqual([]);
        });
    });

    describe('resize', () => {
        test('should resize buffer to larger size', () => {
            buffer.push('a');
            buffer.push('b');
            
            buffer.resize(10);
            
            expect(buffer.maxSize).toBe(10);
            expect(buffer.getSize()).toBe(2);
            expect(buffer.toArray()).toEqual(['a', 'b']);
        });

        test('should resize buffer to smaller size', () => {
            buffer.push('a');
            buffer.push('b');
            buffer.push('c');
            buffer.push('d');
            
            buffer.resize(2);
            
            expect(buffer.maxSize).toBe(2);
            expect(buffer.getSize()).toBe(2);
            expect(buffer.toArray()).toEqual(['a', 'b']);
        });

        test('should throw error for invalid size', () => {
            expect(() => buffer.resize(0)).toThrow('Buffer size must be positive');
            expect(() => buffer.resize(-1)).toThrow('Buffer size must be positive');
        });
    });

    describe('getLast', () => {
        test('should get last N items', () => {
            buffer.push('a');
            buffer.push('b');
            buffer.push('c');
            buffer.push('d');
            
            expect(buffer.getLast(2)).toEqual(['c', 'd']);
            expect(buffer.getLast(1)).toEqual(['d']);
            expect(buffer.getLast(10)).toEqual(['a', 'b', 'c', 'd']);
        });

        test('should handle empty buffer', () => {
            expect(buffer.getLast(5)).toEqual([]);
        });
    });

    describe('getFirst', () => {
        test('should get first N items', () => {
            buffer.push('a');
            buffer.push('b');
            buffer.push('c');
            buffer.push('d');
            
            expect(buffer.getFirst(2)).toEqual(['a', 'b']);
            expect(buffer.getFirst(1)).toEqual(['a']);
            expect(buffer.getFirst(10)).toEqual(['a', 'b', 'c', 'd']);
        });

        test('should handle empty buffer', () => {
            expect(buffer.getFirst(5)).toEqual([]);
        });
    });

    describe('getMemoryStats', () => {
        test('should return correct memory statistics', () => {
            buffer.push('item1');
            buffer.push('item2');
            
            const stats = buffer.getMemoryStats();
            
            expect(stats).toEqual({
                maxSize: 5,
                currentSize: 2,
                isFull: false,
                memoryUtilization: 40
            });
        });

        test('should show full buffer stats', () => {
            // Fill buffer
            for (let i = 0; i < 5; i++) {
                buffer.push(`item${i}`);
            }
            
            const stats = buffer.getMemoryStats();
            
            expect(stats.isFull).toBe(true);
            expect(stats.memoryUtilization).toBe(100);
        });
    });

    describe('edge cases', () => {
        test('should handle single item buffer', () => {
            const singleBuffer = new CircularBuffer(1);
            
            singleBuffer.push('first');
            expect(singleBuffer.toArray()).toEqual(['first']);
            
            singleBuffer.push('second');
            expect(singleBuffer.toArray()).toEqual(['second']);
        });

        test('should handle complex objects', () => {
            const obj1 = { id: 1, data: [1, 2, 3] };
            const obj2 = { id: 2, nested: { value: 'test' } };
            
            buffer.push(obj1);
            buffer.push(obj2);
            
            expect(buffer.toArray()).toEqual([obj1, obj2]);
        });

        test('should maintain references correctly', () => {
            const obj = { value: 'original' };
            buffer.push(obj);
            
            obj.value = 'modified';
            
            expect(buffer.toArray()[0].value).toBe('modified');
        });
    });
});