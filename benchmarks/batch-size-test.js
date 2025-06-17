/**
 * Batch Size Optimization Benchmark
 * 
 * Tests different batch sizes to find optimal batching strategy
 * for different data volumes and network conditions.
 */

const akFetch = require('../index.js');
const { performance } = require('perf_hooks');
const fs = require('fs');

// Mock HTTP server endpoint for testing
const TEST_URL = 'https://httpbin.org/post';

/**
 * Run benchmark with specific batch size
 */
async function runBatchSizeTest(batchSize, dataSize = '100k') {
    const dataFile = `./testData/${dataSize}.ndjson`;
    const testName = `batch-size-${batchSize}-${dataSize}`;
    
    console.log(`\n📦 Testing batch size: ${batchSize} (${dataSize} dataset)`);
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
        const result = await akFetch({
            url: TEST_URL,
            data: dataFile,
            batchSize: batchSize,
            concurrency: 15, // Fixed concurrency for batch size comparison
            verbose: false,
            retries: 3,
            timeout: 30000,
            enableConnectionPooling: true,
            storeResponses: false,
            maxResponseBuffer: 10
        });
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        
        const metrics = {
            testName,
            batchSize,
            dataSize,
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
                avgRecordsPerRequest: Math.round(result.rowCount / result.reqCount),
                efficiency: Math.round((result.rowCount / result.reqCount / batchSize) * 100) // Batch fill efficiency
            },
            memory: {
                peakHeapUsed: Math.round(Math.max(startMemory.heapUsed, endMemory.heapUsed) / 1024 / 1024),
                peakRSS: Math.round(Math.max(startMemory.rss, endMemory.rss) / 1024 / 1024),
                heapGrowth: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)
            }
        };
        
        console.log(`   ✅ Completed: ${metrics.performance.recordsPerSecond} records/sec, ${metrics.performance.requests} requests`);
        console.log(`   📊 Efficiency: ${metrics.performance.efficiency}% batch fill, ${metrics.performance.avgRecordsPerRequest} records/req`);
        
        return metrics;
        
    } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        return {
            testName,
            batchSize,
            dataSize,
            timestamp: new Date().toISOString(),
            error: error.message,
            failed: true
        };
    }
}

/**
 * Test different batch size categories
 */
