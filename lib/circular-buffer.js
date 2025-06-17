/**
 * Circular buffer implementation for memory-efficient response storage
 */

class CircularBuffer {
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
     * @param {any} item - Item to add
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
     * Get all items from the buffer
     * @returns {Array} All items in the buffer
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
     * Get the current size of the buffer
     * @returns {number} Current size
     */
    getSize() {
        return this.size;
    }

    /**
     * Check if buffer is full
     * @returns {boolean} True if full
     */
    isBufferFull() {
        return this.isFull;
    }

    /**
     * Clear the buffer
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
     * Get memory usage stats
     * @returns {Object} Memory usage information
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
     * Resize the buffer (creates a new buffer)
     * @param {number} newSize - New buffer size
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
     * Get the last N items
     * @param {number} n - Number of items to get
     * @returns {Array} Last N items
     */
    getLast(n) {
        const allItems = this.toArray();
        return allItems.slice(-n);
    }

    /**
     * Get the first N items
     * @param {number} n - Number of items to get
     * @returns {Array} First N items
     */
    getFirst(n) {
        const allItems = this.toArray();
        return allItems.slice(0, n);
    }
}

module.exports = CircularBuffer;