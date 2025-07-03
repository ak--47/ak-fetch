//@ts-nocheck
/**
 * Dataset Helper for Benchmarks
 * 
 * Provides utilities for dataset selection and filtering based on environment variables
 */

/**
 * Get the appropriate dataset size based on environment variable or default
 */
function getDatasetSize() {
    const envSize = process.env.DATASET_SIZE;
    if (envSize && ['100k', '1m'].includes(envSize)) {
        return envSize;
    }
    return 'both'; // Default to testing both sizes
}

/**
 * Get dataset file path for specified size
 */
function getDatasetFile(size) {
    const validSizes = {
        '100k': './testData/100k.ndjson',
        '1m': './testData/1m.ndjson'
    };
    
    if (!validSizes[size]) {
        throw new Error(`Invalid dataset size: ${size}. Valid sizes: ${Object.keys(validSizes).join(', ')}`);
    }
    
    return validSizes[size];
}

/**
 * Filter test configurations based on dataset size environment variable
 */
function filterTestConfigs(configs) {
    const datasetSize = getDatasetSize();
    
    if (datasetSize === 'both') {
        return configs; // Return all configs
    }
    
    // Filter configs to only include the specified dataset size
    return configs.filter(config => {
        if (config.dataFile) {
            return config.dataFile.includes(`${datasetSize}.ndjson`);
        }
        return true; // Keep configs without dataFile
    });
}

/**
 * Get dataset-specific test name suffix
 */
function getDatasetSuffix() {
    const datasetSize = getDatasetSize();
    return datasetSize === 'both' ? '' : `-${datasetSize}`;
}

/**
 * Log dataset selection info
 */
function logDatasetInfo() {
    const datasetSize = getDatasetSize();
    
    if (datasetSize === 'both') {
        console.log('📊 Testing with both 100k and 1m datasets');
    } else {
        console.log(`📊 Testing with ${datasetSize} dataset only (DATASET_SIZE=${datasetSize})`);
    }
    
    console.log('💡 Tip: Set DATASET_SIZE=100k or DATASET_SIZE=1m to test specific dataset sizes\n');
}

export {
    getDatasetSize,
    getDatasetFile,
    filterTestConfigs,
    getDatasetSuffix,
    logDatasetInfo
};