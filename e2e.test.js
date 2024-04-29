// @ts-nocheck
const main = require('./index.js');
const { execSync } = require("child_process");
const u = require('ak-tools');
const { Readable } = require('stream');


/** @typedef {import('./index').BatchRequestConfig} Config */

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
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{}, {}, {}],
		retries: null,
		batchSize: 1
	};
	const result = await main(config);
	const expected = Array.from({ length: 3 }, () => ({ url: REQUEST_BIN, data: {}, status: "fire and forget" }));
	expect(result.responses).toEqual(expected);
});

test('batches', async () => {
	fetch.mockResolvedValueOnce({
		ok: true,
		json: () => Promise.resolve({ success: true }),
	});

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{}, {}, {}],
		batchSize: 2
	};
	const result = await main(config);
	expect(result.responses.length).toBe(2);
});


test('batches also', async () => {
	// Use the mockFetchResponse helper to set up expected responses
	fetch.mockImplementationOnce(() => mockFetchResponse({ success: true }));

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{}, {}, {}],
		batchSize: 2
	};
	const result = await main(config);
	expect(result.responses.length).toBe(2);
});

test('content types', async () => {
	fetch.mockImplementationOnce(() => mockFetchResponse({ success: true }));

	/** @type {Config} */
	const configJson = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		headers: { "Content-Type": 'application/json' },
	};
	const resultJson = await main(configJson);
	expect(resultJson.responses[0]).toHaveProperty('success', true);

	fetch.mockImplementationOnce(() => mockFetchResponse({ success: true }));

	/** @type {Config} */
	const configForm = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		headers: { "Content-Type": 'application/x-www-form-urlencoded' },
	};
	const resultForm = await main(configForm);
	expect(resultForm.responses[0]).toHaveProperty('success', true);
});

test('dry runs', async () => {
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }, { sampleData: 2 }],
		dryRun: true,
		batchSize: 1
	};
	const result = await main(config);
	expect(fetch).not.toHaveBeenCalled();
	expect(result.responses.length).toBe(2);
});

test('curl', async () => {
	const sampleData = [{ id: 1, name: 'Test' }];
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: sampleData,
		headers: { "Content-Type": 'application/json' },
		dryRun: "curl",
		batchSize: 1
	};

	const expectedCurlCommand = `curl -X POST "${REQUEST_BIN}" \\\n` +
		` -H "Content-Type: application/json" \\\n` +
		` -d '{"id":1,"name":"Test"}'`;

	const result = await main(config);
	expect(result.responses[0]).toBe(expectedCurlCommand);
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

test('shell cmd headers', async () => {
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		dryRun: true,
		shell: { command: 'echo "Hello World"', header: 'foo', prefix: 'bar' },
		batchSize: 1
	};

	const expectedHeaders = { 'Content-Type': 'application/json', 'foo': 'bar Hello World' };
	const result = await main(config);
	expect(fetch).not.toHaveBeenCalled();
	expect(result.responses.length).toBe(1);
	const { headers } = result.responses[0];
	expect(headers).toEqual(expectedHeaders);
});


test('get requests', async () => {
	/** @type {Config} */
	const config = {
		url: `https://aktunes.com/`,
		method: 'GET'
	};

	const result = await main(config);
	const expected = `<!DOCTYPE HTML>`;
	expect(result.responses[0].startsWith(expected)).toBe(true);

	// expect(fetch).toHaveBeenCalledTimes(1);
	// expect(result[0]).toHaveProperty('success', true);
});

test('streams (object)', async () => {
	const testData = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
	const inputStream = Readable.from(testData, { objectMode: true });

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: inputStream,
		batchSize: 2,
		retries: 0  // Ensure it fits the test scenario
	};


	const result = await main(config);
	expect(result.responses.length).toBe(3);


});

test('streams (jsonl)', async () => {
	const testData = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }].map(item => JSON.stringify(item)).join('\n') + '\n';
	const inputStream = Readable.from(testData, { objectMode: false });

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: inputStream,
		batchSize: 2,
		retries: 0  // Ensure it fits the test scenario
	};


	const result = await main(config);
	expect(result.responses.length).toBe(3);

});

test('streams (path)', async () => {
	const testData = './testData/testEvents.jsonl';

	/** @type {Config} */
	const config = {
		batchSize: 10,
		url: "https://api.mixpanel.com/import",
		concurrency: 3,
		headers: { "Content-Type": "application/json", 'accept': 'application/json', 'authorization': `Basic ${Buffer.from(`542871939159895ac55a18d3c90c198b:`).toString("base64")}` },
		verbose: false,
		retries: 3,
		retryOn: [429, 500, 502, 503, 504],
		searchParams: { verbose: 1 },
		data: testData,
	};


	const result = await main(config);
	expect(result.responses.length).toBe(10);
	expect(result.responses.every(r => r.code === 200)).toBe(true);
	expect(result.responses.every(r => r.error === null)).toBe(true);
	expect(result.responses.every(r => r.num_records_imported === 10)).toBe(true);
	expect(result.responses.every(r => r.status === 1)).toBe(true);

	// expect(result.responses.length).toBe(3);

});

