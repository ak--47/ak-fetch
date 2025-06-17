# ak-fetch Benchmarks

Performance benchmarks for testing ak-fetch across different scenarios and configurations.

## Benchmark Suite Overview

This folder contains performance tests designed to measure ak-fetch performance across different scenarios:

- **Concurrency Tests**: Measure performance with different concurrency levels
- **Batch Size Tests**: Optimize batch size for different data volumes
- **Memory Tests**: Test memory efficiency with large datasets
- **Connection Pooling**: Compare performance with/without connection pooling
- **Real-world Scenarios**: Tests based on actual API usage patterns

## Test Data

- `../testData/100k.ndjson` - 100,000 event records (~15MB)
- `../testData/1m.ndjson` - 1,000,000 event records (~150MB)

## Running Benchmarks

### Individual Benchmarks

```bash
# Concurrency benchmark
node benchmarks/concurrency-test.js

# Batch size optimization
node benchmarks/batch-size-test.js

# Memory efficiency test
node benchmarks/memory-test.js

# Connection pooling comparison
node benchmarks/connection-pooling-test.js

# Full benchmark suite
node benchmarks/run-all.js
```

### Benchmark Results

Results are saved to `benchmarks/results/` with timestamps for comparison over time.

## Metrics Measured

- **Throughput**: Requests per second (RPS)
- **Records per second**: Data records processed per second
- **Memory usage**: Peak memory consumption
- **Duration**: Total processing time
- **Error rates**: Failed request percentages
- **CPU usage**: Processor utilization

## Test Environment

Benchmarks should be run in a consistent environment for reliable comparisons:

- Stable network connection
- Minimal background processes
- Consistent hardware configuration
- Multiple runs for statistical significance