const yargs = require('yargs');
const { version } = require('./package.json');
const u = require('ak-tools');

async function cliParams() {
	// @ts-ignore
	const args = yargs(process.argv.splice(2))
		.scriptName("ak-fetch")
		.usage(`${welcome}\n\nusage:\nnpx $0 [data] [options]

ex:
npx $0 ./payloads.json --url https://foo.com
npx $0 --payload '[{"foo": "bar", "baz": "qux"}]' --url https://foo.com

DOCS: https://github.com/ak--47/ak-fetch`)
		.command('$0', 'bulk fetch calls', () => { })
		.option("url", {
			demandOption: true,
			describe: 'URL to POST to',
			type: 'string'
		})
		.option("batch_size", {
			alias: 'batchSize',
			demandOption: false,
			describe: '# of records in each request',
			type: 'number',
			default: 1
		})
		.option("concurrency", {
			demandOption: false,
			describe: '# simultaneous requests',
			type: 'number',
			default: 3,
		})
		.option("delay", {
			demandOption: false,
			describe: 'delay between requests',
			type: 'number',
			default: 0
		})
		.option("retries", {
			demandOption: false,
			describe: '# of retries on 4xx/5xx',
			type: 'number',
			default: 3
		})
		.option("retry_delay", {
			alias: 'retryDelay',
			demandOption: false,
			describe: 'delay between retries',
			type: 'number',
			default: 1000
		})
		.option("dry_run", {
			alias: 'dryRun',
			demandOption: false,
			default: false,
			describe: 'generate requests but don\'t send',
			type: 'boolean'
		})
		.option("log_file", {
			alias: 'logFile',
			demandOption: false,
			default: `./${new Date().toISOString().split('T')[0]}-log.txt`,
			describe: 'log results to file',
			type: 'string'
		})
		.option("verbose", {
			demandOption: false,
			default: true,
			describe: 'show progress bar',
			type: 'boolean'
		})
		.options("search_params", {
			alias: 'searchParams',
			demandOption: false,
			default: "{}",
			describe: 'query params to add to each record; {"key": "value"}',
			type: 'string'
		})
		.options("body_params", {
			alias: 'bodyParams',
			demandOption: false,
			default: "{}",
			describe: 'body params to add to each record; use {"dataKey": "val"} to wrap data in key',
			type: 'string'
		})
		.options("headers", {
			demandOption: false,
			default: "{}",
			describe: 'headers to add to each record; {"Authorization": "Basic xxx"}',
			type: 'string'
		})
		.options("payload", {
			demandOption: false,
			describe: 'data to send (you may also pass a filename)',
			type: 'string'
		})
		.help()
		.wrap(null)
		.argv;
	// @ts-ignore
	if (args._.length === 0) {
		// @ts-ignore
		yargs.showHelp();
		process.exit();
	}

	// @ts-ignore
	if (args.headers) args.headers = parse(args.headers);
	// @ts-ignore
	if (args.search_params) args.searchParams = parse(args.search_params);
	// @ts-ignore
	if (args.body_params) args.bodyParams = parse(args.body_params);
	// @ts-ignore
	if (args.payload) args.data = parse(args.payload);
	// @ts-ignore
	if (args.dry_run) args.dryRun = 'curl';

	// @ts-ignore
	const file = args._[0];
	if (file) {
		const data = await u.load(file);

		//json
		// @ts-ignore
		if (u.isJSONStr(data)) args.data = JSON.parse(data)

		//jsonl
		// @ts-ignore
		if (data.split('\n').map(u.isJSONStr).every(a => a)) args.data = data.split('\n').map(JSON.parse)
	}

	// @ts-ignore
	if (!args.data) throw new Error('no data provided');
	
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

const banner = `... bulk fetch CLI... for fun + profit! (v${version || 2})
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