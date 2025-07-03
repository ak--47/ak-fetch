#!/usr/bin/env node

/**
 * Small-scale benchmark using HTTPBin for basic functionality testing
 * Tests various configurations with smaller datasets to verify correctness
 */

import akFetch from '../index.js';

async function runSmallBenchmark() {
    console.log('🧪 Running HTTPBin Small-Scale Benchmark');
    console.log('=====================================\n');

    const baseUrl = 'https://httpbin.org/post';
    const testData = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        timestamp: new Date().toISOString(),
        data: `test-record-${i + 1}`
    }));

    const tests = [
        {
            name: 'Single Request',
            config: {
                url: baseUrl,
                data: [testData[0]],
                verbose: true
            }
        },
        {
            name: 'Small Batch (5 records)',
            config: {
                url: baseUrl,
                data: testData.slice(0, 5),
                batchSize: 2,
                verbose: true
            }
        },
        {
            name: 'Fire-and-Forget Mode',
            config: {
                url: baseUrl,
                data: testData.slice(0, 3),
                retries: null,
                verbose: true
            }
        },
        {
            name: 'With Connection Pooling',
            config: {
                url: baseUrl,
                data: testData.slice(0, 5),
                enableConnectionPooling: true,
                keepAlive: true,
                concurrency: 2,
                verbose: true
            }
        },
        {
            name: 'Different HTTP Method',
            config: {
                url: 'https://httpbin.org/patch',
                method: 'PATCH',
                data: testData.slice(0, 3),
                verbose: true
            }
        }
    ];

    for (const test of tests) {
        console.log(`\n📊 Testing: ${test.name}`);
        console.log('─'.repeat(40));
        
        try {
            const startTime = Date.now();
            const result = await akFetch(test.config);
            const duration = Date.now() - startTime;
            
            console.log(`✅ Success in ${duration}ms`);
            console.log(`   Requests: ${result.reqCount || 'N/A'}`);
            console.log(`   Responses: ${result.responses ? result.responses.length : 'N/A'}`);
            console.log(`   Errors: ${result.errors || 0}`);
            
            if (result.rps) {
                console.log(`   RPS: ${result.rps}`);
            }
            
        } catch (error) {
            console.log(`❌ Failed: ${error.message}`);
        }
    }

    console.log('\n🎯 Multiple Configurations Test');
    console.log('─'.repeat(40));
    
    try {
        const multiConfigs = [
            {
                url: baseUrl,
                data: testData.slice(0, 2),
                retries: null
            },
            {
                url: 'https://httpbin.org/patch',
                method: 'PATCH',
                data: testData.slice(2, 4),
                concurrency: 1
            }
        ];

        const startTime = Date.now();
        const result = await akFetch(multiConfigs);
        const duration = Date.now() - startTime;
        
        console.log(`✅ Multi-config success in ${duration}ms`);
        console.log(`   Total configs: ${result.configCount || multiConfigs.length}`);
        console.log(`   Results: ${Array.isArray(result.responses) ? result.responses.length : 'N/A'}`);
        
    } catch (error) {
        console.log(`❌ Multi-config failed: ${error.message}`);
    }

    console.log('\n🏁 Benchmark Complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runSmallBenchmark().catch(console.error);
}

export default runSmallBenchmark;