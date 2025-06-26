/**
 * Complete Benchmark Suite Runner
 * 
 * Runs all benchmark tests and generates comprehensive report
 */

const { runConcurrencyBenchmark } = require('./concurrency-test');
const { runBatchSizeBenchmark } = require('./batch-size-test');
const { runMemoryBenchmark } = require('./memory-test');
const { runConnectionPoolingBenchmark } = require('./connection-pooling-test');
const fs = require('fs');
const { performance } = require('perf_hooks');

/**
 * Run complete benchmark suite
 */
async function runCompleteBenchmarkSuite() {
    console.log('🎯 ak-fetch Complete Benchmark Suite');
    console.log('═'.repeat(50));
    console.log('Running comprehensive performance tests...\n');
    
    const startTime = performance.now();
    const results = {
        suiteStartTime: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        environment: {
            totalMemory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024), // GB
            cpuCores: require('os').cpus().length,
            nodeVersion: process.version,
            gcAvailable: typeof global.gc === 'function'
        },
        benchmarks: {}
    };
    
    try {
        // 1. Concurrency Benchmark
        console.log('🚀 1/4 Running Concurrency Benchmark...');
        console.log('-'.repeat(50));
        await runConcurrencyBenchmark();
        results.benchmarks.concurrency = 'completed';
        
        console.log('\n⏳ Cooling down before next benchmark...\n');
        await cooldown(5000);
        
        // 2. Batch Size Benchmark  
        console.log('📦 2/4 Running Batch Size Benchmark...');
        console.log('-'.repeat(50));
        await runBatchSizeBenchmark();
        results.benchmarks.batchSize = 'completed';
        
        console.log('\n⏳ Cooling down before next benchmark...\n');
        await cooldown(5000);
        
        // 3. Memory Efficiency Benchmark
        console.log('💾 3/4 Running Memory Efficiency Benchmark...');
        console.log('-'.repeat(50));
        await runMemoryBenchmark();
        results.benchmarks.memory = 'completed';
        
        console.log('\n⏳ Cooling down before next benchmark...\n');
        await cooldown(5000);
        
        // 4. Connection Pooling Benchmark
        console.log('🔌 4/4 Running Connection Pooling Benchmark...');
        console.log('-'.repeat(50));
        await runConnectionPoolingBenchmark();
        results.benchmarks.connectionPooling = 'completed';
        
    } catch (error) {
        console.error('❌ Benchmark suite failed:', error.message);
        results.error = error.message;
        results.failed = true;
    }
    
    const endTime = performance.now();
    results.suiteDuration = Math.round(endTime - startTime);
    results.suiteEndTime = new Date().toISOString();
    
    // Save suite results
    await saveSuiteResults(results);
    
    // Generate comprehensive report
    await generateComprehensiveReport();
    
    console.log('\n🎉 Benchmark Suite Complete!');
    console.log(`Total Duration: ${(results.suiteDuration / 1000 / 60).toFixed(1)} minutes`);
}

/**
 * Cooldown period between benchmarks
 */
