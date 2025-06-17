// @ts-nocheck
const main = require('./index.js');
const { execSync } = require("child_process");
const u = require('ak-tools');
const { Readable } = require('stream');
const path = require('path');
const TEMP_DIR = path.resolve('./logs');


/** @typedef {import('./index').BatchRequestConfig} Config */

// Mock fetch
const REQUEST_BIN = `https://eokmttd9crhj9g7.m.pipedream.net`;

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
		expect(e.message).toBe('POST request; No data provided');
	}
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
		headers: { "Content-Type": 'application/json', "Accept": 'application/json' },
	};
	const resultJson = await main(configJson);
	expect(resultJson.responses[0]).toBeDefined();
	const [response] = resultJson.responses;
	expect(response.success).toBe(true);

	fetch.mockImplementationOnce(() => mockFetchResponse({ success: true }));

	/** @type {Config} */
	const configForm = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		headers: { "Content-Type": 'application/x-www-form-urlencoded' },
	};
	const resultForm = await main(configForm);
	expect(resultForm.responses[0].includes('Success!')).toBe(true);
});

test('multiple configs', async () => {
	/** @type {Config[]} */
	const configs = [
		{
			url: REQUEST_BIN,
			data: [{ id: 1 }, { id: 2 }],
			batchSize: 0,
			noBatch: true,
		},
		{
			url: REQUEST_BIN,
			data: [{ id: 3 }, { id: 4 }],
			batchSize: 0,
			noBatch: true,
		},
	];

	const results = await main(configs);

	expect(Array.isArray(results)).toBe(true);
	expect(results.length).toBe(2);


});


test('many get requests', async () => {
	let counter = 0;
	/** @type {Config[]} */
	const configs = [
		{
			url: REQUEST_BIN + "?id=1",
			method: 'GET',
			noBatch: true,
			verbose: true,
			headers: {
				"Accept": 'application/json',
			},
			hook: function (currentData) {
				counter++;
				return currentData;
			}
		},
		{
			url: REQUEST_BIN + "?id=2",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},
		{
			url: REQUEST_BIN + "?id=3",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},
		{
			url: REQUEST_BIN + "?id=4",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},

	];

	const results = await main(configs);

	expect(Array.isArray(results)).toBe(true);
	expect(results.length).toBe(4);
	expect(counter).toBe(1);
	expect(results.every(r => r.success)).toBe(true);

});

test('many get requests save to file: json', async () => {
	let counter = 0;
	/** @type {Config[]} */
	const configs = [
		{
			url: REQUEST_BIN + "?id=1",
			method: 'GET',
			noBatch: true,
			verbose: true,
			logFile: TEMP_DIR + '/test.json',
			hook: function (currentData) {
				counter++;
				return currentData
			},
			headers: {
				"Accept": 'application/json',
			}
		},
		{
			url: REQUEST_BIN + "?id=2",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},
		{
			url: REQUEST_BIN + "?id=3",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},
		{
			url: REQUEST_BIN + "?id=4",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},

	];

	const results = await main(configs);

	expect(Array.isArray(results)).toBe(true);
	expect(results.length).toBe(4);
	expect(counter).toBe(1);
	expect(results.every(r => r.success)).toBe(true);

});

test('many get requests save to file: csv', async () => {
	let counter = 0;
	/** @type {Config[]} */
	const configs = [
		{
			url: REQUEST_BIN + "?id=1",
			method: 'GET',
			noBatch: true,
			verbose: true,
			format: 'csv',
			logFile: TEMP_DIR + '/test.csv',
			hook: function (currentData) {
				counter++;
				return currentData
			},
			responseHandler: function (response) {
				response.foo = "hello";
				response.bar = "world";
				return response;
			},
			headers: {
				"Accept": 'application/json',
			}
		},
		{
			url: REQUEST_BIN + "?id=2",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},
		{
			url: REQUEST_BIN + "?id=3",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},
		{
			url: REQUEST_BIN + "?id=4",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},

	];

	const results = await main(configs);

	expect(Array.isArray(results)).toBe(true);
	expect(results.length).toBe(4);
	expect(counter).toBe(1);
	expect(results.every(r => r.success)).toBe(true);

});


test('many get requests save to file: ndjson', async () => {
	let counter = 0;
	/** @type {Config[]} */
	const configs = [
		{
			url: REQUEST_BIN + "?id=1",
			method: 'GET',
			noBatch: true,
			verbose: true,
			format: 'ndjson',
			logFile: TEMP_DIR + '/test.ndjson',
			hook: function (currentData) {
				counter++;
				return currentData
			},
			responseHandler: function (response) {
				response.foo = "hello";
				response.bar = "world";
				return response;
			},
			headers: {
				"Accept": 'application/json',
			}
		},
		{
			url: REQUEST_BIN + "?id=2",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},
		{
			url: REQUEST_BIN + "?id=3",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},
		{
			url: REQUEST_BIN + "?id=4",
			method: 'GET',
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},

	];

	const results = await main(configs);

	expect(Array.isArray(results)).toBe(true);
	expect(results.length).toBe(4);
	expect(counter).toBe(1);
	expect(results.every(r => r.success)).toBe(true);

});

