const yargs = require('yargs');
const { version } = require('./package.json');
const u = require('ak-tools');
const { createLogger } = require('./lib/logger');

async function cliParams() {
	// @ts-ignore
	const args = yargs(process.argv.splice(2))
		.scriptName("ak-fetch")
		.usage(`${welcome}\n\nusage:\nnpx $0 [data] [options]

examples:
  # Basic batch processing
  npx $0 ./data.json --url https://api.example.com --batchSize 50

  # High-performance streaming
  npx $0 ./events.jsonl --url https://api.example.com/events --batchSize 1000 --concurrency 20 --enableConnectionPooling

  # Multiple HTTP methods
  npx $0 ./users.json --url https://api.example.com/users --method PUT --enableCookies

  # Memory-efficient large files
  npx $0 ./massive-dataset.jsonl --url https://api.example.com/bulk --maxResponseBuffer 100 --storeResponses false

  # Dynamic authentication
  npx $0 ./data.json --url https://api.example.com/secure --shellCommand 'aws sts get-session-token --query Credentials.SessionToken --output text'

  # Inline data
  npx $0 --payload '[{"id": 1, "name": "test"}]' --url https://api.example.com --verbose

DOCS: https://github.com/ak--47/ak-fetch`)
		.command('$0', 'bulk fetch calls', () => { })
		.option("url", {
			demandOption: true,
			describe: 'Target API endpoint URL',
			type: 'string'
		})
		.option("method", {
			demandOption: false,
			describe: 'HTTP method (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)',
			type: 'string',
			default: 'POST',
			choices: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
		})
		.option("batch_size", {
			alias: 'batchSize',
			demandOption: false,
			describe: 'Records per HTTP request (0 disables batching)',
			type: 'number',
			default: 1
		})
		.option("concurrency", {
			demandOption: false,
			describe: 'Maximum concurrent requests',
			type: 'number',
			default: 10
		})
		.option("max_tasks", {
			alias: 'maxTasks',
			demandOption: false,
			describe: 'Max queued tasks before pausing stream',
			type: 'number',
			default: 25
		})
		.option("delay", {
			demandOption: false,
			describe: 'Delay between requests in milliseconds',
			type: 'number',
			default: 0
		})
		.option("retries", {
			demandOption: false,
			describe: 'Max retry attempts (null for fire-and-forget)',
			type: 'number',
			default: 3
		})
		.option("retry_delay", {
			alias: 'retryDelay',
			demandOption: false,
			describe: 'Base retry delay in milliseconds',
			type: 'number',
			default: 1000
		})
		.option("retry_on", {
			alias: 'retryOn',
			demandOption: false,
			describe: 'HTTP status codes to retry on (JSON array)',
			type: 'string',
			default: '[408,429,500,502,503,504,520,521,522,523,524]'
		})
		.option("use_static_retry_delay", {
			alias: 'useStaticRetryDelay',
			demandOption: false,
			describe: 'Use fixed delays instead of exponential backoff',
			type: 'boolean',
			default: false
		})
		.option("timeout", {
			demandOption: false,
			describe: 'Request timeout in milliseconds',
			type: 'number',
			default: 60000
		})
		.option("dry_run", {
			alias: 'dryRun',
			demandOption: false,
			default: false,
			describe: 'Test mode: true or "curl" for curl commands',
			type: 'string'
		})
		.option("no_batch", {
			alias: 'noBatch',
			demandOption: false,
			describe: 'Send as single request without batching',
			type: 'boolean',
			default: false
		})
		.option("log_file", {
			alias: 'logFile',
			demandOption: false,
			describe: 'Save responses to file',
			type: 'string'
		})
		.option("format", {
			demandOption: false,
			describe: 'Output format for log files',
			type: 'string',
			default: 'json',
			choices: ['json', 'csv', 'ndjson']
		})
		.option("verbose", {
			demandOption: false,
			default: true,
			describe: 'Enable progress display and detailed logging',
			type: 'boolean'
		})
		.option("response_headers", {
			alias: 'responseHeaders',
			demandOption: false,
			describe: 'Include response headers in output',
			type: 'boolean',
			default: false
		})
		.options("search_params", {
			alias: 'searchParams',
			demandOption: false,
			default: "{}",
			describe: 'URL query parameters as JSON: {"key": "value"}',
			type: 'string'
		})
		.options("body_params", {
			alias: 'bodyParams',
			demandOption: false,
			default: "{}",
			describe: 'Additional body parameters as JSON',
			type: 'string'
		})
		.options("headers", {
			demandOption: false,
			default: "{}",
			describe: 'HTTP headers as JSON: {"Authorization": "Bearer xxx"}',
			type: 'string'
		})
		.options("payload", {
			demandOption: false,
			describe: 'Data to send as JSON (alternative to file argument)',
			type: 'string'
		})
		// Performance & Memory Options
		.option("enable_connection_pooling", {
			alias: 'enableConnectionPooling',
			demandOption: false,
			describe: 'Enable HTTP connection pooling for performance',
			type: 'boolean',
			default: true
		})
		.option("keep_alive", {
			alias: 'keepAlive',
			demandOption: false,
			describe: 'Keep TCP connections alive',
			type: 'boolean',
			default: true
		})
		.option("max_response_buffer", {
			alias: 'maxResponseBuffer',
			demandOption: false,
			describe: 'Maximum responses kept in memory (circular buffer)',
			type: 'number',
			default: 1000
		})
		.option("max_memory_usage", {
			alias: 'maxMemoryUsage',
			demandOption: false,
			describe: 'Memory limit in bytes',
			type: 'number'
		})
		.option("force_gc", {
			alias: 'forceGC',
			demandOption: false,
			describe: 'Force garbage collection after batches',
			type: 'boolean',
			default: false
		})
		.option("high_water_mark", {
			alias: 'highWaterMark',
			demandOption: false,
			describe: 'Stream buffer size in bytes',
			type: 'number',
			default: 16384
		})
		// Advanced Features
		.option("enable_cookies", {
			alias: 'enableCookies',
			demandOption: false,
			describe: 'Enable automatic cookie handling',
			type: 'boolean',
			default: false
		})
		.option("store_responses", {
			alias: 'storeResponses',
			demandOption: false,
			describe: 'Store responses in memory',
			type: 'boolean',
			default: true
		})
		.option("clone", {
			demandOption: false,
			describe: 'Clone data before transformation',
			type: 'boolean',
			default: false
		})
		.option("debug", {
			demandOption: false,
			describe: 'Enable debug mode with detailed error info',
			type: 'boolean',
			default: false
		})
		// Shell command for dynamic headers
		.option("shell_command", {
			alias: 'shellCommand',
			demandOption: false,
			describe: 'Shell command for dynamic header generation',
			type: 'string'
		})
		.option("shell_header", {
			alias: 'shellHeader',
			demandOption: false,
			describe: 'Header name for shell command output',
			type: 'string',
			default: 'Authorization'
		})
		.option("shell_prefix", {
			alias: 'shellPrefix',
			demandOption: false,
			describe: 'Prefix for shell command header value',
			type: 'string',
			default: 'Bearer'
		})
		.help()
		.wrap(null)
		.argv;
	// @ts-ignore
	if (args._.length === 0 && !args.payload) {
		// @ts-ignore
		yargs.showHelp();
		process.exit();
	}

	// Parse JSON arguments
	// @ts-ignore
	if (args.headers) args.headers = parse(args.headers);
	// @ts-ignore
	if (args.search_params) args.searchParams = parse(args.search_params);
	// @ts-ignore
	if (args.body_params) args.bodyParams = parse(args.body_params);
	// @ts-ignore
	if (args.retry_on) args.retryOn = parse(args.retry_on);
	// @ts-ignore
	if (args.payload) args.data = parse(args.payload);
	
	// Handle dry run modes
	// @ts-ignore
	if (args.dry_run === 'true' || args.dry_run === true) args.dryRun = true;
	// @ts-ignore
	else if (args.dry_run === 'curl') args.dryRun = 'curl';
	// @ts-ignore
	else if (args.dry_run === 'false' || args.dry_run === false) args.dryRun = false;
	
	// Handle shell command configuration
	// @ts-ignore
	if (args.shell_command) {
		// @ts-ignore
		args.shell = {
			// @ts-ignore
			command: args.shell_command,
			// @ts-ignore
			header: args.shell_header,
			// @ts-ignore
			prefix: args.shell_prefix
		};
	}
	
	// Handle retries null value for fire-and-forget
	// @ts-ignore
	if (args.retries === 'null' || args.retries === null) args.retries = null;

	// Handle file input
	// @ts-ignore
	const file = args._[0];
	if (file) {
		try {
			// For file input, just pass the file path - let the main function handle it
			// @ts-ignore
			args.data = file;
		} catch (error) {
			const logger = createLogger({ verbose: true });
			logger.error(`Failed to process file: ${file}`, error.message);
			process.exit(1);
		}
	}

	// @ts-ignore
	if (!args.data && args.method !== 'GET' && args.method !== 'HEAD' && args.method !== 'OPTIONS') {
		throw new Error('No data provided for ' + args.method + ' request');
	}
	
	// Clean up CLI-specific properties
	// @ts-ignore
	delete args._;
	// @ts-ignore
	delete args.$0;
	// @ts-ignore
	delete args.shell_command;
	// @ts-ignore
	delete args.shell_header;
	// @ts-ignore
	delete args.shell_prefix;
	// @ts-ignore
	delete args.retry_on;
	// @ts-ignore
	delete args.search_params;
	// @ts-ignore
	delete args.body_params;
	
	return args;
}

