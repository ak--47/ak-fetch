//@ts-nocheck
/**
 * Memory Efficiency Benchmark
 * 
 * Tests memory usage patterns against Mixpanel API across different
 * configurations to optimize for large analytics dataset processing.
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
 * Monitor memory usage during test execution
 */
class MemoryMonitor {
    constructor() {
        this.samples = [];
        this.interval = null;
        this.sampleRate = 100; // ms
    }
    
    start() {
        this.samples = [];
        this.interval = setInterval(() => {
            const usage = process.memoryUsage();
            this.samples.push({
                timestamp: Date.now(),
                heapUsed: usage.heapUsed,
                heapTotal: usage.heapTotal,
                external: usage.external,
                rss: usage.rss
            });
        }, this.sampleRate);
    }
    
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    
    getStats() {
        if (this.samples.length === 0) return null;
        
        const heapUsed = this.samples.map(s => s.heapUsed);
        const rss = this.samples.map(s => s.rss);
        
        return {
            peakHeapUsed: Math.max(...heapUsed) / 1024 / 1024,
            avgHeapUsed: heapUsed.reduce((a, b) => a + b, 0) / heapUsed.length / 1024 / 1024,
            peakRSS: Math.max(...rss) / 1024 / 1024,
            avgRSS: rss.reduce((a, b) => a + b, 0) / rss.length / 1024 / 1024,
            samples: this.samples.length,
            memoryGrowth: (Math.max(...heapUsed) - Math.min(...heapUsed)) / 1024 / 1024
        };
    }
}

/**
 * Run memory efficiency test with specific configuration
 */
async function runMemoryTest(config, testName) {
    console.log(`\n💾 Testing memory efficiency: ${testName}`);
    
    const monitor = new MemoryMonitor();
    const startTime = performance.now();
    
    // Force garbage collection before test
    if (global.gc) {
        global.gc();
    }
    
    monitor.start();
    
    try {
        const result = await akFetch({
            url: TEST_URL,
            data: config.dataFile,
            ...config.options,
            verbose: false,
            headers: {
                'Authorization': MIXPANEL_AUTH,
                'Content-Type': 'application/json'
            },
            searchParams: {
                strict: 1
            },
            timeout: 60000,
            retries: 3
        });
        
        monitor.stop();
        const endTime = performance.now();
        const duration = endTime - startTime;
        const memoryStats = monitor.getStats();
        
        const metrics = {
            testName,
            config,
            timestamp: new Date().toISOString(),
            performance: {
                duration: Math.round(duration),
                durationSeconds: (duration / 1000).toFixed(2),
                requests: result.reqCount,
                records: result.rowCount,
                rps: Math.round((result.reqCount / (duration / 1000)) * 100) / 100,
                recordsPerSecond: Math.round((result.rowCount / (duration / 1000)) * 100) / 100,
                errors: result.errors || 0
            },
            memory: {
                ...memoryStats,
                memoryPerRecord: (memoryStats.peakHeapUsed / result.rowCount * 1024).toFixed(2), // KB per record
                memoryPerRequest: (memoryStats.peakHeapUsed / result.reqCount).toFixed(2) // MB per request
            }
        };
        
        console.log(`   ✅ Completed: ${metrics.memory.peakHeapUsed.toFixed(1)}MB peak, ${metrics.memory.memoryPerRecord}KB/record`);
        console.log(`   📊 Growth: ${metrics.memory.memoryGrowth.toFixed(1)}MB, ${metrics.performance.recordsPerSecond} records/sec`);
        
        return metrics;
        
    } catch (error) {
        monitor.stop();
        console.error(`   ❌ Failed: ${error.message}`);
        return {
            testName,
            config,
            timestamp: new Date().toISOString(),
            error: error.message,
            failed: true
        };
    }
}

/**
 * Run comprehensive memory efficiency benchmark
 */
