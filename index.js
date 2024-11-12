#! /usr/bin/env node
const RunQueue = require("run-queue");
const { json, isJSONStr, comma, touch, clone: cloneObj, makeExist } = require("ak-tools");
const readline = require('readline');
const querystring = require('querystring');
const cli = require('./cli');
const nativeFetch = global.fetch;
// @ts-ignore
const fetch = require("fetch-retry")(global.fetch);
const { execSync } = require('child_process');
const { Transform, Readable } = require('stream');
const path = require('path');
const { createReadStream, existsSync, createWriteStream } = require('fs');
const { writeFile } = require('fs').promises;
require('dotenv').config({ debug: false, override: false });

/**
 * @typedef {Object} BatchRequestConfig
 * @property {string} url - The URL of the API endpoint.
 * @property {Object[] & string & import('stream').Readable & any} data - An array of data objects, readable stream, or jsonl file to be sent in the requests.
 * @property {number} [batchSize] - The number of records to be sent in each batch. Use batch = 0 to not batch.
 * @property {number} [concurrency] - The level of concurrency for the requests.
 * @property {number} [maxTasks] - The maximum number of tasks to on the queue at once.
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
 * @property {function} [transform] - A function to transform the data before sending it.
 * @property {function} [errorHandler] - A function to handle errors.
 * @property {function} [responseHandler] - A function passed each response.
 * @property {function} [hook] - A function to run after each request ONLY when using an array of configs.
 * @property {boolean} [storeResponses] - Store the responses
 * @property {boolean} [clone] - Clone the data before sending it (useful if using transform).
 * @property {boolean} [forceGC] - Force garbage collection after each batch.
 * @property {boolean} [noBatch] - Do not batch the requests and just transactionally send them.
 * @property {string} [format] - 'json' or 'csv' to format the output.
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
 * @param  {BatchRequestConfig | BatchRequestConfig[]} PARAMS
 * @returns {Promise<Result | Result[]>} - An array of responses from the API.
 * @example
 * const jobConfig = { url: "https://api.example.com", data: [{...}, {...}], searchParams: {verbose: "1"} };
 * const responses = await main(jobConfig);
 * 
 * 
 */
async function main(PARAMS) {


	// If PARAMS is an array, process each config sequentially with concurrency 10 or the specified concurrency
	// this is the pattern used when we need to hit multiple endpoints with different configs
	if (Array.isArray(PARAMS)) {
		const concurrency = PARAMS[0]?.concurrency || 10;
		const delay = PARAMS[0]?.delay || 0;
		const verbose = PARAMS[0]?.verbose || false;
		const logFile = PARAMS[0]?.logFile || undefined;
		const format = PARAMS[0]?.format || 'json';
		const queue = new RunQueue({ maxConcurrency: concurrency });
		const results = [];
		let reqCount = 0;
		const totalCount = PARAMS.length;
		const hook = PARAMS[0]?.hook || null;


		reqCount++;

		for (const reqConfig of PARAMS) {
			queue.add(0, async () => {
				await new Promise(resolve => setTimeout(resolve, delay));
				try {
					reqCount++;
					const result = await processSingleConfig({ ...reqConfig }, false);
					if (typeof hook === 'function') hook(result, results);
					
					if (Array.isArray(result)) results.push(...result);
					else results.push(result);
									
					if (verbose) {
						readline.cursorTo(process.stdout, 0);
						readline.clearLine(process.stdout, 0);
						const percent = Math.floor((reqCount / totalCount) * 100); // Update percentage calculation
						const msg = `completed ${comma(reqCount)} of ${totalCount} batches ${isNaN(percent) ? "?" : percent}%\t`;
						process.stdout.write(`\t${msg}\t`);
					}
				} catch (error) {
					console.error('Error processing config:', error);
					// Optionally handle the error, e.g., by pushing a special result object
					results.push({ error });
				}
			});
		}
		if (verbose) console.log(`\nadded ${comma(PARAMS.length)} requests with concurrency ${concurrency}...\n`);

		await queue.run();
		if (logFile) {
			try {
				if (verbose) console.log(`\nwriting log to ${logFile}...`);
				await makeExist(logFile);
				switch (format) {
					case 'json':
						await streamJSON(logFile, results);
						break;
					case 'csv':
						await streamCSV(logFile, results);
						break;
					case 'ndjson':
						await streamNDJSON(logFile, results);
						break;
					default:
						await streamJSON(logFile, results);
				}
			}
			catch (error) {
				console.error('Error writing log:', error);
			}
		}
		return results;
	} else {
		// Otherwise, process the single config as before
		return processSingleConfig(PARAMS);
	}
}

