const RunQueue = require("run-queue");
const u = require("ak-tools");
const readline = require('readline');
const querystring = require('querystring');
// @ts-ignore
const fetch = require("fetch-retry")(global.fetch);
require('dotenv').config({ debug: true, override: false });

/**
 * @typedef {Object} BatchRequestConfig
 * @property {string} url - The URL of the API endpoint.
 * @property {Object[]} data - An array of data objects to be sent in the requests.
 * @property {number} batchSize - The number of records to be sent in each batch. Use batch = 0 to not batch.
 * @property {number} concurrency - The level of concurrency for the requests.
 * @property {number} delay - The delay between requests.
 * @property {Object|null} searchParams - An object representing the search parameters to be appended to the URL.
 * @property {Object|null} bodyParams - An object representing the body parameters to be sent in the request.
 * @property {Object} headers - An object representing the headers to be sent in the request.
 * @property {boolean} [verbose] - Log progress of the requests.
 * @property {boolean} [dryRun] - Don't actually make requests.
 * @property {string} [logFile] - If specified, responses will be saved to a file.
 */


/**
 * A function to send a batch of POST requests to an API endpoint.
 * @param  {BatchRequestConfig} PARAMS
 * @returns {Promise<Object[]>} - An array of responses from the API.
 * @example
 * const jobConfig = { url: "https://api.example.com", data: [{...}, {...}], searchParams: {verbose: "1"} };
 * const responses = await main(jobConfig);
 * 
 * 
 */
async function main(PARAMS) {
	const {
		url = "",
		batchSize = 1,
		concurrency = 10,
		data = undefined,
		bodyParams = undefined,
		searchParams = undefined,
		headers = undefined,
		dryRun = false,
		logFile = undefined,
		delay = 0,
		verbose = false,
	} = PARAMS;

	if (!url) throw new Error("No URL provided");
	if (!data) throw new Error("No data provided");

	if (verbose) {
		const { data, ...NON_DATA_PARAMS } = PARAMS;
		console.log('\n\tJOB CONFIG:\n', u.json(NON_DATA_PARAMS), '\n');		
	}

	const queue = new RunQueue({
		maxConcurrency: concurrency,
	});

	const batches = batchData(data, batchSize);
	const totalReq = batches.length;
	const responses = [];

	if (verbose) console.log(`\n\trecords: ${u.comma(data.length)} requests: ${u.comma(totalReq)}\n`);
	

	batches.forEach((batch, index) => {
		queue.add(0, async () => {
			// @ts-ignore
			const response = await makePostRequest(url, batch, searchParams, headers, bodyParams, dryRun);
			responses.push(response);
			if (delay) await u.sleep(delay);

			// Progress bar
			// @ts-ignore
			if (!dryRun) {
				readline.cursorTo(process.stdout, 0);
				const msg = `completed ${u.comma(index + 1)} of ${u.comma(totalReq)} requests    ${Math.floor((index + 1) / totalReq * 100)}%`;
				process.stdout.write(`\t${msg}\t`);
			}
		});
	});

	try {
		await queue.run();
		console.log("\nAll batches have been processed.\n");
		if (logFile) {
			u.touch(logFile, responses, true);
			console.log(`\n written to ${logFile}`);
		}
		return responses;
	} catch (error) {
		console.error("An error occurred:", error);
		throw error; // Important to propagate the error for handling outside the function
	}
}


async function makePostRequest(url, data, searchParams = null, headers = { "Content-Type": 'application/json' }, bodyParams, dryRun = false) {
	if (!url) return Promise.resolve("No URL provided");
	if (!data) return Promise.resolve("No data provided");

	let requestUrl = new URL(url);
	if (searchParams) {
		let params = new URLSearchParams(searchParams);
		// @ts-ignore
		requestUrl.search = params;
	}

	try {
		const request = {
			method: "POST",
			headers: headers,
			searchParams: searchParams,
			retries: 3,
			retryDelay: 1000,
			retryOn: [429, 418, 500, 502, 503, 504],
		};

		let payload;

		if (headers?.["Content-Type"] === 'application/x-www-form-urlencoded') {
			payload = { [bodyParams["dataKey"]]: JSON.stringify(data), ...bodyParams };
			delete payload.dataKey;
			request.body = querystring.stringify(payload);
		}

		else if (bodyParams) {
			payload = { [bodyParams["dataKey"]]: data, ...bodyParams };
			delete payload.dataKey;
			request.body = JSON.stringify(payload);
		}

		else {
			payload = data;
			request.body = JSON.stringify(data);
		}

		if (dryRun) {
			console.log(`url: ${requestUrl}\nbody: ${u.json(payload || data)}`);
			return request;
		}
		const response = await fetch(requestUrl, request);

		// Check for non-2xx responses and log them
		if (!response.ok) {
			console.error('Response Status:', response.status);
			console.error('Response Text:', await response.text());
			debugger;
		}

		// Extract response headers
		const resHeaders = Object.fromEntries(response.headers.entries());
		const status = response.status;
		const statusText = response.statusText;

		let responseBody = await response.text();
		if (u.isJSONStr(responseBody)) return JSON.parse(responseBody);
		else if (responseBody === "" || responseBody === "0") return { status, statusText, ...resHeaders };
		else return responseBody;

	} catch (error) {
		console.error("Error making POST request:", error);
		console.error("Data:", data);
		throw error; // Important to propagate the error to the queue
	}
}

function batchData(data, batchSize, bodyParams = null) {
	if (batchSize === 0) return data;
	if (Array.isArray(data) === false) return [data];
	const batches = [];
	for (let i = 0; i < data.length; i += batchSize) {
		if (batchSize === 1) {
			let batch = data[i];
			batches.push(batch);
		}
		else {
			let batch = data.slice(i, i + batchSize);
			batches.push(batch);
		}
	}
	return batches;
}


module.exports = main;
