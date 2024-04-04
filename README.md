# ak-fetch

## 🌐 Overview

`ak-fetch` is a powerful and flexible tool designed for making bulk `POST` requests to an API endpoints. It allows batching and queuing of requests, concurrency control, retries, and more, making it a robust solution for handling large data operations with ease.

## 🚀 Installation

To get started with `ak-fetch`, install the module using npm:

```bash
npm install ak-fetch
```

## 🖥️ Usage
Use ak-fetch directly in your node script or via the command line:

```javascript
const akFetch = require('ak-fetch');
const config = {
        url: 'https://api.example.com',
        data: [...],
		batchSize: 10,
		concurrency: 5,
		delay: 1000,
        // ... other configurations
};

try {
	const responses = await akFetch(config);
	console.log('API Responses:', responses);
} catch (error) {
	console.error('Error:', error);
}
```
command line usage is similar:
```bash
npx ak-fetch --url https://api.example.com './payloads.json' --batchSize 10 --concurrency 5
```
Use `--help` to see all options


## 🛠️ Configuration
The ak-fetch module can be configured with a variety of options to suit your needs:

| Option        | Type             | Description                                                  |
|---------------|------------------|--------------------------------------------------------------|
| `url`         | `string`         | The URL of the API endpoint.                                 |
| `data`        | `Object[]`       | An array of data objects to be sent in the requests.         |
| `batchSize`   | `number`         | # records per batch; Use 0 for no batching. |
| `concurrency` | `number`         | The level of concurrency for the requests.                   |
| `delay`       | `number`         | The delay between requests in milliseconds.                  |
| `searchParams`| `Object`		   | The search parameters to be appended to the URL.           |
| `bodyParams`  | `Object` 		   | The body parameters to be sent in the request.              |
| `headers`     | `Object`         | The headers to be sent in the request.                       |
| `verbose`     | `boolean`        | Whether to log progress of the requests.                     |
| `dryRun`      | `boolean` 	   | If true, no actual requests are made. |
| `logFile`     | `string`         | File path where responses will be saved.                     |
| `retries`     | `number` 		   | Number of retries for failed requests; use `null` for fire-and-forget. |
| `retryDelay`  | `number`         | Delay between retries in milliseconds.                       |
| `retryOn`     | `number[]`       | HTTP status codes to retry on.                               |


(note that with the CLI you may use camelCase or snake_case for options)



## 🧩 Contributing
Contributions to ak-fetch are welcome! Feel free to open issues or submit pull requests.

## 📝 License
ak-fetch is ISC licensed; use it however you wish.