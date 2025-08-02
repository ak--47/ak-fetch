/**
 * Consumer usage test - simulates how external users would import and use ak-fetch
 * This file validates the public API and type definitions work correctly
 */

import akFetch, { BatchRequestConfig, Result, HttpResponse } from './index.js';

async function testConsumerUsage() {
  // Test basic usage
  const basicConfig: BatchRequestConfig = {
    url: 'https://httpbin.org/post',
    data: [{ test: 'data' }],
    method: 'POST',
    dryRun: true
  };

  const result: Result = await akFetch(basicConfig);
  console.log('Basic result:', result.reqCount);

  // Test multiple configs
  const multipleConfigs: BatchRequestConfig[] = [
    {
      url: 'https://httpbin.org/post',
      data: [{ id: 1 }],
      dryRun: true
    },
    {
      url: 'https://httpbin.org/put', 
      data: [{ id: 2 }],
      method: 'PUT',
      dryRun: true
    }
  ];

  const multiResult: Result = await akFetch(multipleConfigs);
  console.log('Multi result:', multiResult.configCount);

  // Test all interface properties compile correctly
  const fullConfig: BatchRequestConfig = {
    url: 'https://httpbin.org/post',
    data: './test.json',
    batchSize: 10,
    concurrency: 5,
    maxTasks: 20,
    delay: 100,
    searchParams: { key: 'value' },
    bodyParams: { param: 'test' },
    headers: { 'Authorization': 'Bearer token' },
    verbose: true,
    dryRun: 'curl',
    logFile: './output.json',
    retries: 3,
    retryDelay: 1000,
    retryOn: [500, 502, 503],
    timeout: 30000,
    keepAlive: true,
    method: 'POST',
    debug: false,
    preset: 'mixpanel',
    format: 'json',
    enableCookies: false,
    maxResponseBuffer: 1000,
    useStaticRetryDelay: false,
    enableConnectionPooling: true,
    showData: false,
    showSample: false
  };

  // Test fire-and-forget mode
  const fireForgetConfig: BatchRequestConfig = {
    url: 'https://httpbin.org/post',
    data: [{ test: true }],
    retries: null, // This should be allowed
    dryRun: true
  };

  // Test response interface
  const responses: HttpResponse[] = result.responses as HttpResponse[];
  if (responses.length > 0) {
    const response = responses[0];
    console.log('Response status:', response.status);
    console.log('Response URL:', response.url);
  }

  console.log('✅ All consumer type tests passed!');
}

// Type-only file - compilation verification
export { testConsumerUsage };