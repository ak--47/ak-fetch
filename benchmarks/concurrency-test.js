/**
 * Concurrency Benchmark Test
 * 
 * Tests ak-fetch performance across different concurrency levels
 * to find optimal concurrent request settings for various scenarios.
 */

const akFetch = require('../index.js');
const { performance } = require('perf_hooks');
const fs = require('fs');
const { progress } = require('ak-tools');
const { Headers } = require('undici');

// Mock HTTP server endpoint for testing
const TEST_URL = 'https://api.mixpanel.com/import';

/**
 * Run benchmark with specific concurrency settings
 */
async function runConcurrencyTest(concurrency, dataSize = '100k') {
	const dataFile = `./testData/${dataSize}.ndjson`;
	const testName = `concurrency-${concurrency}-${dataSize}`;

	console.log(`\n🚀 Testing concurrency: ${concurrency} (${dataSize} dataset)`);

	const startTime = performance.now();
	const startMemory = process.memoryUsage();

	try {
		const result = await akFetch({
			url: TEST_URL,
			data: dataFile,
			concurrency: concurrency,
			batchSize: 2000,
			verbose: true,
			searchParams: {
				strict: 1
			},
			// progress: true,
            retries: 3,
			timeout: 30000,
			transform: (chunk) => {
				return chunk; // No transformation needed for this test
			},
			enableConnectionPooling: true,
			storeResponses: false, // Don't store responses to save memory
			maxResponseBuffer: 10,   // Minimal response buffer
			headers: {
				"Authorization": "Basic " + Buffer.from("612a8128b3e2e7c0c41e57d1715f49e7:").toString("base64")
			},
			storeResponses: true,
			// responseHandler: function (response) {
				
			// }
		});

		const endTime = performance.now();
		const endMemory = process.memoryUsage();
		const duration = endTime - startTime;

		const metrics = {
			testName,
			concurrency,
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
				errorRate: ((result.errors || 0) / result.reqCount * 100).toFixed(2)
			},
			memory: {
				peakHeapUsed: Math.round(Math.max(startMemory.heapUsed, endMemory.heapUsed) / 1024 / 1024),
				peakRSS: Math.round(Math.max(startMemory.rss, endMemory.rss) / 1024 / 1024),
				heapGrowth: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)
			}
		};

		console.log(`   ✅ Completed: ${metrics.performance.recordsPerSecond} records/sec, ${metrics.performance.rps} req/sec`);
		console.log(`   💾 Memory: ${metrics.memory.peakHeapUsed}MB peak, ${metrics.memory.heapGrowth}MB growth`);

		return metrics;

	} catch (error) {
		console.error(`   ❌ Failed: ${error.message}`);
		return {
			testName,
			concurrency,
			dataSize,
			timestamp: new Date().toISOString(),
			error: error.message,
			failed: true
		};
	}
}

/**
 * Run full concurrency benchmark suite
 */
async function runConcurrencyBenchmark() {
	console.log('🔥 ak-fetch Concurrency Benchmark\n');
	console.log('Testing different concurrency levels to find optimal settings...\n');

	const concurrencyLevels = [50];
	const results = [];

	// Test with 100k dataset
	console.log('📊 Testing with 100k dataset:');
	for (const concurrency of concurrencyLevels) {
		const result = await runConcurrencyTest(concurrency, '100k');
		results.push(result);

		// Brief pause between tests to stabilize system
		await new Promise(resolve => setTimeout(resolve, 2000));
	}

	// Test optimal concurrency with 1m dataset
	console.log('\n📊 Testing optimal concurrency with 1m dataset:');
	const optimalConcurrency = findOptimalConcurrency(results);
	console.log(`\nOptimal concurrency level: ${optimalConcurrency}`);

	const largeResult = await runConcurrencyTest(optimalConcurrency, '1m');
	results.push(largeResult);

	// Save results
	await saveResults('concurrency-benchmark', results);

	// Generate report
	generateConcurrencyReport(results);
}

/**
 * Find optimal concurrency level from results
 */
function findOptimalConcurrency(results) {
	const validResults = results.filter(r => !r.failed && r.performance);
	if (validResults.length === 0) return 10; // Default fallback

	// Find the concurrency level with highest records/second
	const optimal = validResults.reduce((best, current) => {
		return current.performance.recordsPerSecond > best.performance.recordsPerSecond ? current : best;
	});

	return optimal.concurrency;
}

/**
 * Generate concurrency performance report
 */
function generateConcurrencyReport(results) {
	console.log('\n📈 CONCURRENCY BENCHMARK REPORT');
	console.log('═'.repeat(50));

	const validResults = results.filter(r => !r.failed && r.performance);

	if (validResults.length === 0) {
		console.log('❌ No valid results to report');
		return;
	}

	console.log('\nPerformance by Concurrency Level:');
	console.log('Concurrency | Records/sec | Req/sec | Memory (MB) | Errors');
	console.log('-'.repeat(60));

	validResults
		.filter(r => r.dataSize === '100k') // Focus on 100k results for comparison
		.sort((a, b) => a.concurrency - b.concurrency)
		.forEach(result => {
			const p = result.performance;
			const m = result.memory;
			console.log(
				`${result.concurrency.toString().padStart(10)} | ` +
				`${p.recordsPerSecond.toString().padStart(10)} | ` +
				`${p.rps.toString().padStart(6)} | ` +
				`${m.peakHeapUsed.toString().padStart(10)} | ` +
				`${p.errorRate}%`
			);
		});

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

	console.log('\n🏆 RECOMMENDATIONS:');
	console.log(`   Highest Throughput: Concurrency ${bestThroughput.concurrency} (${bestThroughput.performance.recordsPerSecond} records/sec)`);
	console.log(`   Most Memory Efficient: Concurrency ${bestMemory.concurrency} (${bestMemory.memory.peakHeapUsed}MB peak)`);

	// Large dataset result
	const largeResult = validResults.find(r => r.dataSize === '1m');
	if (largeResult) {
		console.log(`\n📊 Large Dataset Performance (1M records):`);
		console.log(`   Concurrency: ${largeResult.concurrency}`);
		console.log(`   Throughput: ${largeResult.performance.recordsPerSecond} records/sec`);
		console.log(`   Duration: ${largeResult.performance.durationSeconds}s`);
		console.log(`   Memory: ${largeResult.memory.peakHeapUsed}MB peak`);
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
if (require.main === module) {
	runConcurrencyBenchmark().catch(console.error);
}

module.exports = { runConcurrencyBenchmark };