/**
* Helper function to process a single BatchRequestConfig.
* @param {BatchRequestConfig} PARAMS 
* @returns {Promise<Result>}
*/
async function processSingleConfig(PARAMS, isOnlyJob = true) {

	const startTime = Date.now();
	const {
		url = "",
		batchSize = 1,
		concurrency = 10,
		maxTasks = 25,
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
		transform = undefined,
		errorHandler = undefined,
		responseHandler = undefined,
		clone = false,
		storeResponses = true,
		forceGC = false,
		noBatch = false

	} = PARAMS;

	if (!url) throw new Error("No URL provided");
	if (!data && method?.toUpperCase() !== "GET") throw new Error("No data provided");

	if (shell) {
		const commandOutput = execSync(shell.command).toString().trim();
		headers[shell.header || "Authorization"] = `${shell.prefix || "Bearer"} ${commandOutput}`;
		PARAMS.headers = headers;
	}

	const retryConfig = { retries, retryDelay, retryOn, timeout, keepalive };

	if (verbose && isOnlyJob) {
		const { data, ...NON_DATA_PARAMS } = PARAMS;
		console.log('\n\tJOB CONFIG:\n', json(NON_DATA_PARAMS), '\n');
	}

	if (noBatch) {
		return await makeHttpRequest(url, data, searchParams, headers, bodyParams, dryRun, retryConfig, method, debug, transform, clone, errorHandler, verbose, responseHandler);
	}

	let stream;
	if (data instanceof require('stream').Readable) {
		data.readableObjectMode ? stream = data : stream = data.pipe(jsonlToJSON(highWaterMark));

	}
	else if (typeof data === 'string') {
		if (existsSync(path.resolve(data))) {
			stream = createReadStream(path.resolve(data), { highWaterMark }).pipe(jsonlToJSON(highWaterMark));

		}
		else if (isJSONStr(data)) {
			stream = Readable.from(JSON.parse(data));


		}
		else if (isJSONStr(data?.split('\n')?.pop() || "")) {
			stream = Readable.from(data).pipe(jsonlToJSON(highWaterMark));

		}
		else {
			throw new Error("Invalid data source");
		}
	}
	else if (Array.isArray(data)) {
		stream = Readable.from(data);


	}
	else if (typeof data === 'object') {
		stream = Readable.from([data]);
	}
	else {
		if (method?.toUpperCase() !== "GET") throw new Error("Invalid data source");
		if (method?.toUpperCase() === "GET") return await makeHttpRequest(url, data, searchParams, headers, bodyParams, false, retryConfig, method, debug, transform, clone, errorHandler, verbose, responseHandler);
	}

	const [responses = [], reqCount = 0, rowCount = 0] = await processStream(stream, PARAMS, retryConfig);
	if (stream) stream.removeAllListeners();
	const endTime = Date.now();
	const duration = endTime - startTime;
	const clockTime = prettyTime(duration);
	// @ts-ignore
	const rps = Math.floor(reqCount / (duration / 1000));
	// @ts-ignore
	return { responses, duration, clockTime, reqCount, rowCount, rps };

}

