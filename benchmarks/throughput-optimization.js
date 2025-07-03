//@ts-nocheck
/**
 * Throughput Optimization Benchmark
 * 
 * Tests maximum throughput capabilities against Mixpanel API to find
 * the optimal configuration for highest events per second processing.
 */

import akFetch from '../index.js';
import { performance } from 'perf_hooks';
import fs from 'fs';
import os from 'os';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

// Mixpanel Import API endpoint
const TEST_URL = 'https://api.mixpanel.com/import';
const MIXPANEL_AUTH = process.env.MIXPANEL_AUTH;

if (!MIXPANEL_AUTH) {
    console.error('❌ MIXPANEL_AUTH environment variable not set');
    process.exit(1);
}

/**
 * Run throughput optimization test
 */
async function runThroughputTest(config, testName) {
    console.log(`\n🚀 Testing throughput: ${testName}`);
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
        const result = await akFetch({
            url: TEST_URL,
            data: config.dataFile,
            ...config.options,
            headers: {
                'Authorization': MIXPANEL_AUTH,
                'Content-Type': 'application/json'
            },
            searchParams: {
                strict: 1
            },
            timeout: 120000, // Extended timeout for high throughput tests
            retries: 2, // Fewer retries for throughput focus
            verbose: true
        });
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        
        const metrics = {
            testName,
            config: config.options,
            timestamp: new Date().toISOString(),
            performance: {
                duration: Math.round(duration),
                durationSeconds: (duration / 1000).toFixed(2),
                requests: result.reqCount,
                records: result.rowCount,
                rps: Math.round((result.reqCount / (duration / 1000)) * 100) / 100,
                recordsPerSecond: Math.round((result.rowCount / (duration / 1000)) * 100) / 100,
                eventsPerMinute: Math.round((result.rowCount / (duration / 1000)) * 60),
                errors: result.errors || 0,
                errorRate: ((result.errors || 0) / result.reqCount * 100).toFixed(2),
                successRate: (100 - ((result.errors || 0) / result.reqCount * 100)).toFixed(2),
                throughputScore: Math.round(result.rowCount / (duration / 1000) * (1 - (result.errors || 0) / result.reqCount)) // Records/sec adjusted for errors
            },
            memory: {
                peakHeapUsed: Math.round(Math.max(startMemory.heapUsed, endMemory.heapUsed) / 1024 / 1024),
                peakRSS: Math.round(Math.max(startMemory.rss, endMemory.rss) / 1024 / 1024),
                heapGrowth: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)
            },
            efficiency: {
                eventsPerMB: Math.round(result.rowCount / (Math.max(startMemory.heapUsed, endMemory.heapUsed) / 1024 / 1024)),
                requestsPerSecondPerCore: Math.round((result.reqCount / (duration / 1000)) / os.cpus().length * 100) / 100
            }
        };
        
        console.log(`   ✅ ${metrics.performance.recordsPerSecond} events/sec, ${metrics.performance.eventsPerMinute} events/min`);
        console.log(`   📊 ${metrics.performance.rps} req/sec, ${metrics.performance.successRate}% success rate`);
        console.log(`   💾 ${metrics.memory.peakHeapUsed}MB peak memory, ${metrics.efficiency.eventsPerMB} events/MB`);
        
        return metrics;
        
    } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        return {
            testName,
            config: config.options,
            timestamp: new Date().toISOString(),
            error: error.message,
            failed: true
        };
    }
}

/**
 * Run comprehensive throughput benchmark
 */
