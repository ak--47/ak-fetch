/**
 * Circular buffer implementation for memory-efficient response storage
 * 
 * @description
 * Memory-efficient circular buffer for storing HTTP responses and other data.
 * Automatically overwrites oldest entries when capacity is reached, preventing
 * memory overflow while maintaining access to recent data.
 * 
 * @module CircularBuffer
 * @since 2.0.0
 * @version 2.0.0
 */

/**
 * Circular buffer class for efficient data storage with fixed capacity
 * 
 * @description
 * Implements a circular buffer (ring buffer) data structure that maintains
 * a fixed-size buffer of items. When capacity is reached, new items overwrite
 * the oldest items, providing constant memory usage and O(1) insertion.
 * 
 * @class CircularBuffer
 * @since 2.0.0
 */
class CircularBuffer {
    /**
     * Create a new circular buffer
     * 
     * @param {number} [maxSize=1000] - Maximum number of items to store
     * @description Buffer will start overwriting oldest items when this size is reached
     * 
     * @example
     * const buffer = new CircularBuffer(100);
     * // Buffer can hold up to 100 items
     * 
     * @example
     * const responseBuffer = new CircularBuffer(500);
     * // Dedicated buffer for storing HTTP responses
     * 
     * @since 2.0.0
     */
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.buffer = new Array(maxSize);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
        this.isFull = false;
    }

    /**
     * Add an item to the buffer
     * 
     * @description
     * Adds an item to the buffer. If the buffer is full, overwrites the oldest
     * item. Maintains circular behavior with O(1) insertion time.
     * 
     * @param {any} item - Item to add to the buffer
     * @description Can be any type of data (objects, primitives, etc.)
     * 
     * @example
     * buffer.push({ id: 1, data: 'test' });
     * buffer.push('string value');
     * buffer.push([1, 2, 3]);
     * 
     * @since 2.0.0
     */
    push(item) {
        this.buffer[this.head] = item;
        
        if (this.isFull) {
            this.tail = (this.tail + 1) % this.maxSize;
        }
        
        this.head = (this.head + 1) % this.maxSize;
        
        if (this.head === this.tail) {
            this.isFull = true;
        }
        
        if (this.size < this.maxSize) {
            this.size++;
        }
    }

    /**
     * Get all items from the buffer in insertion order
     * 
     * @description
     * Returns all items currently in the buffer in the order they were inserted.
     * For full buffers, starts with the oldest item and ends with the newest.
     * 
     * @returns {Array} All items in the buffer
     * @description Array ordered from oldest to newest item
     * 
     * @example
     * buffer.push('first');
     * buffer.push('second');
     * buffer.push('third');
     * console.log(buffer.toArray()); // ['first', 'second', 'third']
     * 
     * @example
     * // When buffer wraps around
     * const smallBuffer = new CircularBuffer(2);
     * smallBuffer.push('old');
     * smallBuffer.push('newer');
     * smallBuffer.push('newest'); // overwrites 'old'
     * console.log(smallBuffer.toArray()); // ['newer', 'newest']
     * 
     * @since 2.0.0
     */
    toArray() {
        if (this.size === 0) return [];
        
        const result = [];
        
        if (this.isFull) {
            // Start from tail to head when buffer is full
            for (let i = 0; i < this.maxSize; i++) {
                const index = (this.tail + i) % this.maxSize;
                result.push(this.buffer[index]);
            }
        } else {
            // When not full, just take from 0 to head
            for (let i = 0; i < this.head; i++) {
                result.push(this.buffer[i]);
            }
        }
        
        return result;
    }

    /**
     * Get the current number of items in the buffer
     * 
     * @description
     * Returns the actual number of items currently stored in the buffer.
     * Will be less than or equal to maxSize.
     * 
     * @returns {number} Current number of items
     * @description Range: 0 to maxSize
     * 
     * @example
     * const buffer = new CircularBuffer(10);
     * console.log(buffer.getSize()); // 0
     * buffer.push('item1');
     * console.log(buffer.getSize()); // 1
     * 
     * @since 2.0.0
     */
    getSize() {
        return this.size;
    }

    /**
     * Check if buffer has reached maximum capacity
     * 
     * @description
     * Returns true when the buffer contains maxSize items. Once full,
     * new items will overwrite the oldest items.
     * 
     * @returns {boolean} True if buffer is at maximum capacity
     * @description False if buffer can still accept items without overwriting
     * 
     * @example
     * const buffer = new CircularBuffer(3);
     * console.log(buffer.isBufferFull()); // false
     * buffer.push('a');
     * buffer.push('b');
     * buffer.push('c');
     * console.log(buffer.isBufferFull()); // true
     * 
     * @since 2.0.0
     */
    isBufferFull() {
        return this.isFull;
    }

    /**
     * Clear all items from the buffer
     * 
     * @description
     * Removes all items from the buffer and resets it to initial state.
     * Helps with garbage collection by clearing object references.
     * 
     * @example
     * buffer.push('item1');
     * buffer.push('item2');
     * console.log(buffer.getSize()); // 2
     * buffer.clear();
     * console.log(buffer.getSize()); // 0
     * 
     * @since 2.0.0
     */
    clear() {
        this.head = 0;
        this.tail = 0;
        this.size = 0;
        this.isFull = false;
        // Clear references to help GC
        this.buffer.fill(null);
    }

    /**
     * Get memory usage and buffer statistics
     * 
     * @description
     * Returns detailed information about buffer capacity, usage, and efficiency.
     * Useful for monitoring and debugging memory usage patterns.
     * 
     * @returns {Object} Buffer statistics object
     * @property {number} maxSize - Maximum buffer capacity
     * @property {number} currentSize - Current number of items
     * @property {boolean} isFull - Whether buffer is at capacity
     * @property {number} memoryUtilization - Percentage of capacity used (0-100)
     * 
     * @example
     * const stats = buffer.getMemoryStats();
     * console.log(`Buffer: ${stats.currentSize}/${stats.maxSize} (${stats.memoryUtilization}%)`);
     * if (stats.isFull) {
     *   console.log('Buffer is full, oldest items will be overwritten');
     * }
     * 
     * @since 2.0.0
     */
    getMemoryStats() {
        return {
            maxSize: this.maxSize,
            currentSize: this.size,
            isFull: this.isFull,
            memoryUtilization: (this.size / this.maxSize) * 100
        };
    }

    /**
     * Resize the buffer capacity
     * 
     * @description
     * Changes the buffer capacity and preserves existing items up to the new limit.
     * Creates a new internal buffer and migrates data. If shrinking, keeps the
     * most recent items.
     * 
     * @param {number} newSize - New maximum buffer size
     * @description Must be a positive integer
     * 
     * @throws {Error} When newSize is not positive
     * 
     * @example
     * const buffer = new CircularBuffer(5);
     * // Add some items...
     * buffer.resize(10); // Increase capacity to 10
     * 
     * @example
     * // Shrinking buffer preserves most recent items
     * const buffer = new CircularBuffer(10);
     * // Fill with 10 items...
     * buffer.resize(5); // Keeps 5 most recent items
     * 
     * @since 2.0.0
     */
    resize(newSize) {
        if (newSize <= 0) {
            throw new Error('Buffer size must be positive');
        }
        
        const currentItems = this.toArray();
        
        this.maxSize = newSize;
        this.buffer = new Array(newSize);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
        this.isFull = false;
        
        // Re-add items up to new capacity
        const itemsToAdd = Math.min(currentItems.length, newSize);
        for (let i = 0; i < itemsToAdd; i++) {
            this.push(currentItems[i]);
        }
    }

    /**
     * Get the most recent N items from the buffer
     * 
     * @description
     * Returns the N most recently added items. If N exceeds buffer size,
     * returns all available items.
     * 
     * @param {number} n - Number of recent items to retrieve
     * @description Must be a non-negative integer
     * 
     * @returns {Array} Array of the N most recent items
     * @description Ordered from oldest to newest within the selection
     * 
     * @example
     * buffer.push('a');
     * buffer.push('b');
     * buffer.push('c');
     * buffer.push('d');
     * console.log(buffer.getLast(2)); // ['c', 'd']
     * 
     * @example
     * // Requesting more items than available
     * console.log(buffer.getLast(10)); // Returns all 4 items: ['a', 'b', 'c', 'd']
     * 
     * @since 2.0.0
     */
    getLast(n) {
        const allItems = this.toArray();
        return allItems.slice(-n);
    }

    /**
     * Get the oldest N items from the buffer
     * 
     * @description
     * Returns the N oldest items currently in the buffer. If N exceeds buffer size,
     * returns all available items.
     * 
     * @param {number} n - Number of oldest items to retrieve
     * @description Must be a non-negative integer
     * 
     * @returns {Array} Array of the N oldest items
     * @description Ordered from oldest to newest within the selection
     * 
     * @example
     * buffer.push('a');
     * buffer.push('b');
     * buffer.push('c');
     * buffer.push('d');
     * console.log(buffer.getFirst(2)); // ['a', 'b']
     * 
     * @example
     * // After buffer wraps around
     * const smallBuffer = new CircularBuffer(3);
     * smallBuffer.push('old1');
     * smallBuffer.push('old2');
     * smallBuffer.push('old3');
     * smallBuffer.push('new1'); // overwrites 'old1'
     * console.log(smallBuffer.getFirst(2)); // ['old2', 'old3']
     * 
     * @since 2.0.0
     */
    getFirst(n) {
        const allItems = this.toArray();
        return allItems.slice(0, n);
    }
}

module.exports = CircularBuffer;