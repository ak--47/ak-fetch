// @ts-nocheck
import { vi } from 'vitest';
import main from '../../index.js';
import { execSync } from "child_process";
import u from 'ak-tools';
import { Readable } from 'stream';
import path from 'path';
const TEMP_DIR = path.resolve('./logs');
import { CookieJar } from 'tough-cookie';

/** @typedef {import('../../types.js').BatchRequestConfig} Config */
/** @typedef {import('../../types.js').Result} Result */

const REQUEST_BIN = `https://eokmttd9crhj9g7.m.pipedream.net`;

beforeAll(() => {
	// Timeout is handled in vitest.config.js
});

test('direct fetch', () => {
	// sanity check that global.fetch is available
	fetch('https://example.com');
});

test('throws: URL', async () => {
	await expect(main({ data: [{}] })).rejects.toThrow('No URL provided');
});

test('throws: DATA', async () => {
	await expect(main({ url: REQUEST_BIN })).rejects.toThrow('POST request requires data');
});

test('batches', async () => {
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{}, {}, {}],
		batchSize: 2
	};
	const result = await main(config);
	expect(result.responses.length).toBe(2);
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
	const { configCount, responses, reqCount, rowCount } = results;
	expect(configCount).toBe(2);
	expect(reqCount).toBe(2);
	expect(rowCount).toBe(2);
	expect(responses.length).toBe(2);

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
			headers: { "Accept": 'application/json' },
			hook(currentData) {
				counter++;
				return currentData;
			}
		},
		{
			url: REQUEST_BIN + "?id=2",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
		{
			url: REQUEST_BIN + "?id=3",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
		{
			url: REQUEST_BIN + "?id=4",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
	];

	const results = await main(configs);
	const { configCount, responses, reqCount, rowCount } = results;
	expect(configCount).toBe(4);
	expect(reqCount).toBe(4);
	expect(responses.length).toBe(4);
	
	
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
			hook(currentData) {
				counter++;
				return currentData;
			},
			headers: { "Accept": 'application/json' }
		},
		{
			url: REQUEST_BIN + "?id=2",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
		{
			url: REQUEST_BIN + "?id=3",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
		{
			url: REQUEST_BIN + "?id=4",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
	];

	const results = await main(configs);
	const { configCount, responses, reqCount, rowCount } = results;
	expect(configCount).toBe(4);
	expect(reqCount).toBe(4);
	expect(rowCount).toBe(4);
	expect(responses.length).toBe(4);

	
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
			hook(currentData) {
				counter++;
				return currentData;
			},
			responseHandler(response) {
				response.foo = "hello";
				response.bar = "world";
				return response;
			},
			headers: { "Accept": 'application/json' }
		},
		{
			url: REQUEST_BIN + "?id=2",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
		{
			url: REQUEST_BIN + "?id=3",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
		{
			url: REQUEST_BIN + "?id=4",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
	];

	const results = await main(configs);
	const { configCount, responses, reqCount, rowCount } = results;
	expect(configCount).toBe(4);
	expect(reqCount).toBe(4);
	expect(rowCount).toBe(4);
	expect(responses.length).toBe(4);
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
			hook(currentData) {
				counter++;
				return currentData;
			},
			responseHandler(response) {
				response.foo = "hello";
				response.bar = "world";
				return response;
			},
			headers: { "Accept": 'application/json' }
		},
		{
			url: REQUEST_BIN + "?id=2",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
		{
			url: REQUEST_BIN + "?id=3",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
		{
			url: REQUEST_BIN + "?id=4",
			method: 'GET',
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
	];

	const results = await main(configs);
	const { configCount, responses, reqCount, rowCount } = results;
	expect(configCount).toBe(4);
	expect(reqCount).toBe(4);
	expect(rowCount).toBe(4);
	expect(responses.length).toBe(4);
});

test('multiple configs with error', async () => {
	/** @type {Config[]} */
	const configs = [
		{
			url: REQUEST_BIN,
			data: [{ id: 1 }, { id: 2 }],
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
		{
			url: "invalid-url",
			data: [{ id: 3 }, { id: 4 }],
			noBatch: true,
			headers: { "Accept": 'application/json' }
		},
	];

	const results = await main(configs);
	const { configCount, responses, reqCount, rowCount } = results;
	expect(configCount).toBe(2);
	expect(reqCount).toBe(2);
	expect(rowCount).toBe(2);
	expect(responses.length).toBe(2);
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

	const expectedCurlCommand = `curl -X POST -H "Content-Type: application/json" -d '{"id":1,"name":"Test"}' "https://eokmttd9crhj9g7.m.pipedream.net"`

	const result = await main(config);
	expect(result.responses[0]).toBe(expectedCurlCommand);
});

const logPath = './logs/test.log';
const expected = expect.arrayContaining([
	expect.objectContaining({
		responses: expect.arrayContaining([
			expect.objectContaining({
				data: expect.objectContaining({ "success": true }),
				method: "GET",
				status: 200,
				statusText: "OK",
				url: expect.stringContaining(REQUEST_BIN)
			})
		])
	})
]);

test.skip('cli (JSON)', async () => {
	const testJson = './testData/testData.json';
	execSync(`node ./index.js ${testJson} --url ${REQUEST_BIN} --method GET --log_file ${logPath}`);
	const result = await u.load(logPath, true);
	expect(result).toEqual(expected);
});

test.skip('cli (JSONL)', async () => {
	const testJson = './testData/testData.jsonl';
	execSync(`node ./index.js ${testJson} --url ${REQUEST_BIN} --log_file ${logPath}`);
	const result = await u.load(logPath, true);
	expect(result).toEqual(expected);
});

test.skip('cli (pass data)', async () => {
	const testData = '[{"foo":"bar","baz":"qux","mux":"tux"}]';
	execSync(`node ./index.js --url ${REQUEST_BIN} --log_file ${logPath} --payload '${testData}'`);
	const result = await u.load(logPath, true);
	const expectedPost = expect.objectContaining({
		responses: expect.arrayContaining([
			expect.objectContaining({
				method: "POST",
				status: 200,
				statusText: "OK",
				url: REQUEST_BIN
			})
		])
	});
	expect(result).toEqual(expectedPost);
});

test.skip('shell cmd headers', async () => {
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
	const { headers } = result.responses[0];
	expect(headers).toEqual(expectedHeaders);
});

test.skip('get requests', async () => {
	/** @type {Config} */
	const config = { url: `https://aktunes.com/`, method: 'GET' };
	const result = await main(config);
	// it should return the raw HTML string
	expect(result.startsWith('<!DOCTYPE HTML>')).toBe(true);
});

test('streams (object)', async () => {
	const testData = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
	const inputStream = Readable.from(testData, { objectMode: true });
	/** @type {Config} */
	const config = { url: REQUEST_BIN, data: inputStream, batchSize: 2, retries: 0 };
	const result = await main(config);
	expect(result.responses.length).toBe(3);
});

test('streams (jsonl)', async () => {
	const testData = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
		.map(item => JSON.stringify(item))
		.join('\n') + '\n';
	const inputStream = Readable.from(testData, { objectMode: false });
	/** @type {Config} */
	const config = { url: REQUEST_BIN, data: inputStream, batchSize: 2, retries: 0 };
	const result = await main(config);
	expect(result.responses.length).toBe(3);
});

test.skip('streams (path)', async () => {
	const testData = './testData/testEvents.jsonl';
	/** @type {Config} */
	const config = {
		batchSize: 10,
		url: "https://api.mixpanel.com/import",
		concurrency: 3,
		headers: {
			"Content-Type": "application/json",
			'accept': 'application/json',
			'authorization': `Basic ${Buffer.from(`542871939159895ac55a18d3c90c198b:`).toString("base64")}`
		},
		verbose: false,
		retries: 3,
		retryOn: [429, 500, 502, 503, 504],
		searchParams: { verbose: 1 },
		data: testData,
	};

	const result = await main(config);
	expect(result.responses.length).toBe(10);
	expect(result.responses.every(r => r.status === 200)).toBe(true);
	expect(result.responses.every(r => r.data)).toBeDefined();
	expect(result.responses.every(r => r.method === "POST")).toBe(true);
	expect(result.responses.every(r => r.url)).toBeDefined();
});

test('transform mutates', async () => {
	const sampleData = [{ id: 1 }, { id: 2 }];
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: sampleData,
		transform(record) {
			record.transformed = true;
			return record;
		},
		batchSize: 1,
	};

	const result = await main(config);
	expect(sampleData.every(r => r.transformed)).toBe(true);
	result.responses.forEach(response => {
		expect(response.status).toBe(200);
	});
});

test('transform can clone', async () => {
	const sampleData = [{ id: 1 }, { id: 2 }];
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: sampleData,
		clone: true,
		transform(record) {
			record.transformed = true;
			return record;
		},
		batchSize: 1,
	};

	const result = await main(config);
	expect(sampleData.every(r => r.transformed)).toBe(false);
	result.responses.forEach(response => {
		expect(response.status).toBe(200);
	});
});

test('transform noop', async () => {
	const sampleData = [{ id: 1 }, { id: 2 }];
	const copy = [...sampleData];
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: sampleData,
		transform(record) { return record; },
		batchSize: 1,
	};

	const result = await main(config);
	expect(sampleData).toEqual(copy);
	result.responses.forEach(response => {
		expect(response.status).toBe(200);
	});
});

test('transform non-object', async () => {
	const sampleData = [1, 2, 3];
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: sampleData,
		transform(record) { return record * 2; },
		batchSize: 1,
	};

	const result = await main(config);
	result.responses.forEach(response => {
		expect(response.status).toBe(200);
	});
});