async function makeHttpRequest(url, data, searchParams = null, headers = { "Content-Type": 'application/json' }, bodyParams, dryRun = false, retryConfig, method = "POST", debug = false, transform, clone, errorHandler, verbose, responseHandler) {
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

	let dataToSend = null;
	if (Array.isArray(data) && Array.isArray(data[0])) {
		dataToSend = data[0];

	}
	else {
		dataToSend = data;
	}
	let payloadData = clone ? cloneObj(dataToSend) : dataToSend;

	if (transform) {
		try {
			payloadData = payloadData.map(transform);

		}
		catch (error) {
			// ?
		}
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
				payload = { [bodyParams["dataKey"]]: JSON.stringify(payloadData), ...bodyParams };
				delete payload.dataKey;
			}
			else {
				payload = { ...bodyParams, ...payloadData };
			}
			request.body = querystring.stringify(payload);
		}

		else if (bodyParams) {
			payload = { [bodyParams["dataKey"]]: payloadData, ...bodyParams };
			delete payload.dataKey;
			request.body = JSON.stringify(payload);
		}

		else {
			payload = data;
			request.body = JSON.stringify(payloadData);
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

			console.log(`url: ${requestUrl}\nbody: ${json(payload || data)}`);
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
			if (verbose) {
				console.error('ERROR: Response Status:', response.status, 'Status Text:', response.statusText);
			}
			let body = await response.text();
			if (isJSONStr(body)) body = JSON.parse(body);
			if (debug) {
				debugger;
			}
			if (errorHandler) {
				return errorHandler({ status: response.status, statusText: response.statusText, body });
			}
			if (!errorHandler) {
				throw new Error(`ERROR: Response Status: ${response.status}`, { cause: { status: response.status, statusText: response.statusText, body } });
			}
		}

		// Extract response headers
		const resHeaders = Object.fromEntries(response.headers.entries());
		const status = response.status;
		const statusText = response.statusText;

		let responseBody = await response.text();
		let result;
		if (isJSONStr(responseBody)) result = JSON.parse(responseBody);
		else if (responseBody === "" || responseBody === "0") result = { status, statusText, ...resHeaders };
		else result = responseBody;

		if (responseHandler) {
			if (typeof responseHandler === 'function') {
				return responseHandler(result);
			}
		}
		return result;

	} catch (error) {
		console.error("Error making POST request:", error);
		console.error("Data:", data);
		throw error; // Important to propagate the error to the queue
	}
}

