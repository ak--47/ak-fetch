// types.d.ts

import type { Readable } from "stream";

/**
 * Main configuration object that controls all aspects of HTTP request processing
 */
export interface BatchRequestConfig {
  /**
   * The target URL for HTTP requests
   * @example "https://api.example.com/users"
   */
  url: string;

  /**
   * Data to be sent in requests — can be an array of objects, file path to JSON/JSONL, or a readable stream
   * @example [{ id: 1, name: "John" }, { id: 2, name: "Jane" }]
   * @example "./data.jsonl"
   * @example fs.createReadStream("./large-dataset.jsonl")
   */
  data?: object[] | string | Readable;

  /**
   * Number of records per HTTP request (use 0 to disable batching)
   * @default 1
   * @example 100
   */
  batchSize?: number;

  /**
   * Maximum concurrent HTTP requests
   * @default 10
   * @example 5
   */
  concurrency?: number;

  /**
   * Maximum queued tasks before pausing stream
   * @default 25
   * @example 50
   */
  maxTasks?: number;

  /**
   * Delay between requests in milliseconds
   * @default 0
   * @example 1000
   */
  delay?: number;

  /**
   * URL query parameters object
   * @example { api_key: "123", format: "json" }
   */
  searchParams?: Record<string, string>;

  /**
   * Additional body parameters merged with payload
   * @example { dataKey: "events" }
   */
  bodyParams?: Record<string, any>;

  /**
   * HTTP headers for requests
   * @default {}
   * @example { "Authorization": "Bearer token123", "Content-Type": "application/json" }
   */
  headers?: Record<string, string>;

  /**
   * Enable detailed logging and progress display
   * @default true
   * @example false
   */
  verbose?: boolean;

  /**
   * Test mode without making actual requests — `true` or `"curl"`
   * @default false
   * @example "curl"
   */
  dryRun?: boolean | "curl";

  /**
   * File path to save response data
   * @example "./responses.json"
   */
  logFile?: string;

  /**
   * Number of retry attempts for failed requests (`null` for fire-and-forget)
   * @default 3
   * @example 5
   * @example null
   */
  retries?: number | null;

  /**
   * Base delay between retries in milliseconds
   * @default 1000
   * @example 2000
   */
  retryDelay?: number;

  /**
   * HTTP status codes that trigger retries
   * @default [408,429,500,502,503,504,520,521,522,523,524]
   * @example [500,502,503]
   */
  retryOn?: number[];

  /**
   * Request timeout in milliseconds
   * @default 60000
   * @example 30000
   */
  timeout?: number;

  /**
   * Use HTTP connection pooling
   * @default true
   * @example false
   */
  keepAlive?: boolean;

  /**
   * Shell command config for dynamic headers
   * @example { command: "aws sts get-session-token", header: "Authorization", prefix: "AWS4-HMAC-SHA256" }
   */
  shell?: {
    /** Shell command to execute */
    command: string;
    /** Header name to set (default `'Authorization'`) */
    header?: string;
    /** Prefix for the header value (default `'Bearer'`) */
    prefix?: string;
  };

  /**
   * HTTP method to use (GET, POST, PUT, etc.)
   * @default 'POST'
   */
  method?: string;

  /**
   * Enable debug mode with detailed error info
   * @default false
   * @example true
   */
  debug?: boolean;

  /**
   * Stream buffer size in bytes
   * @default 16384
   * @example 32768
   */
  highWaterMark?: number;

  /**
   * Function to modify each data item before sending
   */
  transform?: (item: any) => any;

  /**
   * Custom error handling function
   */
  errorHandler?: (error: any) => void;

  /**
   * Function called with each successful response
   */
  responseHandler?: (response: any) => void;

  /**
   * Custom retry logic function
   */
  retryHandler?: (error: any, attempt: number) => boolean;

  /**
   * Post-processing hook for array configurations
   */
  hook?: (results: Result[]) => any;

  /**
   * Store responses in memory
   * @default true
   */
  storeResponses?: boolean;

  /**
   * Clone data before transform to prevent mutation
   * @default false
   */
  clone?: boolean;

  /**
   * Force garbage collection after each batch
   * @default false
   */
  forceGC?: boolean;

  /**
   * Disable batching (single request mode)
   * @default false
   */
  noBatch?: boolean;

  /**
   * Output format for log files: `json`, `csv`, or `ndjson`
   * @default 'json'
   */
  format?: "json" | "csv" | "ndjson";

  /**
   * Include response headers in output
   * @default false
   */
  responseHeaders?: boolean;

  /**
   * Enable automatic cookie handling
   * @default false
   */
  enableCookies?: boolean;

  /**
   * Maximum responses kept in memory
   * @default 1000
   * @example 500
   */
  maxResponseBuffer?: number;

  /**
   * Maximum memory usage in bytes before error
   */
  maxMemoryUsage?: number;

  /**
   * Use fixed retry delay instead of exponential backoff
   * @default false
   */
  useStaticRetryDelay?: boolean;

  /**
   * Enable HTTP connection pooling
   * @default true
   */
  enableConnectionPooling?: boolean;

  /**
   * Maximum file size for uploads in bytes
   */
  maxFileSize?: number;
}

/**
 * Individual HTTP response object structure
 */
export interface HttpResponse {
  /** Actual response content from the API (parsed JSON, text, etc.) */
  data: any;
  /** HTTP status code (200, 404, 500, etc.) */
  status: number;
  /** HTTP status message ("OK", "Not Found", etc.) */
  statusText: string;
  /** The full URL that was requested */
  url: string;
  /** HTTP method used ("GET", "POST", etc.) */
  method: string;
  /** Response headers object (only when responseHeaders: true) */
  headers?: Record<string, string>;
}

/**
 * Result object returned by ak-fetch operations
 */
export interface Result {
  /** Array of structured HTTP response objects from the API, or strings in curl/dry-run mode */
  responses: HttpResponse[] | string[] | any[];

  /** Total operation duration in milliseconds */
  duration: number;

  /** Human-readable duration string */
  clockTime: string;

  /** Total number of HTTP requests made */
  reqCount: number;

  /** Total number of data records processed */
  rowCount: number;

  /** Requests per second throughput */
  rps: number;

  /** Number of failed requests */
  errors?: number;

  /** Detailed metrics about memory usage and performance */
  stats?: {
    /** Heap memory used in MB */
    heapUsed: number;
    /** Total heap memory in MB */
    heapTotal: number;
    /** External memory in MB */
    external: number;
    /** Resident set size in MB */
    rss: number;
  };

  /** Number of configurations processed (only in multi-config mode) */
  configCount?: number;
}
