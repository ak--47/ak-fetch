#!/bin/bash

# ak-fetch Benchmark Demo Script
# 
# This script demonstrates how to run different benchmark configurations
# against the Mixpanel API with various dataset sizes.

echo "🎯 ak-fetch Benchmark Demo"
echo "=========================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env file with MIXPANEL_AUTH=\"Basic YourAuthHere\""
    exit 1
fi

echo "📊 Available benchmark commands:"
echo ""
echo "FULL BENCHMARK SUITES:"
echo "  npm run bench:100k           # All benchmarks with 100k dataset"
echo "  npm run bench:1m             # All benchmarks with 1m dataset"
echo ""
echo "INDIVIDUAL BENCHMARKS (default to 100k dataset):"
echo "  node benchmarks/batch-size-test.js          # Batch size optimization"
echo "  node benchmarks/concurrency-test.js         # Concurrency optimization"
echo "  node benchmarks/memory-test.js              # Memory efficiency"
echo "  node benchmarks/connection-pooling-test.js  # Connection pooling"
echo "  node benchmarks/throughput-optimization.js  # Throughput optimization"
echo "  node benchmarks/error-resilience-test.js    # Error resilience"
echo ""
echo "DATASET CONTROL:"
echo "  DATASET_SIZE=1m node benchmarks/batch-size-test.js  # Use 1m dataset"
echo ""
echo "💡 Tips:"
echo "  • Start with 100k dataset tests for development and tuning"
echo "  • Use 1m dataset tests for production validation"
echo "  • Individual benchmarks can be run directly with Node.js"
echo "  • All results are saved to benchmarks/results/ directory"
echo ""

# Ask user what they want to run
echo "What would you like to run? (or press Ctrl+C to exit)"
echo "1) Full benchmark suite with 100k dataset (recommended)"
echo "2) Full benchmark suite with 1m dataset"
echo "3) Batch size optimization only (100k)"
echo "4) Concurrency optimization only (100k)"
echo "5) Throughput optimization only (100k)"
read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo "📊 Running full benchmark suite with 100k dataset..."
        npm run bench:100k
        ;;
    2)
        echo "📊 Running full benchmark suite with 1m dataset..."
        echo "⚠️  Warning: This will take a while and use significant API quota"
        read -p "Are you sure? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            npm run bench:1m
        else
            echo "Cancelled."
        fi
        ;;
    3)
        echo "📦 Running batch size optimization with 100k dataset..."
        node benchmarks/batch-size-test.js
        ;;
    4)
        echo "🚀 Running concurrency optimization with 100k dataset..."
        node benchmarks/concurrency-test.js
        ;;
    5)
        echo "⚡ Running throughput optimization with 100k dataset..."
        node benchmarks/throughput-optimization.js
        ;;
    *)
        echo "Invalid choice. Please run one of the commands directly."
        ;;
esac

echo ""
echo "✅ Check benchmarks/results/ directory for detailed results!"
echo "💾 Results are saved with timestamps for comparison."