async function processStream(stream, PARAMS, retryConfig) {

	if (!stream) return Promise.resolve([]);

	let {
		url,
		searchParams,
		headers,
		bodyParams,
		dryRun,
		method,
		delay,
		concurrency,
		logFile,
		verbose,
		debug = false,
		transform,
		errorHandler,
		clone,
		responseHandler,
		storeResponses = true,
		forceGC = false,
		batchSize = 2000,
		highWaterMark = 16384,
		maxTasks = 25
	} = PARAMS;

	let queue = new RunQueue({ maxConcurrency: concurrency });
	const responses = [];
	let reqCount = 0;
	let rowCount = 0;
	let batch = [];
	let isStreamPaused = false;

	stream.on('error', error => {
		console.error("stream error:", error);
		cleanup(stream);
	});

	stream.on('end', () => {
		if (verbose) console.log(`\nStream ended: (queued: ${queue.queued} max: ${maxTasks} rows: ${rowCount} reqs: ${reqCount})`);
		cleanup(stream);
	});

	consumeObjectStream: for await (const data of stream) {
		batch.push(data);
		rowCount++;


		if (batch.length >= batchSize) {
			// Process the current batch if it reaches the batchSize
			addBatchToQueue(batch);
			batch = []; // Reset the batch
		}

		// Check if the queue size exceeds maxTasks
		if (queue.queued >= maxTasks && !isStreamPaused) {
			// Pause the stream and wait for the queue to complete
			if (!isStreamPaused) {
				if (verbose) console.log(`\nPausing Stream: (queued: ${queue.queued} max: ${maxTasks} rows: ${rowCount} reqs: ${reqCount})`);
				stream.pause();
				isStreamPaused = true;
			}

			// Wait for the queue to complete
			await queue.run();
			queue = new RunQueue({ maxConcurrency: concurrency });

			// Resume the stream
			if (isStreamPaused) {
				if (verbose) console.log(`\nResuming stream: (queued: ${queue.queued} max: ${maxTasks} rows: ${rowCount} reqs: ${reqCount})`);
				stream.resume();
				isStreamPaused = false;
			}
		}

		continue consumeObjectStream;
	}

	// Process any remaining data in the batch after the stream ends
	if (batch.length > 0) {
		addBatchToQueue(batch);
		await queue.run();
	}

	queue = null; // Cleanup the queue
	cleanup(stream); // Cleanup the stream

	if (verbose) {
		console.log(`\nAll tasks have been processed. (rows: ${rowCount} reqs: ${reqCount})\n`);
	}

	if (logFile) {
		await touch(logFile, responses, true);
		if (verbose) console.log(`\nlog written to ${logFile}`);
	}

	return [responses, reqCount, rowCount];

	function addBatchToQueue(currentBatch) {
		queue.add(0, async () => {
			try {
				const response = await makeHttpRequest(url, currentBatch, searchParams, headers, bodyParams, dryRun, retryConfig, method, debug, transform, clone, errorHandler, verbose, responseHandler);
				if (storeResponses) responses.push(response);
				reqCount++;
				if (delay) await new Promise(resolve => setTimeout(resolve, delay));
				if (verbose) {
					readline.cursorTo(process.stdout, 0);
					readline.clearLine(process.stdout, 0);
					const percent = Math.floor(reqCount / (rowCount / batchSize) * 100); // Update percentage calculation
					const msg = `completed ${comma(reqCount)} of ${comma(Math.ceil(rowCount / batchSize))} batches ${isNaN(percent) ? "?" : percent}%\t`;
					process.stdout.write(`\t${msg}\t`);
				}
			} catch (error) {
				console.error('Failed to process batch:', error);
				if (errorHandler) errorHandler(error);
			} finally {
				if (forceGC && global.gc) {
					global.gc(); // Optional: force garbage collection
				}
			}
		});
	}
}


// this is for CLI
if (require.main === module) {
	const params = cli().then((params) => {
		// @ts-ignore
		main(params)
			.then((results) => {
				if (params.verbose) console.log('\n\nRESULTS:\n\n', json(results));
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



function cleanup(stream) {
	if (stream) {
		stream.removeAllListeners();
		stream.destroy();
	}
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

async function streamJSON(filePath, data) {	
	await writeFile(filePath, JSON.stringify(data, null, 2));
	return filePath;
}


async function streamNDJSON(filePath, data) {
	return new Promise((resolve, reject) => {
		const writeStream = createWriteStream(filePath, { encoding: 'utf8' });
		data.forEach(item => {
			writeStream.write(JSON.stringify(item) + '\n');
		});
		writeStream.end();
		writeStream.on('finish', () => {
			resolve(filePath);
		});
		writeStream.on('error', reject);
	});
}

async function streamCSV(filePath, data) {
	return new Promise((resolve, reject) => {
		const writeStream = createWriteStream(filePath, { encoding: 'utf8' });
		// Extract all unique keys from the data array
		const columns = getUniqueKeys(data);  // Assuming getUniqueKeys properly retrieves all keys

		// Stream the header
		writeStream.write(columns.join(',') + '\n');

		// Stream each data row
		data.forEach(item => {
			for (const key in item) {
				// Ensure all nested objects are properly stringified
				if (typeof item[key] === "object") item[key] = JSON.stringify(item[key]);
			}
			const row = columns.map(col => item[col] ? `"${item[col].toString().replace(/"/g, '""')}"` : "").join(',');
			writeStream.write(row + '\n');
		});

		writeStream.end();
		writeStream.on('finish', () => {
			resolve(filePath);
		});
		writeStream.on('error', reject);
	});
}

function getUniqueKeys(data) {
	const keysSet = new Set();
	data.forEach(item => {
		Object.keys(item).forEach(key => keysSet.add(key));
	});
	return Array.from(keysSet);
};




module.exports = main;

