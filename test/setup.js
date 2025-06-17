/**
 * Jest test setup
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Suppress console.log during tests unless specifically needed
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
    // Mock console methods to reduce noise during tests
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
});

afterEach(() => {
    // Restore console methods after each test
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    
    // Clear all mocks
    jest.clearAllMocks();
});

// Global test utilities
global.testUtils = {
    // Helper to restore console for specific tests
    restoreConsole: () => {
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
    },
    
    // Helper to create test data
    createTestData: (count = 3) => {
        return Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            name: `Item ${i + 1}`,
            value: Math.random() * 100
        }));
    },
    
    // Helper to create test configuration
    createTestConfig: (overrides = {}) => {
        return {
            url: 'https://api.example.com/test',
            method: 'POST',
            data: [{ test: 'data' }],
            verbose: false,
            retries: 3,
            timeout: 5000,
            ...overrides
        };
    },
    
    // Helper to wait for a specific time
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    // Helper to check if error is instance of specific type
    expectErrorType: (error, ErrorClass) => {
        expect(error).toBeInstanceOf(ErrorClass);
        expect(error.name).toBe(ErrorClass.name);
        if (error.type) {
            expect(error.type).toBeDefined();
        }
    }
};

// Increase timeout for integration tests
if (process.env.JEST_INTEGRATION_TESTS) {
    jest.setTimeout(30000);
}

// Mock global fetch if not available
if (!global.fetch) {
    global.fetch = jest.fn();
}

// Add custom matchers
expect.extend({
    toBeWithinRange(received, floor, ceiling) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
            return {
                message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false,
            };
        }
    },
    
    toHaveValidTimestamp(received) {
        const timestamp = new Date(received);
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        const pass = timestamp >= fiveMinutesAgo && timestamp <= now;
        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid recent timestamp`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be a valid recent timestamp`,
                pass: false,
            };
        }
    }
});