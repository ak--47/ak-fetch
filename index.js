#! /usr/bin/env node
const RunQueue = require("run-queue");
const u = require("ak-tools");
const readline = require('readline');
const querystring = require('querystring');
const cli = require('./cli');
const nativeFetch = global.fetch;
// @ts-ignore
const fetch = require("fetch-retry")(global.fetch);
const { execSync } = require('child_process');
const { Transform } = require('stream');
const { Agent } = require('https');
const path = require('path');
const { createWriteStream } = require('fs');

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
 * @property {number} [timeout] - Timeout for the request.
 * @property {boolean} [keepalive] - use keepalive for the request.
 * @property {ShellConfig} [shell] - shell command to run to get token/secrets, etc....
 * @property {string} [method] - The HTTP method to use for the request.
 */

/** 
 * @typedef {Object} ShellConfig
 * @property {string} command - The shell command to run.
 * @property {string} [header] - The header to add to the request.
 * @property {string} [prefix] - The prefix to add to the header.
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
		headers = {},
		dryRun = false,
		logFile = undefined,
		delay = 0,
		verbose = false,
		retries = 3,
		retryDelay = 1000,
		retryOn = [429, 500, 502, 503, 504],
		timeout = 60000,
		keepalive = false,
		shell = undefined,
		method = "POST"
	} = PARAMS;

	if (!url) throw new Error("No URL provided");
	if (!data && method?.toUpperCase() !== "GET") throw new Error("No data provided");

	if (shell) {
		const commandOutput = execSync(shell.command).toString().trim();
		headers[shell.header || "Authorization"] = `${shell.prefix || "Bearer"} ${commandOutput}`;
	}

	const retryConfig = { retries, retryDelay, retryOn, timeout, keepalive };

	if (verbose) {
		const { data, ...NON_DATA_PARAMS } = PARAMS;
		console.log('\n\tJOB CONFIG:\n', u.json(NON_DATA_PARAMS), '\n');
	}

	// If data is a stream, process it using a generator
	if (data instanceof require('stream').Readable) {
		let dataProcessor = data;
		// @ts-ignore
		if (!data.readableObjectMode) dataProcessor = data.pipe(jsonlToJSON());
		const dataGenerator = streamToBatches(dataProcessor, batchSize);
		return processBatchesFromGenerator(dataGenerator, PARAMS, retryConfig);
	}

	const queue = new RunQueue({ maxConcurrency: concurrency });

	const batches = batchData(data, batchSize);
	const totalReq = batches.length;
	const responses = [];
	let count = 0;

	if (verbose && data) console.log(`\n\trecords: ${u.comma(data.length)} requests: ${u.comma(totalReq)} concurrency: ${concurrency} delay: ${delay}ms\n`);
	else if (verbose) console.log(`\n\trequests: ${u.comma(totalReq)} concurrency: ${concurrency} delay: ${delay}ms\n`);

	batches.forEach((batch, index) => {
		queue.add(0, async () => {
			// @ts-ignore
			const response = await makeHttpRequest(url, batch, searchParams, headers, bodyParams, dryRun, retryConfig, method);
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


async function makeHttpRequest(url, data, searchParams = null, headers = { "Content-Type": 'application/json' }, bodyParams, dryRun = false, retryConfig, method = "POST") {
	if (!url) return Promise.resolve("No URL provided");
	if (!data && method.toUpperCase() !== 'GET') return Promise.resolve("No data provided");
	if (!headers["Content-Type"]) headers["Content-Type"] = 'application/json';

	const { retries = 3, retryDelay = 1000, retryOn = [429, 500, 502, 503, 504], timeout = 60000, keepalive = false } = retryConfig;
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
			method: method,
			headers: headers,
			// @ts-ignore
			retries,
			retryDelay,
			retryOn,
			timeout,
			keepalive,
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
			nativeFetch(requestUrl, { ...request });
			return Promise.resolve({ url: requestUrl.toString(), status: "fire and forget", data: payload });
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


async function* streamToBatches(dataStream, batchSize) {
	let batch = [];

	for await (const data of dataStream) {
		batch.push(data);
		if (batch.length >= batchSize) {
			yield batch;
			batch = [];
		}
	}

	if (batch.length > 0) {
		yield batch;  // Yield any remaining items as the last batch
	}
}

async function processBatchesFromGenerator(dataGenerator, PARAMS, retryConfig) {
	const queue = new RunQueue({ maxConcurrency: PARAMS.concurrency });
	const responses = [];

	for await (const batch of dataGenerator) {
		queue.add(0, async () => {
			const response = await makeHttpRequest(PARAMS.url, batch, PARAMS.searchParams, PARAMS.headers, PARAMS.bodyParams, PARAMS.dryRun, retryConfig, PARAMS.method);
			responses.push(response);
			if (PARAMS.delay) await new Promise(r => setTimeout(r, PARAMS.delay));
		});
	}

	await queue.run();
	console.log("All batches have been processed.");

	if (PARAMS.logFile) {
		// Assume u.touch logs data to file
		await u.touch(PARAMS.logFile, responses, true);
		console.log(`\n written to ${PARAMS.logFile}`);
	}

	return responses;
}


// Function to transform JSONL to JSON objects
function jsonlToJSON() {
	let buffer = '';

	return new Transform({
		readableObjectMode: true,
		transform(chunk, encoding, callback) {
			buffer += chunk.toString();
			let lines = buffer.split('\n');
			// @ts-ignore
			buffer = lines.pop(); // The last incomplete line if any

			lines.forEach((line) => {
				if (line.trim()) {
					try {
						this.push(JSON.parse(line));
					} catch (error) {
						this.emit('error', new Error('Invalid JSON: ' + line));
					}
				}
			});
			callback();
		},
		flush(callback) {
			if (buffer.trim()) {
				try {
					this.push(JSON.parse(buffer));
				} catch (error) {
					this.emit('error', new Error('Invalid JSON: ' + buffer));
				}
			}
			callback();
		}
	});
}



// main.download = download;
// main.upload = upload;
module.exports = main;