async function runBatchSizeBenchmark() {
    console.log('📦 ak-fetch Batch Size Optimization Benchmark\n');
    console.log('Testing different batch sizes to find optimal batching strategy...\n');
    
    const batchSizes = [
        1,      // Individual requests
        10,     // Small batches
        50,     // Medium-small batches
        100,    // Medium batches
        250,    // Medium-large batches
        500,    // Large batches
        1000,   // Very large batches
        2500,   // Extra large batches
        5000    // Maximum recommended batch size
    ];
    
    const results = [];
    
    // Test with 100k dataset
    console.log('📊 Testing with 100k dataset:');
    for (const batchSize of batchSizes) {
        const result = await runBatchSizeTest(batchSize, '100k');
        results.push(result);
        
        // Brief pause between tests
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Test optimal batch size with 1m dataset
    console.log('\n📊 Testing optimal batch size with 1m dataset:');
    const optimalBatchSize = findOptimalBatchSize(results);
    console.log(`\nOptimal batch size: ${optimalBatchSize}`);
    
    const largeResult = await runBatchSizeTest(optimalBatchSize, '1m');
    results.push(largeResult);
    
    // Save results
    await saveResults('batch-size-benchmark', results);
    
    // Generate report
    generateBatchSizeReport(results);
}

/**
 * Find optimal batch size from results
 */
function findOptimalBatchSize(results) {
    const validResults = results.filter(r => !r.failed && r.performance);
    if (validResults.length === 0) return 100; // Default fallback
    
    // Score batch sizes based on multiple factors:
    // - Records per second (40% weight)
    // - Memory efficiency (30% weight) 
    // - Batch efficiency (20% weight)
    // - Error rate (10% weight - penalty)
    
    const scored = validResults.map(result => {
        const p = result.performance;
        const m = result.memory;
        
        // Normalize metrics (0-1 scale)
        const maxRecordsPerSec = Math.max(...validResults.map(r => r.performance.recordsPerSecond));
        const minMemory = Math.min(...validResults.map(r => r.memory.peakHeapUsed));
        const maxEfficiency = Math.max(...validResults.map(r => r.performance.efficiency));
        const maxErrorRate = Math.max(...validResults.map(r => parseFloat(r.performance.errorRate)));
        
        const recordsScore = p.recordsPerSecond / maxRecordsPerSec;
        const memoryScore = minMemory / m.peakHeapUsed;
        const efficiencyScore = p.efficiency / maxEfficiency;
        const errorPenalty = maxErrorRate > 0 ? (1 - parseFloat(p.errorRate) / maxErrorRate) : 1;
        
        const totalScore = (recordsScore * 0.4) + (memoryScore * 0.3) + (efficiencyScore * 0.2) + (errorPenalty * 0.1);
        
        return { ...result, score: totalScore };
    });
    
    const optimal = scored.reduce((best, current) => {
        return current.score > best.score ? current : best;
    });
    
    return optimal.batchSize;
}

/**
 * Generate batch size optimization report
 */
function generateBatchSizeReport(results) {
    console.log('\n📊 BATCH SIZE OPTIMIZATION REPORT');
    console.log('═'.repeat(60));
    
    const validResults = results.filter(r => !r.failed && r.performance);
    
    if (validResults.length === 0) {
        console.log('❌ No valid results to report');
        return;
    }
    
    console.log('\nPerformance by Batch Size:');
    console.log('Batch Size | Records/sec | Requests | Efficiency | Memory (MB) | Errors');
    console.log('-'.repeat(70));
    
    validResults
        .filter(r => r.dataSize === '100k') // Focus on 100k results
        .sort((a, b) => a.batchSize - b.batchSize)
        .forEach(result => {
            const p = result.performance;
            const m = result.memory;
            console.log(
                `${result.batchSize.toString().padStart(9)} | ` +
                `${p.recordsPerSecond.toString().padStart(10)} | ` +
                `${p.requests.toString().padStart(7)} | ` +
                `${p.efficiency.toString().padStart(9)}% | ` +
                `${m.peakHeapUsed.toString().padStart(10)} | ` +
                `${p.errorRate}%`
            );
        });
    
    // Analysis
    const smallBatch = validResults.filter(r => r.dataSize === '100k' && r.batchSize <= 50);
    const mediumBatch = validResults.filter(r => r.dataSize === '100k' && r.batchSize > 50 && r.batchSize <= 500);
    const largeBatch = validResults.filter(r => r.dataSize === '100k' && r.batchSize > 500);
    
    console.log('\n📈 BATCH SIZE ANALYSIS:');
    
    if (smallBatch.length > 0) {
        const avgSmall = smallBatch.reduce((sum, r) => sum + r.performance.recordsPerSecond, 0) / smallBatch.length;
        console.log(`   Small Batches (≤50): ${avgSmall.toFixed(0)} avg records/sec - Good for real-time processing`);
    }
    
    if (mediumBatch.length > 0) {
        const avgMedium = mediumBatch.reduce((sum, r) => sum + r.performance.recordsPerSecond, 0) / mediumBatch.length;
        console.log(`   Medium Batches (51-500): ${avgMedium.toFixed(0)} avg records/sec - Balanced performance`);
    }
    
    if (largeBatch.length > 0) {
        const avgLarge = largeBatch.reduce((sum, r) => sum + r.performance.recordsPerSecond, 0) / largeBatch.length;
        console.log(`   Large Batches (>500): ${avgLarge.toFixed(0)} avg records/sec - Maximum throughput`);
    }
    
    // Best performers
    const bestThroughput = validResults
        .filter(r => r.dataSize === '100k')
        .reduce((best, current) => 
            current.performance.recordsPerSecond > best.performance.recordsPerSecond ? current : best
        );
        
    const bestMemory = validResults
        .filter(r => r.dataSize === '100k')
        .reduce((best, current) => 
            current.memory.peakHeapUsed < best.memory.peakHeapUsed ? current : best
        );
        
    const bestEfficiency = validResults
        .filter(r => r.dataSize === '100k')
        .reduce((best, current) => 
            current.performance.efficiency > best.performance.efficiency ? current : best
        );
    
    console.log('\n🏆 RECOMMENDATIONS:');
    console.log(`   Highest Throughput: Batch size ${bestThroughput.batchSize} (${bestThroughput.performance.recordsPerSecond} records/sec)`);
    console.log(`   Most Memory Efficient: Batch size ${bestMemory.batchSize} (${bestMemory.memory.peakHeapUsed}MB peak)`);
    console.log(`   Best Batch Efficiency: Batch size ${bestEfficiency.batchSize} (${bestEfficiency.performance.efficiency}% fill)`);
    
    // Large dataset result
    const largeResult = validResults.find(r => r.dataSize === '1m');
    if (largeResult) {
        console.log(`\n📊 Large Dataset Performance (1M records):`);
        console.log(`   Batch Size: ${largeResult.batchSize}`);
        console.log(`   Throughput: ${largeResult.performance.recordsPerSecond} records/sec`);
        console.log(`   Total Requests: ${largeResult.performance.requests}`);
        console.log(`   Duration: ${largeResult.performance.durationSeconds}s`);
        console.log(`   Memory: ${largeResult.memory.peakHeapUsed}MB peak`);
    }
    
    console.log('\n💡 GUIDELINES:');
    console.log('   • Small batches (1-50): Use for real-time streaming or when API has strict rate limits');
    console.log('   • Medium batches (51-500): Best balance of performance and resource usage');
    console.log('   • Large batches (500+): Maximum throughput for bulk data processing');
    console.log('   • Consider API payload limits and timeout constraints when choosing batch size');
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
if (require.main === module) {
    runBatchSizeBenchmark().catch(console.error);
}

module.exports = { runBatchSizeBenchmark };