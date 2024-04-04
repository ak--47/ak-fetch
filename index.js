#! /usr/bin/env node
const RunQueue = require("run-queue");
const u = require("ak-tools");
const readline = require('readline');
const querystring = require('querystring');
const cli = require('./cli');
// @ts-ignore
const fetch = require("fetch-retry")(global.fetch);
require('dotenv').config({ debug: false, override: false });

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
 * @property {boolean | string} [dryRun] - Don't actually make requests.
 * @property {string} [logFile] - If specified, responses will be saved to a file.
 * @property {number | null} [retries] - Number of retries for failed requests; null for fire and forget
 * @property {number} [retryDelay] - Delay between retries.
 * @property {number[]} [retryOn] - Status codes to retry on.
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
		retries = 3,
		retryDelay = 1000,
		retryOn = [429, 500, 502, 503, 504],
	} = PARAMS;

	if (!url) throw new Error("No URL provided");
	if (!data) throw new Error("No data provided");


	const retryConfig = { retries, retryDelay, retryOn };

	if (verbose) {
		const { data, ...NON_DATA_PARAMS } = PARAMS;
		console.log('\n\tJOB CONFIG:\n', u.json(NON_DATA_PARAMS), '\n');
	}

	const queue = new RunQueue({ maxConcurrency: concurrency });

	const batches = batchData(data, batchSize);
	const totalReq = batches.length;
	const responses = [];
	let count = 0;

	if (verbose) console.log(`\n\trecords: ${u.comma(data.length)} requests: ${u.comma(totalReq)} concurrency: ${concurrency} delay: ${delay}ms\n`);


	batches.forEach((batch, index) => {
		queue.add(0, async () => {
			// @ts-ignore
			const response = await makePostRequest(url, batch, searchParams, headers, bodyParams, dryRun, retryConfig);
			count++;
			responses.push(response);
			if (delay) await u.sleep(delay);

			// Progress bar
			// @ts-ignore
			if (!dryRun) {
				readline.cursorTo(process.stdout, 0);
				const msg = `completed ${u.comma(count)} of ${u.comma(totalReq)} requests    ${Math.floor((count) / totalReq * 100)}%\t`;
				process.stdout.write(`\t${msg}\t`);
			}
		});
	});

	try {
		await queue.run();
		console.log("\nAll batches have been processed.\n");
		if (logFile) {
			if (dryRun === 'curl') await u.touch(logFile, responses.join("\n\n"), false);
			else {
				await u.touch(logFile, responses, true);
			}
			console.log(`\n written to ${logFile}`);
		}
		return responses;
	} catch (error) {
		console.error("An error occurred:", error);
		throw error; // Important to propagate the error for handling outside the function
	}
}


async function makePostRequest(url, data, searchParams = null, headers = { "Content-Type": 'application/json' }, bodyParams, dryRun = false, retryConfig) {
	if (!url) return Promise.resolve("No URL provided");
	if (!data) return Promise.resolve("No data provided");

	const { retries = 3, retryDelay = 1000, retryOn = [429, 500, 502, 503, 504] } = retryConfig;
	let isFireAndForget = retries === null;
	let requestUrl = new URL(url);
	if (searchParams) {
		let params = new URLSearchParams(searchParams);
		// @ts-ignore
		requestUrl.search = params;
	}


	try {
		/** @type {RequestInit} */
		const request = {
			method: "POST",
			headers: headers,
			// searchParams: searchParams,
			// @ts-ignore
			retries,
			retryDelay,
			retryOn,
			keepalive: true
		};

		let payload;

		if (headers?.["Content-Type"] === 'application/x-www-form-urlencoded') {
			if (bodyParams?.["dataKey"]) {
				payload = { [bodyParams["dataKey"]]: JSON.stringify(data), ...bodyParams };
				delete payload.dataKey;
			}
			else {
				payload = { ...bodyParams, ...data };
			}
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
			// @ts-ignore
			if (dryRun === "curl") {
				let curlCommand = `curl -X POST "${requestUrl}" \\\n`; // Start the command
				for (const [key, value] of Object.entries(headers)) {
					curlCommand += ` -H "${key}: ${value}" \\\n`; // Add headers
				}

				// Prepare payload based on Content-Type
				let payloadStr = "";
				if (headers["Content-Type"] === 'application/x-www-form-urlencoded') {
					payloadStr = querystring.stringify(payload);
				} else { // Assumes JSON or other types that require stringified payload
					payloadStr = JSON.stringify(payload); // Pretty print JSON
					// payloadStr = payloadStr.replace(/'/g, "'\\''"); // Escape single quotes
				}

				// Add payload to curl command
				curlCommand += ` -d '${payloadStr}'`;

				console.log(`\n${curlCommand}\n`);
				return curlCommand;
			}

			console.log(`url: ${requestUrl}\nbody: ${u.json(payload || data)}`);
			return request;
		}
		if (isFireAndForget) {
			//do not wait for response
			fetch(requestUrl, { ...request, retries: 0 });
			return Promise.resolve(null);
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


// this is for CLI
if (require.main === module) {
	const params = cli().then((params) => {
		// @ts-ignore
		main(params)
			.then((results) => {
				if (params.verbose) console.log('\n\nRESULTS:\n\n', u.json(results));
			})
			.catch((e) => {
				console.log('\n\nUH OH! something went wrong; the error is:\n\n');
				console.error(e);
				process.exit(1);
			})
			.finally(() => {
				process.exit(0);
			});
	});



}
