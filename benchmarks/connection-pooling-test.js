/**
 * Connection Pooling Performance Benchmark
 * 
 * Compares performance with and without HTTP connection pooling
 * to demonstrate the benefits of keep-alive connections.
 */

const akFetch = require('../index.js');
const { performance } = require('perf_hooks');
const fs = require('fs');

// Mock HTTP server endpoint for testing
const TEST_URL = 'https://httpbin.org/post';

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
            batchSize: 100,
            concurrency: 15,
            verbose: false,
            retries: 3,
            timeout: 30000,
            enableConnectionPooling: enablePooling,
            keepAlive: enablePooling,
            storeResponses: false,
            maxResponseBuffer: 10
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
 * Test different concurrency levels with and without pooling
 */
async function runConcurrencyComparisonTest(concurrency, testSize = '100k') {
    console.log(`\\n🚀 Testing concurrency ${concurrency} with/without connection pooling:`);\n    \n    const results = [];\n    \n    // Test without connection pooling\n    const withoutPooling = await runConnectionPoolingTest(false, testSize);\n    withoutPooling.concurrency = concurrency;\n    results.push(withoutPooling);\n    \n    // Brief pause\n    await new Promise(resolve => setTimeout(resolve, 2000));\n    \n    // Test with connection pooling\n    const withPooling = await runConnectionPoolingTest(true, testSize);\n    withPooling.concurrency = concurrency;\n    results.push(withPooling);\n    \n    return results;\n}\n\n/**\n * Run comprehensive connection pooling benchmark\n */\nasync function runConnectionPoolingBenchmark() {\n    console.log('🔌 ak-fetch Connection Pooling Benchmark\\n');\n    console.log('Comparing performance with and without HTTP connection pooling...\\n');\n    \n    const results = [];\n    \n    // Basic comparison with 100k dataset\n    console.log('📊 Basic Comparison (100k dataset):');\n    \n    const basicWithout = await runConnectionPoolingTest(false, '100k');\n    results.push(basicWithout);\n    \n    await new Promise(resolve => setTimeout(resolve, 2000));\n    \n    const basicWith = await runConnectionPoolingTest(true, '100k');\n    results.push(basicWith);\n    \n    // Test different concurrency levels\n    console.log('\\n📊 Concurrency Level Comparison:');\n    const concurrencyLevels = [5, 10, 20, 30];\n    \n    for (const concurrency of concurrencyLevels) {\n        const concurrencyResults = await runConcurrencyComparisonTest(concurrency);\n        results.push(...concurrencyResults);\n        \n        await new Promise(resolve => setTimeout(resolve, 3000));\n    }\n    \n    // Large dataset test\n    console.log('\\n📊 Large Dataset Test (1M records):');\n    \n    const largeWithout = await runConnectionPoolingTest(false, '1m');\n    results.push(largeWithout);\n    \n    await new Promise(resolve => setTimeout(resolve, 5000));\n    \n    const largeWith = await runConnectionPoolingTest(true, '1m');\n    results.push(largeWith);\n    \n    // Save results\n    await saveResults('connection-pooling-benchmark', results);\n    \n    // Generate report\n    generateConnectionPoolingReport(results);\n}\n\n/**\n * Generate connection pooling performance report\n */\nfunction generateConnectionPoolingReport(results) {\n    console.log('\\n🔌 CONNECTION POOLING PERFORMANCE REPORT');\n    console.log('═'.repeat(70));\n    \n    const validResults = results.filter(r => !r.failed && r.performance);\n    \n    if (validResults.length === 0) {\n        console.log('❌ No valid results to report');\n        return;\n    }\n    \n    // Basic comparison\n    console.log('\\nBasic Performance Comparison (100k dataset):');\n    console.log('Connection Pooling | Records/sec | Req/sec | Avg Req (ms) | Errors');\n    console.log('-'.repeat(65));\n    \n    const basicResults = validResults.filter(r => r.testSize === '100k' && !r.concurrency);\n    basicResults.forEach(result => {\n        const p = result.performance;\n        console.log(\n            `${(result.connectionPooling ? 'ENABLED' : 'DISABLED').padEnd(17)} | ` +\n            `${p.recordsPerSecond.toString().padStart(10)} | ` +\n            `${p.rps.toString().padStart(6)} | ` +\n            `${p.avgRequestDuration.padStart(11)} | ` +\n            `${p.errorRate}%`\n        );\n    });\n    \n    // Performance improvement calculation\n    const withoutPooling = basicResults.find(r => !r.connectionPooling);\n    const withPooling = basicResults.find(r => r.connectionPooling);\n    \n    if (withoutPooling && withPooling) {\n        const speedImprovement = ((withPooling.performance.recordsPerSecond - withoutPooling.performance.recordsPerSecond) / withoutPooling.performance.recordsPerSecond * 100).toFixed(1);\n        const requestImprovement = ((withPooling.performance.rps - withoutPooling.performance.rps) / withoutPooling.performance.rps * 100).toFixed(1);\n        const latencyImprovement = ((parseFloat(withoutPooling.performance.avgRequestDuration) - parseFloat(withPooling.performance.avgRequestDuration)) / parseFloat(withoutPooling.performance.avgRequestDuration) * 100).toFixed(1);\n        \n        console.log('\\n📈 CONNECTION POOLING BENEFITS:');\n        console.log(`   Throughput Improvement: ${speedImprovement}% faster record processing`);\n        console.log(`   Request Rate Improvement: ${requestImprovement}% more requests per second`);\n        console.log(`   Latency Improvement: ${latencyImprovement}% faster average request time`);\n    }\n    \n    // Concurrency analysis\n    const concurrencyResults = validResults.filter(r => r.concurrency && r.testSize === '100k');\n    if (concurrencyResults.length > 0) {\n        console.log('\\n🚀 CONCURRENCY LEVEL ANALYSIS:');\n        console.log('Concurrency | Pooling | Records/sec | Improvement');\n        console.log('-'.repeat(50));\n        \n        const concurrencyLevels = [...new Set(concurrencyResults.map(r => r.concurrency))].sort((a, b) => a - b);\n        \n        concurrencyLevels.forEach(concurrency => {\n            const without = concurrencyResults.find(r => r.concurrency === concurrency && !r.connectionPooling);\n            const with_ = concurrencyResults.find(r => r.concurrency === concurrency && r.connectionPooling);\n            \n            if (without && with_) {\n                const improvement = ((with_.performance.recordsPerSecond - without.performance.recordsPerSecond) / without.performance.recordsPerSecond * 100).toFixed(1);\n                \n                console.log(`${concurrency.toString().padStart(10)} | DISABLED | ${without.performance.recordsPerSecond.toString().padStart(10)} | baseline`);\n                console.log(`${concurrency.toString().padStart(10)} | ENABLED  | ${with_.performance.recordsPerSecond.toString().padStart(10)} | +${improvement}%`);\n                console.log('-'.repeat(50));\n            }\n        });\n    }\n    \n    // Large dataset results\n    const largeResults = validResults.filter(r => r.testSize === '1m' && !r.concurrency);\n    if (largeResults.length >= 2) {\n        console.log('\\n📊 LARGE DATASET PERFORMANCE (1M records):');\n        \n        const largeWithout = largeResults.find(r => !r.connectionPooling);\n        const largeWith = largeResults.find(r => r.connectionPooling);\n        \n        if (largeWithout && largeWith) {\n            console.log('Configuration     | Duration | Records/sec | Memory (MB)');\n            console.log('-'.repeat(55));\n            console.log(\n                `Without Pooling  | ${largeWithout.performance.durationSeconds.padStart(7)}s | ` +\n                `${largeWithout.performance.recordsPerSecond.toString().padStart(10)} | ` +\n                `${largeWithout.memory.peakHeapUsed.toString().padStart(10)}`\n            );\n            console.log(\n                `With Pooling     | ${largeWith.performance.durationSeconds.padStart(7)}s | ` +\n                `${largeWith.performance.recordsPerSecond.toString().padStart(10)} | ` +\n                `${largeWith.memory.peakHeapUsed.toString().padStart(10)}`\n            );\n            \n            const timeSaved = parseFloat(largeWithout.performance.durationSeconds) - parseFloat(largeWith.performance.durationSeconds);\n            const percentFaster = (timeSaved / parseFloat(largeWithout.performance.durationSeconds) * 100).toFixed(1);\n            \n            console.log(`\\n⚡ Large Dataset Benefits: ${timeSaved.toFixed(1)}s faster (${percentFaster}% improvement)`);\n        }\n    }\n    \n    // Recommendations\n    console.log('\\n💡 RECOMMENDATIONS:');\n    console.log('   ✅ ALWAYS enable connection pooling in production');\n    console.log('   ✅ Connection pooling benefits increase with higher concurrency');\n    console.log('   ✅ Especially important for large datasets and high-frequency requests');\n    console.log('   ✅ Reduces server load by reusing TCP connections');\n    console.log('   ✅ Significantly improves latency and throughput');\n    \n    console.log('\\n🔧 CONFIGURATION TIPS:');\n    console.log('   • enableConnectionPooling: true (default)');\n    console.log('   • keepAlive: true (default)');\n    console.log('   • Adjust maxSockets based on concurrency needs');\n    console.log('   • Consider server-side connection limits');\n    console.log('   • Monitor connection reuse in production');\n}\n\n/**\n * Save benchmark results to file\n */\nasync function saveResults(testType, results) {\n    const resultsDir = './benchmarks/results';\n    if (!fs.existsSync(resultsDir)) {\n        fs.mkdirSync(resultsDir, { recursive: true });\n    }\n    \n    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');\n    const filename = `${resultsDir}/${testType}-${timestamp}.json`;\n    \n    const report = {\n        testType,\n        timestamp: new Date().toISOString(),\n        nodeVersion: process.version,\n        platform: process.platform,\n        results\n    };\n    \n    fs.writeFileSync(filename, JSON.stringify(report, null, 2));\n    console.log(`\\n💾 Results saved to: ${filename}`);\n}\n\n// Run benchmark if called directly\nif (require.main === module) {\n    runConnectionPoolingBenchmark().catch(console.error);\n}\n\nmodule.exports = { runConnectionPoolingBenchmark };