async function runMemoryBenchmark() {
    console.log('💾 ak-fetch Memory Efficiency Benchmark\n');
    const { getDatasetSize, getDatasetFile, logDatasetInfo } = await import('./dataset-helper.js');
    logDatasetInfo();
    console.log('Testing memory usage patterns across different configurations...\n');
    
    const datasetSize = getDatasetSize();
    const dataFile = getDatasetFile(datasetSize);
    
    const testConfigs = [
        {
            name: `Default Config (${datasetSize})`,
            dataFile,
            options: {
                batchSize: 100,
                concurrency: 10,
                storeResponses: true,
                maxResponseBuffer: 1000
            }
        },
        {
            name: `Memory Optimized (${datasetSize})`,
            dataFile,
            options: {
                batchSize: 1000,
                concurrency: 5,
                storeResponses: false,
                maxResponseBuffer: 10,
                forceGC: true
            }
        },
        {
            name: `High Performance (${datasetSize})`,
            dataFile,
            options: {
                batchSize: 500,
                concurrency: 20,
                storeResponses: true,
                maxResponseBuffer: 2000,
                enableConnectionPooling: true
            }
        },
        {
            name: `Minimal Memory (${datasetSize})`,
            dataFile,
            options: {
                batchSize: 2000,
                concurrency: 3,
                storeResponses: false,
                maxResponseBuffer: 1,
                forceGC: true,
                highWaterMark: 8192
            }
        },
        {
            name: `Streaming Mode (${datasetSize})`,
            dataFile,
            options: {
                batchSize: 100,
                concurrency: 15,
                storeResponses: false,
                maxResponseBuffer: 0,
                highWaterMark: 4096
            }
        }
    ];
    
    const results = [];
    
    for (const config of testConfigs) {
        const result = await runMemoryTest(config, config.name);
        results.push(result);
        
        // Force garbage collection between tests
        if (global.gc) {
            global.gc();
        }
        
        // Pause between tests to stabilize memory
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Save results
    await saveResults('memory-benchmark', results);
    
    // Generate report
    generateMemoryReport(results);
}

/**
 * Generate memory efficiency report
 */
function generateMemoryReport(results) {
    console.log('\n🧠 MEMORY EFFICIENCY REPORT');
    console.log('═'.repeat(70));
    
    const validResults = results.filter(r => !r.failed && r.memory);
    
    if (validResults.length === 0) {
        console.log('❌ No valid results to report');
        return;
    }
    
    console.log('\\nMemory Usage by Configuration:');
    console.log('Configuration                | Peak (MB) | Avg (MB) | Growth (MB) | KB/Record | Records/sec');
    console.log('-'.repeat(90));
    
    validResults.forEach(result => {
        const m = result.memory;
        const p = result.performance;
        console.log(
            `${result.testName.padEnd(27)} | ` +
            `${m.peakHeapUsed.toFixed(1).padStart(8)} | ` +
            `${m.avgHeapUsed.toFixed(1).padStart(7)} | ` +
            `${m.memoryGrowth.toFixed(1).padStart(10)} | ` +
            `${m.memoryPerRecord.padStart(8)} | ` +
            `${p.recordsPerSecond.toString().padStart(10)}`
        );
    });
    
    // Memory efficiency analysis
    const datasetResults = validResults; // All results use the same dataset size now
    
    console.log('\\n📊 MEMORY ANALYSIS:');
    
    if (datasetResults.length > 0) {
        const bestMemory = datasetResults.reduce((best, current) => 
            current.memory.peakHeapUsed < best.memory.peakHeapUsed ? current : best
        );
        
        const bestEfficiency = datasetResults.reduce((best, current) => 
            parseFloat(current.memory.memoryPerRecord) < parseFloat(best.memory.memoryPerRecord) ? current : best
        );
        
        const bestGrowth = datasetResults.reduce((best, current) => 
            current.memory.memoryGrowth < best.memory.memoryGrowth ? current : best
        );
        
        console.log(`   Lowest Peak Memory: ${bestMemory.testName} (${bestMemory.memory.peakHeapUsed.toFixed(1)}MB)`);
        console.log(`   Most Efficient: ${bestEfficiency.testName} (${bestEfficiency.memory.memoryPerRecord}KB/record)`);
        console.log(`   Least Growth: ${bestGrowth.testName} (${bestGrowth.memory.memoryGrowth.toFixed(1)}MB growth)`);
    }
    
    // Memory optimization recommendations
    console.log('\\n💡 MEMORY OPTIMIZATION RECOMMENDATIONS:');
    
    const configurations = {
        'Low Memory': validResults.filter(r => r.testName.includes('Minimal') || r.testName.includes('Memory Optimized')),
        'High Performance': validResults.filter(r => r.testName.includes('High Performance')),
        'Streaming': validResults.filter(r => r.testName.includes('Streaming'))
    };
    
    Object.entries(configurations).forEach(([category, configs]) => {
        if (configs.length > 0) {
            const avgMemory = configs.reduce((sum, c) => sum + c.memory.peakHeapUsed, 0) / configs.length;
            const avgThroughput = configs.reduce((sum, c) => sum + c.performance.recordsPerSecond, 0) / configs.length;
            console.log(`   ${category}: ${avgMemory.toFixed(1)}MB avg peak, ${avgThroughput.toFixed(0)} records/sec avg`);
        }
    });
    
    console.log('\\n🎯 USAGE GUIDELINES:');
    console.log('   • For memory-constrained environments: Use storeResponses=false, small responseBuffer');
    console.log('   • For large datasets: Enable forceGC, use larger batch sizes, disable response storage');
    console.log('   • For real-time processing: Use streaming mode with minimal buffering');
    console.log('   • Monitor memory growth for long-running operations');
    console.log('   • Set maxMemoryUsage limits for production deployments');
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
        memoryLimit: process.memoryUsage().heapTotal,
        gcAvailable: typeof global.gc === 'function',
        results
    };
    
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\\n💾 Results saved to: ${filename}`);
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    // Default to 100k dataset when run directly
    process.env.DATASET_SIZE = process.env.DATASET_SIZE || '100k';
    
    // Enable garbage collection if available
    if (typeof global.gc === 'undefined') {
        console.log('💡 Tip: Run with --expose-gc flag for more accurate memory measurements');
    }
    
    runMemoryBenchmark().catch(console.error);
}

export { runMemoryBenchmark };