const hero = String.raw`
░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░      ░▒▓████████▓▒░▒▓████████▓▒░▒▓████████▓▒░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░         ░▒▓█▓▒░  ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░         ░▒▓█▓▒░  ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓████████▓▒░▒▓███████▓▒░       ░▒▓██████▓▒░ ░▒▓██████▓▒░    ░▒▓█▓▒░  ░▒▓█▓▒░      ░▒▓████████▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░         ░▒▓█▓▒░  ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓█▓▒░         ░▒▓█▓▒░  ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░      ░▒▓████████▓▒░  ░▒▓█▓▒░   ░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░                                                                                                    
`;

const banner = `... production-ready HTTP client for bulk operations (v${version || 2})
\t🚀 High Performance • 🔄 Smart Retries • 💾 Memory Efficient • 🔒 Production Ready
\tby AK (ak@mixpanel.com)\n\n`;

const welcome = hero.concat('\n').concat(banner);
cliParams.welcome = welcome;


/** 
 * helper to parse values passed in from cli
 * @param {string | string[] | void | any} val - value to parse
 * @param {any} [defaultVal] value if it can't be parsed
 * @return {Object<length, number>}
 */
function parse(val, defaultVal = undefined) {
	if (typeof val === 'string') {
		try {
			val = JSON.parse(val);
		}
		catch (firstError) {
			try {
				if (typeof val === 'string') val = JSON.parse(val?.replace(/'/g, '"'));
			}
			catch (secondError) {
				if (this.verbose) console.log(`error parsing tags: ${val}\ntags must be valid JSON`);
				val = defaultVal; //bad json
			}
		}
	}
	if (Object.keys(val).length === 0) return defaultVal;
	return val;
}


module.exports = cliParams;