async function runThroughputBenchmark() {
    console.log('🚀 ak-fetch Throughput Optimization Benchmark\n');
    console.log('Testing maximum event processing throughput against Mixpanel API...\n');
    
    const testConfigs = [
        {
            name: 'Balanced Throughput',
            dataFile: './testData/100k.ndjson',
            options: {
                batchSize: 2000,
                concurrency: 15,
                enableConnectionPooling: true,
                storeResponses: false,
                maxResponseBuffer: 10
            }
        },
        {
            name: 'Maximum Throughput',
            dataFile: './testData/100k.ndjson',
            options: {
                batchSize: 3000,
                concurrency: 25,
                enableConnectionPooling: true,
                storeResponses: false,
                maxResponseBuffer: 5,
                forceGC: false
            }
        },
        {
            name: 'Extreme Throughput',
            dataFile: './testData/100k.ndjson',
            options: {
                batchSize: 4000,
                concurrency: 40,
                enableConnectionPooling: true,
                storeResponses: false,
                maxResponseBuffer: 1,
                forceGC: false,
                delay: 0
            }
        },
        {
            name: 'Large Dataset - Optimized',
            dataFile: './testData/1m.ndjson',
            options: {
                batchSize: 3000,
                concurrency: 20,
                enableConnectionPooling: true,
                storeResponses: false,
                maxResponseBuffer: 5,
                forceGC: true // Enable GC for large dataset
            }
        }
    ];
    
    const results = [];
    
    // Run throughput tests
    for (const config of testConfigs) {
        const result = await runThroughputTest(config, config.name);
        results.push(result);
        
        // Cool down between tests
        console.log('   ⏳ Cooling down...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        if (global.gc) global.gc();
    }
    
    // Save results
    await saveResults('throughput-optimization', results);
    
    // Generate report
    generateThroughputReport(results);
}

/**
 * Generate throughput optimization report
 */
function generateThroughputReport(results) {
    console.log('\n🚀 THROUGHPUT OPTIMIZATION REPORT');
    console.log('═'.repeat(60));
    
    const validResults = results.filter(r => !r.failed && r.performance);
    
    if (validResults.length === 0) {
        console.log('❌ No valid results to report');
        return;
    }
    
    console.log('\nThroughput Performance Summary:');
    console.log('Configuration        | Events/sec | Events/min | Req/sec | Success% | Memory(MB)');
    console.log('-'.repeat(80));
    
    validResults
        .sort((a, b) => b.performance.throughputScore - a.performance.throughputScore)
        .forEach(result => {
            const p = result.performance;
            const m = result.memory;
            console.log(
                `${result.testName.padEnd(20)} | ` +
                `${p.recordsPerSecond.toString().padStart(9)} | ` +
                `${p.eventsPerMinute.toString().padStart(9)} | ` +
                `${p.rps.toString().padStart(6)} | ` +
                `${p.successRate.toString().padStart(7)}% | ` +
                `${m.peakHeapUsed.toString().padStart(9)}`
            );
        });
    
    // Best performers
    const bestThroughput = validResults.reduce((best, current) =>
        current.performance.recordsPerSecond > best.performance.recordsPerSecond ? current : best
    );
    
    const bestEfficiency = validResults.reduce((best, current) =>
        current.efficiency.eventsPerMB > best.efficiency.eventsPerMB ? current : best
    );
    
    const mostReliable = validResults.reduce((best, current) =>
        parseFloat(current.performance.successRate) > parseFloat(best.performance.successRate) ? current : best
    );
    
    console.log('\n🏆 THROUGHPUT CHAMPIONS:');
    console.log(`   Highest Events/Sec: ${bestThroughput.testName} (${bestThroughput.performance.recordsPerSecond} events/sec)`);
    console.log(`   Most Memory Efficient: ${bestEfficiency.testName} (${bestEfficiency.efficiency.eventsPerMB} events/MB)`);
    console.log(`   Most Reliable: ${mostReliable.testName} (${mostReliable.performance.successRate}% success rate)`);
    
    // Large dataset performance
    const largeResult = validResults.find(r => r.testName.includes('Large Dataset'));
    if (largeResult) {
        console.log(`\n📊 Large Dataset Performance (1M events):`);
        console.log(`   Throughput: ${largeResult.performance.recordsPerSecond} events/sec`);
        console.log(`   Total Processing Time: ${largeResult.performance.durationSeconds}s`);
        console.log(`   Events Per Minute: ${largeResult.performance.eventsPerMinute}`);
        console.log(`   Memory Efficiency: ${largeResult.efficiency.eventsPerMB} events/MB`);
        console.log(`   Reliability: ${largeResult.performance.successRate}% success rate`);
    }
    
    console.log('\n💡 THROUGHPUT OPTIMIZATION TIPS:');
    console.log('   • Higher batch sizes (2000-4000) generally improve throughput');
    console.log('   • Optimal concurrency varies by network and API response time');
    console.log('   • Disable response storage for maximum throughput');
    console.log('   • Monitor error rates - pushing too hard can hurt success rates');
    console.log('   • Use connection pooling for sustained high throughput');
    console.log('   • Consider API rate limits and account tier restrictions');
    
    // Calculate optimal configuration
    const optimalConfig = validResults.reduce((best, current) => {
        const bestScore = best.performance.throughputScore * parseFloat(best.performance.successRate) / 100;
        const currentScore = current.performance.throughputScore * parseFloat(current.performance.successRate) / 100;
        return currentScore > bestScore ? current : best;
    });
    
    console.log('\n🎯 RECOMMENDED OPTIMAL CONFIGURATION:');
    console.log('```javascript');
    console.log('const optimalThroughputConfig = {');
    Object.entries(optimalConfig.config).forEach(([key, value]) => {
        console.log(`  ${key}: ${JSON.stringify(value)},`);
    });
    console.log('};');
    console.log('```');
    console.log(`Expected Performance: ${optimalConfig.performance.recordsPerSecond} events/sec`);
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
    runThroughputBenchmark().catch(console.error);
}

export { runThroughputBenchmark };