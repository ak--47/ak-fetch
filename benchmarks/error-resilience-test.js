//@ts-nocheck
/**
 * Error Handling & Resilience Benchmark
 * 
 * Tests ak-fetch error handling, retry mechanisms, and resilience against
 * various failure scenarios with Mixpanel API to ensure robust data delivery.
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
 * Run error resilience test
 */
async function runResilienceTest(config, testName) {
    console.log(`\n🛡️ Testing resilience: ${testName}`);
    
    const startTime = performance.now();
    
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
            verbose: false
        });
        
        const endTime = performance.now();
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
                errors: result.errors || 0,
                errorRate: ((result.errors || 0) / result.reqCount * 100).toFixed(2),
                successRate: (100 - ((result.errors || 0) / result.reqCount * 100)).toFixed(2),
                completionRate: (result.rowCount / (config.expectedRecords || result.rowCount) * 100).toFixed(2)
            },
            resilience: {
                retryEffectiveness: config.options.retries > 0 ? 
                    ((result.reqCount - (result.errors || 0)) / result.reqCount * 100).toFixed(2) : 'N/A',
                errorRecovery: result.errors > 0 ? 
                    ((result.rowCount / (config.expectedRecords || result.rowCount)) * 100).toFixed(2) : '100.00',
                timeoutHandling: duration < (config.options.timeout || 60000) ? 'Passed' : 'Failed'
            }
        };
        
        console.log(`   ✅ Completed: ${metrics.performance.successRate}% success, ${metrics.performance.errorRate}% errors`);
        console.log(`   🛡️ Resilience: ${metrics.resilience.errorRecovery}% data recovery, ${metrics.resilience.retryEffectiveness}% retry success`);
        
        return metrics;
        
    } catch (error) {
        console.error(`   ❌ Failed completely: ${error.message}`);
        return {
            testName,
            config: config.options,
            timestamp: new Date().toISOString(),
            error: error.message,
            failed: true,
            catastrophicFailure: true
        };
    }
}

/**
 * Run comprehensive error resilience benchmark
 */
