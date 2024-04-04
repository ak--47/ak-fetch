// @ts-nocheck
const main = require('./index.js');
const { execSync } = require("child_process");
const u = require('ak-tools');

// Mock fetch
const REQUEST_BIN = `https://enp5ly7ky8t0c.x.pipedream.net/`;

// Mock global fetch
global.fetch = jest.fn();

beforeEach(() => {
	fetch.mockClear();
});

test('direct fetch', () => {
	fetch('https://example.com');
	expect(fetch).toHaveBeenCalledTimes(1);
});

test('throws: URL', async () => {
	expect.assertions(1);
	try {
		await main({ data: [{}] });
	} catch (e) {
		expect(e.message).toBe('No URL provided');
	}
});

test('throws: DATA', async () => {
	expect.assertions(1);
	try {
		await main({ url: REQUEST_BIN });
	} catch (e) {
		expect(e.message).toBe('No data provided');
	}
});

test('fire and forget', async () => {
	const config = {
		url: REQUEST_BIN,
		data: [{}, {}, {}],
		retries: null
	};
	const result = await main(config);
	expect(result).toEqual([null, null, null]);
});

test('batches', async () => {
	fetch.mockResolvedValueOnce({
		ok: true,
		json: () => Promise.resolve({ success: true }),
	});

	const config = {
		url: REQUEST_BIN,
		data: [{}, {}, {}],
		batchSize: 2
	};
	const result = await main(config);
	expect(result.length).toBe(2);
});


test('batches also', async () => {
	// Use the mockFetchResponse helper to set up expected responses
	fetch.mockImplementationOnce(() => mockFetchResponse({ success: true }));

	const config = {
		url: REQUEST_BIN,
		data: [{}, {}, {}],
		batchSize: 2
	};
	const result = await main(config);
	expect(result.length).toBe(2);
});

test('content types', async () => {
	fetch.mockImplementationOnce(() => mockFetchResponse({ success: true }));

	const configJson = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		headers: { "Content-Type": 'application/json' },
	};
	const resultJson = await main(configJson);
	expect(resultJson[0]).toHaveProperty('success', true);

	fetch.mockImplementationOnce(() => mockFetchResponse({ success: true }));

	const configForm = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		headers: { "Content-Type": 'application/x-www-form-urlencoded' },
	};
	const resultForm = await main(configForm);
	expect(resultForm[0]).toHaveProperty('success', true);
});

test('dry runs', async () => {
	const config = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }, { sampleData: 2 }],
		dryRun: true
	};
	const result = await main(config);
	expect(fetch).not.toHaveBeenCalled();
	expect(result.length).toBe(2);

});

test('curl', async () => {
	const sampleData = [{ id: 1, name: 'Test' }];
	const config = {
		url: REQUEST_BIN,
		data: sampleData,
		headers: { "Content-Type": 'application/json' },
		dryRun: "curl"
	};

	const expectedCurlCommand = `curl -X POST "${REQUEST_BIN}" \\\n` +
		` -H "Content-Type: application/json" \\\n` +
		` -d '{"id":1,"name":"Test"}'`;

	const result = await main(config);
	expect(result[0]).toBe(expectedCurlCommand);
});

const logPath = './logs/test.log';
const expected = [{ "success": true }, { "success": true }, { "success": true }];

test('cli (JSON)', async () => {
	const testJson = './testData/testData.json';

	const output = execSync(`node ./index.js ${testJson} --url ${REQUEST_BIN} --log_file ${logPath}`).toString().trim().split("\n").pop();

	const result = await u.load(logPath, true);
	expect(result).toEqual(expected);
});

test('cli (JSONL)', async () => {
	const testJson = './testData/testData.jsonl';

	const output = execSync(`node ./index.js ${testJson} --url ${REQUEST_BIN} --log_file ${logPath}`).toString().trim().split("\n").pop();


	const result = await u.load(logPath, true);
	expect(result).toEqual(expected);
});

test('cli (pass data)', async () => {
	const testData = '[{"foo": "bar", "baz": "qux", "mux" : "tux"}]';

	const output = execSync(`node ./index.js --url ${REQUEST_BIN} --log_file ${logPath} --payload '${testData}'`).toString().trim().split("\n").pop();

	const result = await u.load(logPath, true);
	expect(result).toEqual(expected);
});




// // Helper function to create a response body that can be read multiple times
// const createRepeatableResponseBody = (bodyContent) => {
//     return () => {
//         const bodyText = typeof bodyContent === 'string' ? bodyContent : JSON.stringify(bodyContent);
//         return Promise.resolve(bodyText);
//     };
// };

// // Customizable mock response setup
// const mockFetchResponse = (body, status = 200, headers = {}) => {
//     const repeatableBody = createRepeatableResponseBody(body);
//     return Promise.resolve({
//         ok: status >= 200 && status < 300,
//         status: status,
//         statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
//         text: repeatableBody,
//         json: () => Promise.resolve(body),
//         headers: {
//             entries: () => Object.entries(headers),
//         },
//     });
// };
// // Mock implementation
// fetch.mockImplementation((url, options) => {
// 	if (url.includes('/api/test-error')) {
// 		return mockFetchResponse('Error response', 500, { 'Content-Type': 'text/plain' });
// 	}

// 	// Default response mock
// 	return mockFetchResponse({ success: true }, 200, { 'Content-Type': 'application/json' });
// });
