//@ts-nocheck
/**
 * Connection Pooling Performance Benchmark
 * 
 * Compares performance with and without HTTP connection pooling against Mixpanel API
 * to demonstrate the benefits of keep-alive connections for analytics workloads.
 */

import akFetch from '../index.js';
import { performance } from 'perf_hooks';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Mixpanel Import API endpoint
const TEST_URL = 'https://api.mixpanel.com/import';
const MIXPANEL_AUTH = process.env.MIXPANEL_AUTH;

if (!MIXPANEL_AUTH) {
    console.error('❌ MIXPANEL_AUTH environment variable not set');
    process.exit(1);
}

/**
 * Run connection pooling comparison test
 */
async function runConnectionPoolingTest(enablePooling, testSize = '100k') {
    const dataFile = `./testData/${testSize}.ndjson`;
    const testName = `connection-pooling-${enablePooling ? 'enabled' : 'disabled'}-${testSize}`;
    
    console.log(`\n🔌 Testing connection pooling: ${enablePooling ? 'ENABLED' : 'DISABLED'} (${testSize} dataset)`);
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
        const result = await akFetch({
            url: TEST_URL,
            data: dataFile,
            batchSize: 2000, // Optimal Mixpanel batch size
            concurrency: 15,
            verbose: false,
            retries: 3,
            timeout: 60000, // Increased timeout for Mixpanel
            enableConnectionPooling: enablePooling,
            keepAlive: enablePooling,
            storeResponses: false,
            maxResponseBuffer: 10,
            headers: {
                'Authorization': MIXPANEL_AUTH,
                'Content-Type': 'application/json'
            },
            searchParams: {
                strict: 1
            }
        });
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        
        const metrics = {
            testName,
            connectionPooling: enablePooling,
            testSize,
            timestamp: new Date().toISOString(),
            performance: {
                duration: Math.round(duration),
                durationSeconds: (duration / 1000).toFixed(2),
                requests: result.reqCount,
                records: result.rowCount,
                rps: Math.round((result.reqCount / (duration / 1000)) * 100) / 100,
                recordsPerSecond: Math.round((result.rowCount / (duration / 1000)) * 100) / 100,
                errors: result.errors || 0,
                errorRate: ((result.errors || 0) / result.reqCount * 100).toFixed(2),
                avgRequestDuration: (duration / result.reqCount).toFixed(2)
            },
            memory: {
                peakHeapUsed: Math.round(Math.max(startMemory.heapUsed, endMemory.heapUsed) / 1024 / 1024),
                peakRSS: Math.round(Math.max(startMemory.rss, endMemory.rss) / 1024 / 1024),
                heapGrowth: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)
            }
        };
        
        console.log(`   ✅ Completed: ${metrics.performance.recordsPerSecond} records/sec, ${metrics.performance.rps} req/sec`);
        console.log(`   ⏱️  Avg request: ${metrics.performance.avgRequestDuration}ms, ${metrics.performance.errorRate}% errors`);
        
        return metrics;
        
    } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        return {
            testName,
            connectionPooling: enablePooling,
            testSize,
            timestamp: new Date().toISOString(),
            error: error.message,
            failed: true
        };
    }
}

/**
 * Run comprehensive connection pooling benchmark
 */
async function runConnectionPoolingBenchmark() {
    console.log('🔌 ak-fetch Connection Pooling Benchmark\n');
    const { getDatasetSize, logDatasetInfo } = await import('./dataset-helper.js');
    logDatasetInfo();
    console.log('Comparing performance with and without HTTP connection pooling...\n');
    
    const datasetSize = getDatasetSize();
    const results = [];
    
    if (datasetSize === '100k' || datasetSize === 'both') {
        // Test with 100k dataset
        console.log('📊 Testing with 100k dataset:');
        
        const withoutPooling = await runConnectionPoolingTest(false, '100k');
        results.push(withoutPooling);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const withPooling = await runConnectionPoolingTest(true, '100k');
        results.push(withPooling);
    }
    
    if (datasetSize === '1m' || datasetSize === 'both') {
        // Test with 1m dataset
        if (datasetSize === 'both') {
            console.log('\n📊 Testing with 1m dataset:');
        } else {
            console.log('📊 Testing with 1m dataset:');
        }
        
        const withoutPooling1m = await runConnectionPoolingTest(false, '1m');
        results.push(withoutPooling1m);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const withPooling1m = await runConnectionPoolingTest(true, '1m');
        results.push(withPooling1m);
    }
    
    // Save results
    await saveResults('connection-pooling-benchmark', results);
    
    // Generate report
    generateConnectionPoolingReport(results);
}

