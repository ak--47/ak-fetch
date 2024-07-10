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
const path = require('path');
const { createReadStream, existsSync } = require('fs');


require('dotenv').config({ debug: false, override: false });

/**
 * @typedef {Object} BatchRequestConfig
 * @property {string} url - The URL of the API endpoint.
 * @property {Object[] & string & import('stream').Readable & any} data - An array of data objects, readable stream, or jsonl file to be sent in the requests.
 * @property {number} [batchSize] - The number of records to be sent in each batch. Use batch = 0 to not batch.
 * @property {number} [concurrency] - The level of concurrency for the requests.
 * @property {number} [delay] - The delay between requests.
 * @property {Object|null} [searchParams] - An object representing the search parameters to be appended to the URL.
 * @property {Object|null} [bodyParams] - An object representing the body parameters to be sent in the request.
 * @property {Object} [headers] - An object representing the headers to be sent in the request.
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
 * @property {boolean} [debug] - drop debugger on bad requests
 * @property {number} [highWaterMark] - The highWaterMark for the stream
 */

/** 
 * @typedef {Object} ShellConfig
 * @property {string} command - The shell command to run.
 * @property {string} [header] - The header to add to the request.
 * @property {string} [prefix] - The prefix to add to the header.
 */

/**
 * @typedef {Object} Result
 * @property {Object[]} responses - An array of responses from the API.
 * @property {number} duration - The duration of the job in milliseconds.
 * @property {string} clockTime - The duration of the job in human-readable format.
 */

/**
 * A function to send a batch of POST requests to an API endpoint.
 * @param  {BatchRequestConfig} PARAMS
 * @returns {Promise<Result>} - An array of responses from the API.
 * @example
 * const jobConfig = { url: "https://api.example.com", data: [{...}, {...}], searchParams: {verbose: "1"} };
 * const responses = await main(jobConfig);
 * 
 * 
 */
async function main(PARAMS) {
	const startTime = Date.now();
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
		method = "POST",
		debug = false,
		highWaterMark = 16384, // 16KB
	} = PARAMS;

	if (!url) throw new Error("No URL provided");
	if (!data && method?.toUpperCase() !== "GET") throw new Error("No data provided");

	if (shell) {
		const commandOutput = execSync(shell.command).toString().trim();
		headers[shell.header || "Authorization"] = `${shell.prefix || "Bearer"} ${commandOutput}`;
		PARAMS.headers = headers;
	}

	const retryConfig = { retries, retryDelay, retryOn, timeout, keepalive };

	if (verbose) {
		const { data, ...NON_DATA_PARAMS } = PARAMS;
		console.log('\n\tJOB CONFIG:\n', u.json(NON_DATA_PARAMS), '\n');
	}


	let batches;
	let stream;
	if (data instanceof require('stream').Readable) {
		data.readableObjectMode ? stream = data : stream = data.pipe(jsonlToJSON(highWaterMark));
		batches = streamToBatches(stream, PARAMS.batchSize);
	}
	else if (typeof data === 'string') {
		if (existsSync(path.resolve(data))) {
			stream = createReadStream(path.resolve(data), { highWaterMark }).pipe(jsonlToJSON(highWaterMark));
			batches = streamToBatches(stream, PARAMS.batchSize);
		}
		else {
			throw new Error("Invalid data source");
		}
	}
	else if (Array.isArray(data)) batches = batchData(data, PARAMS.batchSize);
	else if (typeof data === 'object') batches = batchData([data], PARAMS.batchSize);
	else {
		if (method?.toUpperCase() !== "GET") throw new Error("Invalid data source");
	}


	const [responses = [], reqCount = 0, rowCount = 0] = await processBatches(batches, PARAMS, retryConfig);
	const endTime = Date.now();
	const duration = endTime - startTime;
	const clockTime = prettyTime(duration);
	// @ts-ignore
	const rps = Math.floor(reqCount / (duration / 1000));
	// @ts-ignore
	return { responses, duration, clockTime, reqCount, rowCount, rps };

}

async function makeHttpRequest(url, data, searchParams = null, headers = { "Content-Type": 'application/json' }, bodyParams, dryRun = false, retryConfig, method = "POST", debug = false) {
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
		if (method.toUpperCase() === 'GET') delete request.body;
		const response = await fetch(requestUrl, request);

		// Check for non-2xx responses and log them
		if (!response.ok) {
			console.error('ERROR: Response Status:', response.status);
			const body = await response.text();
			// console.error('Response Text:', await response.text());
			if (debug) {
				debugger;
			}
			return { status: response.status, statusText: response.statusText, body };
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

async function processBatches(batches, PARAMS, retryConfig) {
	let {
		url, searchParams, headers, bodyParams, dryRun, method, delay, concurrency, logFile, verbose, data, debug = false,
	} = PARAMS;

	const queue = new RunQueue({ maxConcurrency: concurrency });
	const totalReq = batches?.length || "streamed";
	const responses = [];
	let requestCount = 0;
	let rowCount = 0;

	if (!batches) batches = [null];

	for await (const batch of batches) {
		queue.add(0, async () => {
			const response = await makeHttpRequest(url, batch, searchParams, headers, bodyParams, dryRun, retryConfig, method, debug);
			responses.push(response);
			requestCount++;
			rowCount += batch?.length || 1;
			if (delay) await new Promise(r => setTimeout(r, delay));

			// Progress bar
			if (!dryRun && verbose) {
				readline.cursorTo(process.stdout, 0);
				readline.clearLine(process.stdout, 0);
				const percent = Math.floor(requestCount / totalReq * 100);
				const msg = `completed ${u.comma(requestCount)} of ${u.comma(totalReq)} requests    ${isNaN(percent) ? "?" : percent}%\t`;
				process.stdout.write(`\t${msg}\t`);
			}
		});
	}

	await queue.run();
	if (verbose) console.log("\nAll batches have been processed.\n");

	if (logFile) {
		await u.touch(logFile, responses, true);
		if (verbose) console.log(`\n written to ${logFile}`);
	}

	return [responses, requestCount, rowCount];
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




// Function to transform JSONL to JSON objects
function jsonlToJSON(highWaterMark = 16384) {
	let buffer = '';

	return new Transform({
		readableObjectMode: true,
		highWaterMark: highWaterMark,
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

function prettyTime(milliseconds) {
	let totalSeconds = milliseconds / 1000;

	const levels = [
		[Math.floor(totalSeconds / 31536000), 'years'],
		[Math.floor((totalSeconds % 31536000) / 86400), 'days'],
		[Math.floor(((totalSeconds % 31536000) % 86400) / 3600), 'hours'],
		[Math.floor((((totalSeconds % 31536000) % 86400) % 3600) / 60), 'minutes']
	];

	let seconds = (totalSeconds % 60).toFixed(2);  // Round seconds to two decimal places
	levels.push([seconds, 'seconds']);  // Add seconds to levels array

	let result = '';

	for (let i = 0, max = levels.length; i < max; i++) {
		if (levels[i][0] == 0 || (i === max - 1 && levels[i][0] == "0.00")) continue;
		// @ts-ignore
		result += ` ${levels[i][0]} ${levels[i][0] === 1 ? levels[i][1].slice(0, -1) : levels[i][1]}`;
	}
	return result.trim();
}

// main.download = download;
// main.upload = upload;
module.exports = main;