async function cooldown(ms) {
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    
    await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Save complete suite results
 */
async function saveSuiteResults(results) {
    const resultsDir = './benchmarks/results';
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${resultsDir}/complete-suite-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\n💾 Suite results saved to: ${filename}`);
}

/**
 * Generate comprehensive performance report
 */
async function generateComprehensiveReport() {
    console.log('\n📊 COMPREHENSIVE PERFORMANCE REPORT');
    console.log('═'.repeat(60));
    
    const resultsDir = './benchmarks/results';
    if (!fs.existsSync(resultsDir)) {
        console.log('❌ No benchmark results found');
        return;
    }
    
    // Read all recent result files
    const files = fs.readdirSync(resultsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({ name: f, path: `${resultsDir}/${f}`, stats: fs.statSync(`${resultsDir}/${f}`) }))
        .sort((a, b) => b.stats.mtime - a.stats.mtime) // Most recent first
        .slice(0, 10); // Last 10 files
    
    console.log(`\nAnalyzing ${files.length} recent benchmark results...\n`);
    
    const reportSummary = {
        generatedAt: new Date().toISOString(),
        totalBenchmarks: files.length,
        categories: {},
        recommendations: []
    };
    
    // Analyze each category
    const categories = ['concurrency', 'batch-size', 'memory', 'connection-pooling'];
    
    categories.forEach(category => {\n        const categoryFiles = files.filter(f => f.name.includes(category));\n        \n        if (categoryFiles.length > 0) {\n            const latestFile = categoryFiles[0]; // Most recent\n            try {\n                const data = JSON.parse(fs.readFileSync(latestFile.path, 'utf8'));\n                reportSummary.categories[category] = analyzeCategoryResults(category, data);\n            } catch (error) {\n                console.log(`⚠️  Could not analyze ${category} results: ${error.message}`);\n            }\n        }\n    });\n    \n    // Generate specific recommendations\n    generatePerformanceRecommendations(reportSummary);\n    \n    // Display summary\n    displayReportSummary(reportSummary);\n    \n    // Save comprehensive report\n    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');\n    const reportPath = `${resultsDir}/comprehensive-report-${timestamp}.json`;\n    fs.writeFileSync(reportPath, JSON.stringify(reportSummary, null, 2));\n    \n    console.log(`\n📋 Comprehensive report saved to: ${reportPath}`);\n}\n\n/**\n * Analyze results for a specific category\n */\nfunction analyzeCategoryResults(category, data) {\n    const analysis = {\n        category,\n        testCount: data.results ? data.results.length : 0,\n        timestamp: data.timestamp,\n        platform: data.platform,\n        nodeVersion: data.nodeVersion\n    };\n    \n    if (!data.results || data.results.length === 0) {\n        return analysis;\n    }\n    \n    const validResults = data.results.filter(r => !r.failed && r.performance);\n    \n    if (validResults.length === 0) {\n        analysis.noValidResults = true;\n        return analysis;\n    }\n    \n    // Category-specific analysis\n    switch (category) {\n        case 'concurrency':\n            analysis.optimalConcurrency = findOptimalValue(validResults, 'concurrency', 'recordsPerSecond');\n            analysis.maxThroughput = Math.max(...validResults.map(r => r.performance.recordsPerSecond));\n            break;\n            \n        case 'batch-size':\n            analysis.optimalBatchSize = findOptimalValue(validResults, 'batchSize', 'recordsPerSecond');\n            analysis.bestEfficiency = Math.max(...validResults.map(r => r.performance.efficiency || 0));\n            break;\n            \n        case 'memory':\n            analysis.mostMemoryEfficient = findOptimalValue(validResults, 'testName', 'memoryPerRecord', true);\n            analysis.lowestPeakMemory = Math.min(...validResults.map(r => r.memory.peakHeapUsed));\n            break;\n            \n        case 'connection-pooling':\n            const withPooling = validResults.filter(r => r.connectionPooling);\n            const withoutPooling = validResults.filter(r => !r.connectionPooling);\n            \n            if (withPooling.length > 0 && withoutPooling.length > 0) {\n                const avgWithPooling = withPooling.reduce((sum, r) => sum + r.performance.recordsPerSecond, 0) / withPooling.length;\n                const avgWithoutPooling = withoutPooling.reduce((sum, r) => sum + r.performance.recordsPerSecond, 0) / withoutPooling.length;\n                \n                analysis.poolingImprovement = ((avgWithPooling - avgWithoutPooling) / avgWithoutPooling * 100).toFixed(1);\n            }\n            break;\n    }\n    \n    return analysis;\n}\n\n/**\n * Find optimal value for a given metric\n */\nfunction findOptimalValue(results, keyField, metricField, minimize = false) {\n    if (results.length === 0) return null;\n    \n    const optimal = results.reduce((best, current) => {\n        const currentValue = getNestedValue(current, metricField);\n        const bestValue = getNestedValue(best, metricField);\n        \n        if (minimize) {\n            return currentValue < bestValue ? current : best;\n        } else {\n            return currentValue > bestValue ? current : best;\n        }\n    });\n    \n    return getNestedValue(optimal, keyField);\n}\n\n/**\n * Get nested object value by path\n */\nfunction getNestedValue(obj, path) {\n    return path.split('.').reduce((current, key) => current && current[key], obj);\n}\n\n/**\n * Generate performance recommendations\n */\nfunction generatePerformanceRecommendations(summary) {\n    const recommendations = [];\n    \n    // Concurrency recommendations\n    if (summary.categories.concurrency && summary.categories.concurrency.optimalConcurrency) {\n        recommendations.push({\n            category: 'Concurrency',\n            recommendation: `Use concurrency level ${summary.categories.concurrency.optimalConcurrency} for optimal throughput`,\n            impact: 'High',\n            maxThroughput: summary.categories.concurrency.maxThroughput\n        });\n    }\n    \n    // Batch size recommendations\n    if (summary.categories['batch-size'] && summary.categories['batch-size'].optimalBatchSize) {\n        recommendations.push({\n            category: 'Batch Size',\n            recommendation: `Use batch size ${summary.categories['batch-size'].optimalBatchSize} for best balance of performance and efficiency`,\n            impact: 'High',\n            bestEfficiency: summary.categories['batch-size'].bestEfficiency\n        });\n    }\n    \n    // Memory recommendations\n    if (summary.categories.memory && summary.categories.memory.mostMemoryEfficient) {\n        recommendations.push({\n            category: 'Memory',\n            recommendation: `Use \"${summary.categories.memory.mostMemoryEfficient}\" configuration for memory-constrained environments`,\n            impact: 'Medium',\n            lowestPeakMemory: summary.categories.memory.lowestPeakMemory\n        });\n    }\n    \n    // Connection pooling recommendations\n    if (summary.categories['connection-pooling'] && summary.categories['connection-pooling'].poolingImprovement) {\n        recommendations.push({\n            category: 'Connection Pooling',\n            recommendation: `Always enable connection pooling for ${summary.categories['connection-pooling'].poolingImprovement}% performance improvement`,\n            impact: 'High',\n            improvement: summary.categories['connection-pooling'].poolingImprovement\n        });\n    }\n    \n    summary.recommendations = recommendations;\n}\n\n/**\n * Display report summary\n */\nfunction displayReportSummary(summary) {\n    console.log('🏆 PERFORMANCE OPTIMIZATION RECOMMENDATIONS:');\n    console.log('-'.repeat(60));\n    \n    if (summary.recommendations.length === 0) {\n        console.log('❌ No specific recommendations available from recent benchmarks');\n        return;\n    }\n    \n    summary.recommendations.forEach((rec, index) => {\n        console.log(`\\n${index + 1}. ${rec.category} (${rec.impact} Impact):`);\n        console.log(`   ${rec.recommendation}`);\n        \n        if (rec.maxThroughput) {\n            console.log(`   • Max throughput achieved: ${rec.maxThroughput} records/sec`);\n        }\n        if (rec.bestEfficiency) {\n            console.log(`   • Best batch efficiency: ${rec.bestEfficiency}%`);\n        }\n        if (rec.lowestPeakMemory) {\n            console.log(`   • Lowest peak memory: ${rec.lowestPeakMemory.toFixed(1)}MB`);\n        }\n        if (rec.improvement) {\n            console.log(`   • Performance improvement: +${rec.improvement}%`);\n        }\n    });\n    \n    console.log('\\n📋 OPTIMAL CONFIGURATION SUMMARY:');\n    console.log('-'.repeat(40));\n    \n    const config = {};\n    summary.recommendations.forEach(rec => {\n        switch (rec.category) {\n            case 'Concurrency':\n                config.concurrency = summary.categories.concurrency.optimalConcurrency;\n                break;\n            case 'Batch Size':\n                config.batchSize = summary.categories['batch-size'].optimalBatchSize;\n                break;\n            case 'Connection Pooling':\n                config.enableConnectionPooling = true;\n                config.keepAlive = true;\n                break;\n        }\n    });\n    \n    console.log('```javascript');\n    console.log('const optimalConfig = {');\n    Object.entries(config).forEach(([key, value]) => {\n        console.log(`  ${key}: ${JSON.stringify(value)},`);\n    });\n    console.log('  // Add memory optimizations for large datasets:');\n    console.log('  storeResponses: false,');\n    console.log('  maxResponseBuffer: 10,');\n    console.log('  forceGC: true');\n    console.log('};');\n    console.log('```');\n    \n    console.log('\\n💡 ADDITIONAL TIPS:');\n    console.log('   • Run benchmarks in your specific environment for best results');\n    console.log('   • Consider API rate limits when setting concurrency');\n    console.log('   • Monitor memory usage in production with large datasets');\n    console.log('   • Test with your actual data patterns and network conditions');\n}\n\n// Run complete suite if called directly\nif (require.main === module) {\n    // Check for garbage collection availability\n    if (typeof global.gc === 'undefined') {\n        console.log('💡 Tip: Run with --expose-gc flag for more accurate memory measurements\\n');\n    }\n    \n    runCompleteBenchmarkSuite().catch(console.error);\n}\n\nmodule.exports = { runCompleteBenchmarkSuite };