test.skip('big data', async () => {
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
}, 60000);

test('high concurrency', async () => {
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
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		headers: { "Content-Type": 'application/json' },
	};

	const result = await main(config);
	expect(result.responses[0].status).toBe(200);
});

test('application/x-www-form-urlencoded', async () => {
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		headers: { "Content-Type": 'application/x-www-form-urlencoded' },
	};

	const result = await main(config);
	expect(result.responses[0].status).toBe(200);
});

test.skip('shell headers', async () => {
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		data: [{ sampleData: 1 }],
		shell: { command: 'echo "token123"', header: 'Authorization', prefix: 'Bearer' },
		dryRun: true,
		batchSize: 1
	};

	const result = await main(config);
	const { headers } = result.responses[0];
	expect(headers).toEqual(
		expect.objectContaining({
			'Content-Type': 'application/json',
			'Authorization': 'Bearer token123'
		})
	);
});

test.skip('include headers', async () => {
	/** @type {Config} */
	const config = {
		url: REQUEST_BIN,
		responseHeaders: true,
		noBatch: true,
		method: "GET"
	};
	const req = await main(config);
	expect(req).toHaveProperty('headers');
	expect(req).toHaveProperty('result');
	expect(req).toHaveProperty('status');
	expect(req.status.status).toBe(200);
	expect(req.status.statusText).toBe("OK");
});
