/**
 * @file Preset Transform Unit Tests
 * @description Tests for vendor-specific data transformation presets
 */

const {
    getAvailablePresets,
    getPresetTransform,
    applyPresetTransform,
    PRESET_REGISTRY
} = require('../../lib/presets');

describe('Preset System', () => {
    describe('getAvailablePresets', () => {
        test('returns array of available preset names', () => {
            const presets = getAvailablePresets();
            expect(Array.isArray(presets)).toBe(true);
            expect(presets).toContain('mixpanel');
            expect(presets.length).toBeGreaterThan(0);
        });
    });

    describe('getPresetTransform', () => {
        test('returns transform function for valid preset', () => {
            const transform = getPresetTransform('mixpanel');
            expect(typeof transform).toBe('function');
        });

        test('throws error for invalid preset name', () => {
            expect(() => getPresetTransform('invalid-preset')).toThrow(
                /Invalid preset 'invalid-preset'/
            );
        });

        test('throws error for empty preset name', () => {
            expect(() => getPresetTransform('')).toThrow(
                'Preset name must be a non-empty string'
            );
        });

        test('throws error for null preset name', () => {
            expect(() => getPresetTransform(null)).toThrow(
                'Preset name must be a non-empty string'
            );
        });

        test('is case insensitive', () => {
            const transform1 = getPresetTransform('mixpanel');
            const transform2 = getPresetTransform('MIXPANEL');
            const transform3 = getPresetTransform('MixPanel');
            
            expect(transform1).toBe(transform2);
            expect(transform2).toBe(transform3);
        });
    });

    describe('applyPresetTransform', () => {
        test('applies transform successfully', () => {
            const testData = {
                event: 'test_event',
                user_id: 12345,
                time: '2024-01-01T00:00:00Z'
            };

            const result = applyPresetTransform(testData, 'mixpanel');
            expect(result).toBeDefined();
            expect(result.properties).toBeDefined();
        });

        test('calls error handler on transform error', () => {
            const errorHandler = jest.fn();
            const testData = null; // This should cause an error
            
            const result = applyPresetTransform(testData, 'mixpanel', errorHandler);
            expect(errorHandler).toHaveBeenCalled();
            expect(result).toBe(testData); // Should return original on error
        });

        test('throws error when no error handler provided', () => {
            const testData = null; // This should cause an error
            
            expect(() => applyPresetTransform(testData, 'mixpanel')).toThrow();
        });
    });
});

