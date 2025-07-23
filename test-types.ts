/**
 * TypeScript type checking test file
 * Tests all imports, exports, and type definitions
 */

import { Readable } from 'stream';

// Import types from the definition file
import type { BatchRequestConfig, Result, HttpResponse } from './types.js';

// Since we can't import the actual function in a pure type test, we'll just test the types
declare const akFetch: {
  (config: BatchRequestConfig): Promise<Result>;
  (config: BatchRequestConfig[]): Promise<Result>;
};

// Test the function types work as expected

// Test BatchRequestConfig interface
const config: BatchRequestConfig = {
  url: 'https://api.example.com',
  data: [{ test: 'data' }],
  method: 'POST',
  batchSize: 10,
  concurrency: 5,
  retries: 3,
  verbose: true
};

// Test all optional properties exist
const fullConfig: BatchRequestConfig = {
  url: 'https://api.example.com',
  data: [{ test: 'data' }],
  batchSize: 100,
  concurrency: 10,
  maxTasks: 25,
  delay: 1000,
  searchParams: { key: 'value' },
  bodyParams: { param: 'value' },
  headers: { 'Authorization': 'Bearer token' },
  verbose: true,
  dryRun: false,
  logFile: './log.json',
  retries: 3,
  retryDelay: 1000,
  retryOn: [500, 502, 503],
  timeout: 30000,
  keepAlive: true,
  shell: {
    command: 'echo token',
    header: 'Authorization',
    prefix: 'Bearer'
  },
  method: 'POST',
  debug: false,
  highWaterMark: 16384,
  preset: 'mixpanel',
  transform: (item: any) => item,
  errorHandler: (error: any) => console.error(error),
  responseHandler: (response: any) => console.log(response),
  retryHandler: (error: any, attempt: number) => attempt < 3,
  hook: (results: Result[]) => results,
  storeResponses: true,
  clone: false,
  forceGC: false,
  noBatch: false,
  format: 'json',
  responseHeaders: false,
  enableCookies: false,
  maxResponseBuffer: 1000,
  maxMemoryUsage: 1024 * 1024,
  useStaticRetryDelay: false,
  enableConnectionPooling: true,
  maxFileSize: 1024 * 1024,
  showData: false,
  showSample: false
};

// Test data types
const arrayData: BatchRequestConfig = {
  url: 'https://api.example.com',
  data: [{ id: 1 }, { id: 2 }]
};

const stringData: BatchRequestConfig = {
  url: 'https://api.example.com',
  data: './data.json'
};

const streamData: BatchRequestConfig = {
  url: 'https://api.example.com',
  data: new Readable()
};

// Test function overloads
async function testOverloads() {
  // Single config -> Result
  const singleResult: Result = await akFetch(config);
  
  // Array config -> Result (aggregated result)
  const arrayResult: Result = await akFetch([config, config]);
  
  // Test Result interface
  const result: Result = {
    responses: [],
    duration: 1000,
    clockTime: '1s',
    reqCount: 1,
    rowCount: 100,
    rps: 1,
    errors: 0,
    stats: {
      heapUsed: 10.5,
      heapTotal: 20.0,
      external: 1.0,
      rss: 50.0
    },
    configCount: 1
  };
  
  // Test HttpResponse interface
  const response: HttpResponse = {
    data: { success: true },
    status: 200,
    statusText: 'OK',
    url: 'https://api.example.com',
    method: 'POST',
    headers: { 'content-type': 'application/json' }
  };
}

// Test dryRun types
const dryRunConfig: BatchRequestConfig = {
  url: 'https://api.example.com',
  dryRun: true
};

const curlDryRun: BatchRequestConfig = {
  url: 'https://api.example.com',
  dryRun: 'curl'
};

// Test format types
const jsonFormat: BatchRequestConfig = {
  url: 'https://api.example.com',
  format: 'json'
};

const csvFormat: BatchRequestConfig = {
  url: 'https://api.example.com',
  format: 'csv'
};

const ndjsonFormat: BatchRequestConfig = {
  url: 'https://api.example.com',
  format: 'ndjson'
};

// Test method types
const getMethods: BatchRequestConfig[] = [
  { url: 'https://api.example.com', method: 'GET' },
  { url: 'https://api.example.com', method: 'POST' },
  { url: 'https://api.example.com', method: 'PUT' },
  { url: 'https://api.example.com', method: 'DELETE' },
  { url: 'https://api.example.com', method: 'PATCH' },
  { url: 'https://api.example.com', method: 'HEAD' },
  { url: 'https://api.example.com', method: 'OPTIONS' }
];

// Test fire-and-forget mode
const fireAndForget: BatchRequestConfig = {
  url: 'https://api.example.com',
  data: [{ test: true }],
  retries: null
};

console.log('✅ All TypeScript types are valid!');