test('multiple configs with error', async () => {
	/** @type {Config[]} */
	const configs = [
		{
			url: REQUEST_BIN,
			data: [{ id: 1 }, { id: 2 }],
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
			
		},
		{
			url: "invalid-url", // This will cause an error
			data: [{ id: 3 }, { id: 4 }],
			noBatch: true,
			headers: {
				"Accept": 'application/json',
			}
		},
	];

	const results = await main(configs);

	expect(Array.isArray(results)).toBe(true);
	expect(results.length).toBe(2);



	// Check the results of the second config (should have an error)
	expect(results[0]).toHaveProperty('error');
	expect(results[1]).toHaveProperty('success');
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
	expect(result.responses.length).toBe(0);


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
	// const expected = [{}, {}, {}].map(a => { return { url: REQUEST_BIN, data: [{}], status: "fire and forget" }; });
	expect(result.responses).toEqual([]);
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
		` -d '[{"id":1,"name":"Test"}]'`;

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
	expect(result.startsWith(expected)).toBe(true);

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



test('transform mutates', async () => {
	const sampleData = [{ id: 1 }, { id: 2 }];

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: sampleData,
		transform: (record) => {
			record.transformed = true;
			return record;
		},
		batchSize: 1,
	};

	const result = await main(config);
	expect(sampleData.every(r => r.transformed)).toBe(true);
	result.responses.forEach(response => {
		expect(response).toHaveProperty('success', true);
	});
});

test('transform can clone', async () => {
	const sampleData = [{ id: 1 }, { id: 2 }];

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: sampleData,
		clone: true,
		transform: (record) => {
			record.transformed = true;
			return record;
		},
		batchSize: 1,
	};

	const result = await main(config);
	expect(sampleData.every(r => r.transformed)).toBe(false);
	result.responses.forEach(response => {
		expect(response).toHaveProperty('success', true);
	});
});

test('transform noop', async () => {
	const sampleData = [{ id: 1 }, { id: 2 }];
	const copy = [...sampleData];

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: sampleData,
		transform: (record) => record,  // No transformation
		batchSize: 1,
	};

	const result = await main(config);
	expect(sampleData).toEqual(copy);
	result.responses.forEach(response => {
		expect(response).toHaveProperty('success', true);
	});
});


test('transform non-object', async () => {
	const sampleData = [1, 2, 3];

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: sampleData,
		transform: (record) => record * 2,
		batchSize: 1,
	};

	const result = await main(config);

	result.responses.forEach(response => {
		expect(response).toHaveProperty('success', true);
	});
});



test('big data', async () => {
	fetch.mockResolvedValue({
		ok: true,
		json: () => Promise.resolve({ success: true }),
	});

	const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({ id: i }));

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: largeDataSet,
		batchSize: 100,
		concurrency: 1,
		maxTasks: 2,
		verbose: true,
	};

	const result = await main(config);
	expect(result.responses.length).toBe(10);
}, 60_000);


test('high concurrency', async () => {
	fetch.mockResolvedValue({
		ok: true,
		json: () => Promise.resolve({ success: true }),
	});

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: Array.from({ length: 100 }, (_, i) => ({ id: i })),
		concurrency: 50,
		batchSize: 10,
	};

	const result = await main(config);
	expect(result.responses.length).toBe(10);
});


test('application/json', async () => {
	fetch.mockResolvedValue({
		ok: true,
		json: () => Promise.resolve({ success: true }),
	});

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		headers: { "Content-Type": 'application/json' },
	};

	const result = await main(config);
	expect(result.responses[0]).toHaveProperty('success', true);
});

test('application/x-www-form-urlencoded', async () => {
	fetch.mockResolvedValue({
		ok: true,
		json: () => Promise.resolve({ success: true }),
	});

	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		headers: { "Content-Type": 'application/x-www-form-urlencoded' },
	};

	const result = await main(config);
	expect(result.responses[0]).toHaveProperty('success', true);
});


test('shell headers', async () => {
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		shell: { command: 'echo "token123"', header: 'Authorization', prefix: 'Bearer' },
		dryRun: true,
		batchSize: 1
	};

	const result = await main(config);
	expect(fetch).not.toHaveBeenCalled();
	expect(result.responses[0].headers).toEqual(expect.objectContaining({
		'Content-Type': 'application/json',
		'Authorization': 'Bearer token123'
	}));
});


test('include headers', async () => {
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		// data: [{ sampleData: 1 }],
		responseHeaders: true,
		noBatch: true,
		method: "GET"
	};
	const req = await main(config);
	const { headers, result, status } = req;
	expect(headers).toBeDefined();
	expect(result).toBeDefined();
	expect(status).toBeDefined();
	expect(status.status).toBe(200);
	expect(status.statusText).toBe("OK");

})