describe('Mixpanel Preset Transform', () => {
    let mixpanelTransform;

    beforeEach(() => {
        mixpanelTransform = getPresetTransform('mixpanel');
    });

    describe('Basic Structure Normalization', () => {
        test('creates properties object when missing', () => {
            const input = {
                event: 'test_event',
                user_id: 12345,
                timestamp: 1640995200000
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties).toBeDefined();
            expect(result.properties.$user_id).toBe('12345'); // Converted to string and prefixed
            expect(result.properties.time).toBe(1640995200000); // timestamp moved to time
            expect(result.properties.user_id).toBeUndefined(); // Original removed
            expect(result.properties.timestamp).toBeUndefined(); // Moved to time
            expect(result.event).toBe('test_event');
        });

        test('preserves existing properties object', () => {
            const input = {
                event: 'test_event',
                properties: {
                    user_id: 12345,
                    existing_prop: 'value'
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.existing_prop).toBe('value');
        });
    });

    describe('Time Normalization', () => {
        test('converts ISO string to Unix timestamp (ms)', () => {
            const input = {
                event: 'test_event',
                properties: {
                    time: '2024-01-01T00:00:00Z'
                }
            };

            const result = mixpanelTransform(input);
            
            expect(typeof result.properties.time).toBe('number');
            expect(result.properties.time).toBe(1704067200000); // 2024-01-01 in ms
        });

        test('preserves numeric timestamps', () => {
            const input = {
                event: 'test_event',
                properties: {
                    time: 1640995200000
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.time).toBe(1640995200000);
        });

        test('handles missing time property', () => {
            const input = {
                event: 'test_event',
                properties: {
                    user_id: 12345
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.time).toBeUndefined();
        });
    });

    describe('Insert ID Generation', () => {
        test('generates $insert_id when missing', () => {
            const input = {
                event: 'test_event',
                properties: {
                    distinct_id: 'user123',
                    time: 1640995200000
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.$insert_id).toBeDefined();
            expect(typeof result.properties.$insert_id).toBe('string');
        });

        test('preserves existing $insert_id', () => {
            const input = {
                event: 'test_event',
                properties: {
                    $insert_id: 'existing-id',
                    distinct_id: 'user123'
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.$insert_id).toBe('existing-id');
        });

        test('generates consistent $insert_id for same input', () => {
            const input = {
                event: 'test_event',
                properties: {
                    distinct_id: 'user123',
                    time: 1640995200000
                }
            };

            const result1 = mixpanelTransform(JSON.parse(JSON.stringify(input)));
            const result2 = mixpanelTransform(JSON.parse(JSON.stringify(input)));
            
            expect(result1.properties.$insert_id).toBe(result2.properties.$insert_id);
        });
    });

    describe('Property Key Transformations', () => {
        test('renames user_id to $user_id', () => {
            const input = {
                event: 'test_event',
                properties: {
                    user_id: 'user123'
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.$user_id).toBe('user123');
            expect(result.properties.user_id).toBeUndefined();
        });

        test('renames device_id to $device_id', () => {
            const input = {
                event: 'test_event',
                properties: {
                    device_id: 'device123'
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.$device_id).toBe('device123');
            expect(result.properties.device_id).toBeUndefined();
        });

        test('renames source to $source', () => {
            const input = {
                event: 'test_event',
                properties: {
                    source: 'mobile'
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.$source).toBe('mobile');
            expect(result.properties.source).toBeUndefined();
        });
    });

    describe('Special Property Promotion', () => {
        test('promotes email to $email', () => {
            const input = {
                event: 'test_event',
                properties: {
                    email: 'test@example.com'
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.$email).toBe('test@example.com');
            expect(result.properties.email).toBeUndefined();
        });

        test('promotes name to $name', () => {
            const input = {
                event: 'test_event',
                properties: {
                    name: 'John Doe'
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.$name).toBe('John Doe');
            expect(result.properties.name).toBeUndefined();
        });

        test('handles country special case', () => {
            const input = {
                event: 'test_event',
                properties: {
                    country: 'US'
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.mp_country_code).toBe('US');
            expect(result.properties.country).toBeUndefined();
        });
    });

    describe('String Conversion and Truncation', () => {
        test('converts user identifiers to strings', () => {
            const input = {
                event: 'test_event',
                properties: {
                    distinct_id: 12345,
                    $user_id: 67890,
                    $device_id: 11111
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.distinct_id).toBe('12345');
            expect(result.properties.$user_id).toBe('67890');
            expect(result.properties.$device_id).toBe('11111');
        });

        test('truncates long strings to 255 characters', () => {
            const longString = 'a'.repeat(300);
            const input = {
                event: 'test_event',
                properties: {
                    long_prop: longString
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.long_prop).toHaveLength(255);
            expect(result.properties.long_prop).toBe('a'.repeat(255));
        });

        test('preserves strings under 255 characters', () => {
            const normalString = 'a'.repeat(100);
            const input = {
                event: 'test_event',
                properties: {
                    normal_prop: normalString
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.normal_prop).toBe(normalString);
        });
    });

    describe('Complex Real-World Examples', () => {
        test('transforms typical event tracking data', () => {
            const input = {
                event: 'page_view',
                user_id: 12345,
                device_id: 'device-abc-123',
                timestamp: '2024-01-01T12:30:00Z',
                page_url: 'https://example.com/products',
                country: 'US',
                email: 'user@example.com',
                custom_property: 'custom_value'
            };

            const result = mixpanelTransform(input);
            
            // Check structure
            expect(result.event).toBe('page_view');
            expect(result.properties).toBeDefined();
            
            // Check transformed properties
            expect(result.properties.$user_id).toBe('12345');
            expect(result.properties.$device_id).toBe('device-abc-123');
            expect(result.properties.$email).toBe('user@example.com');
            expect(result.properties.mp_country_code).toBe('US');
            expect(result.properties.custom_property).toBe('custom_value');
            
            // Check time conversion (timestamp becomes time)
            expect(typeof result.properties.time).toBe('number');
            expect(result.properties.timestamp).toBeUndefined();
            
            // Check generated fields
            expect(result.properties.$insert_id).toBeDefined();
            
            // Check cleanup
            expect(result.properties.user_id).toBeUndefined();
            expect(result.properties.device_id).toBeUndefined();
            expect(result.properties.email).toBeUndefined();
            expect(result.properties.country).toBeUndefined();
        });

        test('handles edge cases gracefully', () => {
            const input = {
                event: 'edge_case_event',
                properties: {
                    null_value: null,
                    undefined_value: undefined,
                    empty_string: '',
                    zero_value: 0,
                    false_value: false
                }
            };

            const result = mixpanelTransform(input);
            
            expect(result.properties.null_value).toBeNull();
            expect(result.properties.undefined_value).toBeUndefined();
            expect(result.properties.empty_string).toBe('');
            expect(result.properties.zero_value).toBe(0);
            expect(result.properties.false_value).toBe(false);
        });
    });
});