async function runErrorResilienceBenchmark() {
    console.log('🛡️ ak-fetch Error Handling & Resilience Benchmark\n');
    console.log('Testing error handling and recovery mechanisms against Mixpanel API...\n');
    
    const testConfigs = [
        {
            name: 'Standard Retry Policy',
            dataFile: './testData/100k.ndjson',
            expectedRecords: 100000,
            options: {
                batchSize: 2000,
                concurrency: 15,
                retries: 3,
                retryDelay: 1000,
                timeout: 60000,
                enableConnectionPooling: true,
                storeResponses: false
            }
        },
        {
            name: 'Aggressive Retry Policy',
            dataFile: './testData/100k.ndjson',
            expectedRecords: 100000,
            options: {
                batchSize: 1000,
                concurrency: 10,
                retries: 5,
                retryDelay: 2000,
                timeout: 120000,
                enableConnectionPooling: true,
                storeResponses: false,
                useStaticRetryDelay: false // Use exponential backoff
            }
        },
        {
            name: 'Conservative Retry Policy',
            dataFile: './testData/100k.ndjson',
            expectedRecords: 100000,
            options: {
                batchSize: 500,
                concurrency: 5,
                retries: 2,
                retryDelay: 3000,
                timeout: 90000,
                enableConnectionPooling: true,
                storeResponses: false,
                useStaticRetryDelay: true
            }
        },
        {
            name: 'Fire and Forget Mode',
            dataFile: './testData/100k.ndjson',
            expectedRecords: 100000,
            options: {
                batchSize: 3000,
                concurrency: 25,
                retries: null, // Fire and forget
                timeout: 30000,
                enableConnectionPooling: true,
                storeResponses: false
            }
        },
        {
            name: 'High Timeout Tolerance',
            dataFile: './testData/100k.ndjson',
            expectedRecords: 100000,
            options: {
                batchSize: 2000,
                concurrency: 20,
                retries: 4,
                retryDelay: 1500,
                timeout: 180000, // 3 minutes
                enableConnectionPooling: true,
                storeResponses: false
            }
        },
        {
            name: 'Large Dataset Resilience',
            dataFile: './testData/1m.ndjson',
            expectedRecords: 1000000,
            options: {
                batchSize: 2500,
                concurrency: 15,
                retries: 3,
                retryDelay: 2000,
                timeout: 120000,
                enableConnectionPooling: true,
                storeResponses: false,
                maxMemoryUsage: 512 * 1024 * 1024, // 512MB limit
                forceGC: true
            }
        }
    ];
    
    const results = [];
    
    // Run resilience tests
    for (const config of testConfigs) {
        const result = await runResilienceTest(config, config.name);
        results.push(result);
        
        // Brief pause between tests
        console.log('   ⏳ Stabilizing...');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Save results
    await saveResults('error-resilience', results);
    
    // Generate report
    generateResilienceReport(results);
}

/**
 * Generate error resilience report
 */
function generateResilienceReport(results) {
    console.log('\n🛡️ ERROR RESILIENCE REPORT');
    console.log('═'.repeat(60));
    
    const validResults = results.filter(r => !r.failed && r.performance);
    const failedResults = results.filter(r => r.failed);
    
    if (validResults.length === 0 && failedResults.length === 0) {
        console.log('❌ No results to analyze');
        return;
    }
    
    console.log('\nResilience Performance Summary:');
    console.log('Configuration         | Success% | Errors% | Recovery% | Retry Eff% | Duration');
    console.log('-'.repeat(80));
    
    validResults.forEach(result => {
        const p = result.performance;
        const r = result.resilience;
        console.log(
            `${result.testName.padEnd(21)} | ` +
            `${p.successRate.toString().padStart(7)}% | ` +
            `${p.errorRate.toString().padStart(6)}% | ` +
            `${r.errorRecovery.toString().padStart(8)}% | ` +
            `${r.retryEffectiveness.toString().padStart(9)} | ` +
            `${p.durationSeconds}s`
        );
    });
    
    if (failedResults.length > 0) {
        console.log('\n💥 CATASTROPHIC FAILURES:');
        failedResults.forEach(result => {
            console.log(`   ❌ ${result.testName}: ${result.error}`);
        });
    }
    
    // Analysis
    if (validResults.length > 0) {
        const avgSuccessRate = validResults.reduce((sum, r) => sum + parseFloat(r.performance.successRate), 0) / validResults.length;
        const avgErrorRate = validResults.reduce((sum, r) => sum + parseFloat(r.performance.errorRate), 0) / validResults.length;
        const avgRecoveryRate = validResults.reduce((sum, r) => sum + parseFloat(r.resilience.errorRecovery), 0) / validResults.length;
        
        console.log('\n📊 RESILIENCE ANALYSIS:');
        console.log(`   Average Success Rate: ${avgSuccessRate.toFixed(2)}%`);
        console.log(`   Average Error Rate: ${avgErrorRate.toFixed(2)}%`);
        console.log(`   Average Data Recovery: ${avgRecoveryRate.toFixed(2)}%`);
        
        // Best performers
        const mostReliable = validResults.reduce((best, current) =>
            parseFloat(current.performance.successRate) > parseFloat(best.performance.successRate) ? current : best
        );
        
        const bestRecovery = validResults.reduce((best, current) =>
            parseFloat(current.resilience.errorRecovery) > parseFloat(best.resilience.errorRecovery) ? current : best
        );
        
        console.log('\n🏆 RESILIENCE CHAMPIONS:');
        console.log(`   Most Reliable: ${mostReliable.testName} (${mostReliable.performance.successRate}% success)`);
        console.log(`   Best Error Recovery: ${bestRecovery.testName} (${bestRecovery.resilience.errorRecovery}% data recovery)`);
        
        // Retry strategy analysis
        const retryConfigs = validResults.filter(r => r.config.retries !== null);
        const fireForgetConfigs = validResults.filter(r => r.config.retries === null);
        
        if (retryConfigs.length > 0) {
            const avgRetrySuccess = retryConfigs.reduce((sum, r) => sum + parseFloat(r.performance.successRate), 0) / retryConfigs.length;
            console.log(`\n🔄 RETRY STRATEGY ANALYSIS:`);
            console.log(`   Average Success with Retries: ${avgRetrySuccess.toFixed(2)}%`);
            
            if (fireForgetConfigs.length > 0) {
                const avgFireForgetSuccess = fireForgetConfigs.reduce((sum, r) => sum + parseFloat(r.performance.successRate), 0) / fireForgetConfigs.length;
                console.log(`   Average Success Fire-and-Forget: ${avgFireForgetSuccess.toFixed(2)}%`);
                console.log(`   Retry Benefit: +${(avgRetrySuccess - avgFireForgetSuccess).toFixed(2)}% success rate`);
            }
        }
        
        // Large dataset analysis
        const largeResult = validResults.find(r => r.testName.includes('Large Dataset'));
        if (largeResult) {
            console.log(`\n📊 Large Dataset Resilience (1M events):`);
            console.log(`   Success Rate: ${largeResult.performance.successRate}%`);
            console.log(`   Error Recovery: ${largeResult.resilience.errorRecovery}%`);
            console.log(`   Processing Time: ${largeResult.performance.durationSeconds}s`);
            console.log(`   Events Processed: ${largeResult.performance.records.toLocaleString()}`);
        }
    }
    
    console.log('\n💡 RESILIENCE RECOMMENDATIONS:');
    console.log('   • Use retries with exponential backoff for better error recovery');
    console.log('   • Set appropriate timeouts based on your network conditions');
    console.log('   • Lower concurrency often improves reliability');
    console.log('   • Monitor error rates and adjust batch sizes accordingly');
    console.log('   • Consider fire-and-forget for maximum throughput with acceptable data loss');
    console.log('   • Implement circuit breaker patterns for production systems');
    console.log('   • Use connection pooling to reduce connection-related errors');
    
    // Generate optimal resilient configuration
    if (validResults.length > 0) {
        const optimalResilience = validResults.reduce((best, current) => {
            const bestScore = parseFloat(best.performance.successRate) * parseFloat(best.resilience.errorRecovery) / 100;
            const currentScore = parseFloat(current.performance.successRate) * parseFloat(current.resilience.errorRecovery) / 100;
            return currentScore > bestScore ? current : best;
        });
        
        console.log('\n🎯 RECOMMENDED RESILIENT CONFIGURATION:');
        console.log('```javascript');
        console.log('const resilientConfig = {');
        Object.entries(optimalResilience.config).forEach(([key, value]) => {
            console.log(`  ${key}: ${JSON.stringify(value)},`);
        });
        console.log('};');
        console.log('```');
        console.log(`Expected Reliability: ${optimalResilience.performance.successRate}% success rate`);
    }
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
    runErrorResilienceBenchmark().catch(console.error);
}

export { runErrorResilienceBenchmark };