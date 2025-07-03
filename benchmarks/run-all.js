//@ts-nocheck
/**
 * Complete Mixpanel API Benchmark Suite Runner
 * 
 * Runs all benchmark tests against Mixpanel Import API and generates comprehensive report
 * for real-world analytics workload performance optimization.
 */

import { runConcurrencyBenchmark } from './concurrency-test.js';
import { runBatchSizeBenchmark } from './batch-size-test.js';
import { runMemoryBenchmark } from './memory-test.js';
import { runConnectionPoolingBenchmark } from './connection-pooling-test.js';
import { runThroughputBenchmark } from './throughput-optimization.js';
import { runErrorResilienceBenchmark } from './error-resilience-test.js';
import fs from 'fs';
import { performance } from 'perf_hooks';

/**
 * Run complete benchmark suite
 */
async function runCompleteBenchmarkSuite() {
    console.log('🚀 ak-fetch Complete Benchmark Suite');
    console.log('═'.repeat(50));
    console.log('Running comprehensive performance tests against Mixpanel API...\n');
    
    const startTime = performance.now();
    const results = {};
    
    try {
        // Run all benchmarks in sequence
        console.log('1️⃣  Running Concurrency Benchmark...');
        await runConcurrencyBenchmark();
        results.concurrency = 'completed';
        
        console.log('\n2️⃣  Running Batch Size Benchmark...');
        await runBatchSizeBenchmark();
        results.batchSize = 'completed';
        
        console.log('\n3️⃣  Running Memory Efficiency Benchmark...');
        await runMemoryBenchmark();
        results.memory = 'completed';
        
        console.log('\n4️⃣  Running Connection Pooling Benchmark...');
        await runConnectionPoolingBenchmark();
        results.connectionPooling = 'completed';
        
        console.log('\n5️⃣  Running Throughput Optimization Benchmark...');
        await runThroughputBenchmark();
        results.throughput = 'completed';
        
        console.log('\n6️⃣  Running Error Resilience Benchmark...');
        await runErrorResilienceBenchmark();
        results.errorResilience = 'completed';
        
        const endTime = performance.now();
        const totalDuration = (endTime - startTime) / 1000 / 60; // minutes
        
        console.log('\n🏁 BENCHMARK SUITE COMPLETED');
        console.log('═'.repeat(50));
        console.log(`⏱️  Total Duration: ${totalDuration.toFixed(2)} minutes`);
        console.log('📊 All benchmark categories completed successfully');
        
        // Generate comprehensive analysis report
        await generateComprehensiveReport();
        
        console.log('\n✅ Complete benchmark suite finished successfully!');
        console.log('📋 Check the ./benchmarks/results/ directory for detailed reports');
        
    } catch (error) {
        console.error('\n❌ Benchmark suite failed:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

/**
 * Generate comprehensive analysis report from all benchmark results
 */
async function generateComprehensiveReport() {
    console.log('\n📊 Generating comprehensive performance analysis...');
    
    const resultsDir = './benchmarks/results';
    if (!fs.existsSync(resultsDir)) {
        console.log('⚠️  No results directory found');
        return;
    }
    
    // Get all recent benchmark result files
    const files = fs.readdirSync(resultsDir)
        .filter(f => f.endsWith('.json') && !f.includes('comprehensive-report'))
        .map(f => ({
            name: f,
            path: `${resultsDir}/${f}`,
            mtime: fs.statSync(`${resultsDir}/${f}`).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 10); // Last 10 files
    
    console.log(`\nAnalyzing ${files.length} recent benchmark results...\n`);
    
    const reportSummary = {
        generatedAt: new Date().toISOString(),
        totalBenchmarks: files.length,
        categories: {},
        recommendations: []
    };
    
    // Analyze each category
    const categories = ['concurrency', 'batch-size', 'memory', 'connection-pooling', 'throughput-optimization', 'error-resilience'];
    
    categories.forEach(category => {
        const categoryFiles = files.filter(f => f.name.includes(category));
        
        if (categoryFiles.length > 0) {
            const latestFile = categoryFiles[0]; // Most recent
            try {
                const data = JSON.parse(fs.readFileSync(latestFile.path, 'utf8'));
                reportSummary.categories[category] = analyzeCategoryResults(category, data);
            } catch (error) {
                console.log(`⚠️  Could not analyze ${category} results: ${error.message}`);
            }
        }
    });
    
    // Generate specific recommendations
    generatePerformanceRecommendations(reportSummary);
    
    // Display summary
    displayReportSummary(reportSummary);
    
    // Save comprehensive report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `${resultsDir}/comprehensive-report-${timestamp}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(reportSummary, null, 2));
    
    console.log(`\n📋 Comprehensive report saved to: ${reportPath}`);
}

/**
 * Analyze results for a specific category
 */
function analyzeCategoryResults(category, data) {
    const analysis = {
        category,
        testCount: data.results ? data.results.length : 0,
        timestamp: data.timestamp,
        platform: data.platform,
        nodeVersion: data.nodeVersion
    };
    
    if (!data.results || data.results.length === 0) {
        return analysis;
    }
    
    const validResults = data.results.filter(r => !r.failed && r.performance);
    
    if (validResults.length === 0) {
        analysis.noValidResults = true;
        return analysis;
    }
    
    // Category-specific analysis
    switch (category) {
        case 'concurrency':
            analysis.optimalConcurrency = findOptimalValue(validResults, 'concurrency', 'recordsPerSecond');
            analysis.maxThroughput = Math.max(...validResults.map(r => r.performance.recordsPerSecond));
            break;
            
        case 'batch-size':
            analysis.optimalBatchSize = findOptimalValue(validResults, 'batchSize', 'recordsPerSecond');
            analysis.bestEfficiency = Math.max(...validResults.map(r => r.performance.efficiency || 0));
            break;
            
        case 'memory':
            analysis.mostMemoryEfficient = findOptimalValue(validResults, 'testName', 'memoryPerRecord', true);
            analysis.lowestPeakMemory = Math.min(...validResults.map(r => r.memory.peakHeapUsed));
            break;
            
        case 'connection-pooling':
            const withPooling = validResults.filter(r => r.connectionPooling);
            const withoutPooling = validResults.filter(r => !r.connectionPooling);
            
            if (withPooling.length > 0 && withoutPooling.length > 0) {
                const avgWithPooling = withPooling.reduce((sum, r) => sum + r.performance.recordsPerSecond, 0) / withPooling.length;
                const avgWithoutPooling = withoutPooling.reduce((sum, r) => sum + r.performance.recordsPerSecond, 0) / withoutPooling.length;
                
                analysis.poolingImprovement = ((avgWithPooling - avgWithoutPooling) / avgWithoutPooling * 100).toFixed(1);
            }
            break;
    }
    
    return analysis;
}

/**
 * Find optimal value for a given metric
 */
function findOptimalValue(results, keyField, metricField, minimize = false) {
    if (results.length === 0) return null;
    
    const optimal = results.reduce((best, current) => {
        const currentValue = getNestedValue(current, metricField);
        const bestValue = getNestedValue(best, metricField);
        
        if (minimize) {
            return currentValue < bestValue ? current : best;
        } else {
            return currentValue > bestValue ? current : best;
        }
    });
    
    return getNestedValue(optimal, keyField);
}

/**
 * Get nested object value by path
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

/**
 * Generate performance recommendations
 */
function generatePerformanceRecommendations(summary) {
    const recommendations = [];
    
    // Concurrency recommendations
    if (summary.categories.concurrency && summary.categories.concurrency.optimalConcurrency) {
        recommendations.push({
            category: 'Concurrency',
            recommendation: `Use concurrency level ${summary.categories.concurrency.optimalConcurrency} for optimal throughput`,
            impact: 'High',
            maxThroughput: summary.categories.concurrency.maxThroughput
        });
    }
    
    // Batch size recommendations
    if (summary.categories['batch-size'] && summary.categories['batch-size'].optimalBatchSize) {
        recommendations.push({
            category: 'Batch Size',
            recommendation: `Use batch size ${summary.categories['batch-size'].optimalBatchSize} for best balance of performance and efficiency`,
            impact: 'High',
            bestEfficiency: summary.categories['batch-size'].bestEfficiency
        });
    }
    
    // Memory recommendations
    if (summary.categories.memory && summary.categories.memory.mostMemoryEfficient) {
        recommendations.push({
            category: 'Memory',
            recommendation: `Use "${summary.categories.memory.mostMemoryEfficient}" configuration for memory-constrained environments`,
            impact: 'Medium',
            lowestPeakMemory: summary.categories.memory.lowestPeakMemory
        });
    }
    
    // Connection pooling recommendations
    if (summary.categories['connection-pooling'] && summary.categories['connection-pooling'].poolingImprovement) {
        recommendations.push({
            category: 'Connection Pooling',
            recommendation: `Always enable connection pooling for ${summary.categories['connection-pooling'].poolingImprovement}% performance improvement`,
            impact: 'High',
            improvement: summary.categories['connection-pooling'].poolingImprovement
        });
    }
    
    summary.recommendations = recommendations;
}

/**
 * Display report summary
 */
function displayReportSummary(summary) {
    console.log('🏆 PERFORMANCE OPTIMIZATION RECOMMENDATIONS:');
    console.log('-'.repeat(60));
    
    if (summary.recommendations.length === 0) {
        console.log('❌ No specific recommendations available from recent benchmarks');
        return;
    }
    
    summary.recommendations.forEach((rec, index) => {
        console.log(`\n${index + 1}. ${rec.category} (${rec.impact} Impact):`);
        console.log(`   ${rec.recommendation}`);
        
        if (rec.maxThroughput) {
            console.log(`   • Max throughput achieved: ${rec.maxThroughput} records/sec`);
        }
        if (rec.bestEfficiency) {
            console.log(`   • Best batch efficiency: ${rec.bestEfficiency}%`);
        }
        if (rec.lowestPeakMemory) {
            console.log(`   • Lowest peak memory: ${rec.lowestPeakMemory.toFixed(1)}MB`);
        }
        if (rec.improvement) {
            console.log(`   • Performance improvement: +${rec.improvement}%`);
        }
    });
    
    console.log('\n📋 OPTIMAL CONFIGURATION SUMMARY:');
    console.log('-'.repeat(40));
    
    const config = {};
    summary.recommendations.forEach(rec => {
        switch (rec.category) {
            case 'Concurrency':
                config.concurrency = summary.categories.concurrency.optimalConcurrency;
                break;
            case 'Batch Size':
                config.batchSize = summary.categories['batch-size'].optimalBatchSize;
                break;
            case 'Connection Pooling':
                config.enableConnectionPooling = true;
                config.keepAlive = true;
                break;
        }
    });
    
    console.log('```javascript');
    console.log('const optimalConfig = {');
    Object.entries(config).forEach(([key, value]) => {
        console.log(`  ${key}: ${JSON.stringify(value)},`);
    });
    console.log('  // Add memory optimizations for large datasets:');
    console.log('  storeResponses: false,');
    console.log('  maxResponseBuffer: 10,');
    console.log('  forceGC: true');
    console.log('};');
    console.log('```');
    
    console.log('\n💡 ADDITIONAL TIPS:');
    console.log('   • Run benchmarks in your specific environment for best results');
    console.log('   • Consider API rate limits when setting concurrency');
    console.log('   • Monitor memory usage in production with large datasets');
    console.log('   • Test with your actual data patterns and network conditions');
}

// Run complete suite if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    // Check for garbage collection availability
    if (typeof global.gc === 'undefined') {
        console.log('💡 Tip: Run with --expose-gc flag for more accurate memory measurements\n');
    }
    
    runCompleteBenchmarkSuite().catch(console.error);
}

export { runCompleteBenchmarkSuite };