/**
 * Generate connection pooling performance report
 */
function generateConnectionPoolingReport(results) {
    console.log('\n🔌 CONNECTION POOLING PERFORMANCE REPORT');
    console.log('═'.repeat(60));
    
    const validResults = results.filter(r => !r.failed && r.performance);
    
    if (validResults.length === 0) {
        console.log('❌ No valid results to report');
        return;
    }
    
    console.log('\nPerformance Comparison:');
    console.log('Dataset | Pooling  | Records/sec | Req/sec | Avg Req (ms) | Errors');
    console.log('-'.repeat(70));
    
    validResults
        .sort((a, b) => a.testSize.localeCompare(b.testSize))
        .forEach(result => {
            const p = result.performance;
            console.log(
                `${result.testSize.padEnd(7)} | ` +
                `${(result.connectionPooling ? 'ENABLED' : 'DISABLED').padEnd(8)} | ` +
                `${p.recordsPerSecond.toString().padStart(10)} | ` +
                `${p.rps.toString().padStart(6)} | ` +
                `${p.avgRequestDuration.padStart(11)} | ` +
                `${p.errorRate}%`
            );
        });
    
    // Calculate improvements for each dataset size
    ['100k', '1m'].forEach(size => {
        const sizeResults = validResults.filter(r => r.testSize === size);
        const withoutPooling = sizeResults.find(r => !r.connectionPooling);
        const withPooling = sizeResults.find(r => r.connectionPooling);
        
        if (withoutPooling && withPooling) {
            const speedImprovement = ((withPooling.performance.recordsPerSecond - withoutPooling.performance.recordsPerSecond) / withoutPooling.performance.recordsPerSecond * 100).toFixed(1);
            const requestImprovement = ((withPooling.performance.rps - withoutPooling.performance.rps) / withoutPooling.performance.rps * 100).toFixed(1);
            const latencyImprovement = ((parseFloat(withoutPooling.performance.avgRequestDuration) - parseFloat(withPooling.performance.avgRequestDuration)) / parseFloat(withoutPooling.performance.avgRequestDuration) * 100).toFixed(1);
            
            console.log(`\n📈 ${size.toUpperCase()} DATASET IMPROVEMENTS:`);
            console.log(`   Throughput: +${speedImprovement}% faster record processing`);
            console.log(`   Request Rate: +${requestImprovement}% more requests per second`);
            console.log(`   Latency: ${latencyImprovement}% faster average request time`);
        }
    });
    
    // Best performers
    const bestThroughput = validResults.reduce((best, current) =>
        current.performance.recordsPerSecond > best.performance.recordsPerSecond ? current : best
    );
    
    const bestLatency = validResults.reduce((best, current) =>
        parseFloat(current.performance.avgRequestDuration) < parseFloat(best.performance.avgRequestDuration) ? current : best
    );
    
    console.log('\n🏆 PERFORMANCE CHAMPIONS:');
    console.log(`   Highest Throughput: ${bestThroughput.connectionPooling ? 'WITH' : 'WITHOUT'} pooling (${bestThroughput.performance.recordsPerSecond} records/sec)`);
    console.log(`   Lowest Latency: ${bestLatency.connectionPooling ? 'WITH' : 'WITHOUT'} pooling (${bestLatency.performance.avgRequestDuration}ms avg)`);
    
    console.log('\n💡 CONNECTION POOLING RECOMMENDATIONS:');
    console.log('   ✅ ALWAYS enable connection pooling in production');
    console.log('   ✅ Connection pooling reduces latency and improves throughput');
    console.log('   ✅ Benefits are more pronounced with higher request volumes');
    console.log('   ✅ Reduces server load by reusing TCP connections');
    
    console.log('\n🔧 CONFIGURATION:');
    console.log('   enableConnectionPooling: true (recommended)');
    console.log('   keepAlive: true (recommended)');
    console.log('   Monitor connection reuse in production logs');
}

/**
 * Save benchmark results to file
 */
async function saveResults(testType, results) {
    const resultsDir = './benchmarks/results';
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${resultsDir}/${testType}-${timestamp}.json`;
    
    const report = {
        testType,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        results
    };
    
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\n💾 Results saved to: ${filename}`);
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    // Default to 100k dataset when run directly
    process.env.DATASET_SIZE = process.env.DATASET_SIZE || '100k';
    runConnectionPoolingBenchmark().catch(console.error);
}

export { runConnectionPoolingBenchmark };
