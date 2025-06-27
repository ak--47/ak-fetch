/**
 * @fileoverview Preset transformations for popular APIs
 * These transforms run BEFORE user-defined transforms in the pipeline
 */

const murmurhash = require('murmurhash');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const stringify = require('json-stable-stringify');

dayjs.extend(utc);

const MAX_STR_LEN = 255;

/**
 * Truncate string to maximum length
 * @param {string} str 
 * @returns {string}
 */
function truncate(str) {
    return str.length > MAX_STR_LEN ? str.substring(0, MAX_STR_LEN) : str;
}

/**
 * Mixpanel event transformation
 * Converts generic JSON data to Mixpanel's expected event format
 * @param {any} record - Raw event data
 * @returns {Object} - Transformed Mixpanel event
 */
function mixpanelEventTransform(record) {
    // Valid Mixpanel operations for user profiles
    const validOperations = ["$set", "$set_once", "$add", "$union", "$append", "$remove", "$unset"];
    
    // Reserved profile properties that get special handling
    const specialProps = [
        "name", "first_name", "last_name", "email", "phone", "avatar", "created", 
        "insert_id", "city", "region", "lib_version", "os", "os_version", "browser", 
        "browser_version", "app_build_number", "app_version_string", "device", 
        "screen_height", "screen_width", "screen_dpi", "current_url", "initial_referrer", 
        "initial_referring_domain", "referrer", "referring_domain", "search_engine", 
        "manufacturer", "brand", "model", "watch_model", "carrier", "radio", "wifi", 
        "bluetooth_enabled", "bluetooth_version", "has_nfc", "has_telephone", 
        "google_play_services", "duration", "country", "country_code"
    ];
    
    // Properties that stay outside of $set
    const outsideProps = ["distinct_id", "group_id", "token", "group_key", "ip"];

    // 1. Fix "wrong shape": ensure record.properties exists
    if (!record.properties) {
        record.properties = { ...record };
        for (const key of Object.keys(record)) {
            if (key !== "properties" && key !== "event") {
                delete record[key];
            }
        }
    }

    // 2. Normalize time/timestamp to UNIX epoch (ms)
    // Handle both 'time' and 'timestamp' fields, prefer 'time'
    if (record.properties.timestamp && !record.properties.time) {
        record.properties.time = record.properties.timestamp;
        delete record.properties.timestamp;
    }
    
    if (record.properties.time && Number.isNaN(Number(record.properties.time))) {
        record.properties.time = dayjs.utc(record.properties.time).valueOf();
    }

    // 3. Add $insert_id if missing
    if (!record.properties.$insert_id) {
        try {
            const tuple = [
                record.event,
                record.properties.distinct_id || "",
                record.properties.time,
            ].join("-");
            record.properties.$insert_id = murmurhash.v3(tuple).toString();
        } catch {
            record.properties.$insert_id = String(record.properties.distinct_id);
        }
    }

    // 4. Handle distinct_id (required by Mixpanel)
    if (record.properties.user_id && !record.properties.distinct_id) {
        record.properties.distinct_id = record.properties.user_id;
    }
    
    // 5. Rename well-known keys to Mixpanel's $-prefixed versions
    ["user_id", "device_id", "source"].forEach((orig) => {
        if (record.properties[orig]) {
            record.properties[`$${orig}`] = record.properties[orig];
            delete record.properties[orig];
        }
    });

    // 6. Promote "special" props
    for (const key of Object.keys(record.properties)) {
        if (specialProps.includes(key)) {
            if (key === "country") {
                record.properties.mp_country_code = record.properties[key];
            } else {
                record.properties[`$${key}`] = record.properties[key];
            }
            delete record.properties[key];
        }
    }

    // 7. Ensure distinct_id, $user_id, $device_id are strings
    ["distinct_id", "$user_id", "$device_id"].forEach((k) => {
        if (record.properties[k] != null) {
            record.properties[k] = String(record.properties[k]);
        }
    });

    // 8. Truncate all string property values
    for (const [k, v] of Object.entries(record.properties)) {
        if (typeof v === "string") {
            record.properties[k] = truncate(v);
        }
    }

	delete record.properties.event; // Remove 'event' key if it exists

    return record;
}

/**
 * Registry of available presets
 */
const PRESET_REGISTRY = {
    'mixpanel': mixpanelEventTransform,
    // Future presets will be added here:
    // 'amplitude': amplitudeTransform,
    // 'pendo': pendoTransform,
};

/**
 * Get available preset names
 * @returns {string[]} Array of preset names
 */
function getAvailablePresets() {
    return Object.keys(PRESET_REGISTRY);
}

/**
 * Validate and get preset transform function
 * @param {string} presetName - Name of the preset
 * @returns {Function} Transform function
 * @throws {Error} If preset name is invalid
 */
function getPresetTransform(presetName) {
    if (!presetName || typeof presetName !== 'string') {
        throw new Error('Preset name must be a non-empty string');
    }
    
    const transform = PRESET_REGISTRY[presetName.toLowerCase()];
    if (!transform) {
        const available = getAvailablePresets().join(', ');
        throw new Error(`Invalid preset '${presetName}'. Available presets: ${available}`);
    }
    
    return transform;
}

/**
 * Apply preset transformation to a data record
 * @param {Object} record - Data record to transform
 * @param {string} presetName - Name of the preset to apply
 * @param {Function} [errorHandler] - Optional error handler function
 * @returns {Object} Transformed record
 */
function applyPresetTransform(record, presetName, errorHandler) {
    try {
        const transform = getPresetTransform(presetName);
        return transform(record);
    } catch (error) {
        if (errorHandler && typeof errorHandler === 'function') {
            errorHandler(error, record);
            return record; // Return original record if error handler doesn't throw
        }
        throw error;
    }
}

module.exports = {
    PRESET_REGISTRY,
    getAvailablePresets,
    getPresetTransform,
    applyPresetTransform
};