// test/helpers/local-server.js
import http from 'http';

/**
 * Local test server. Default handler echoes JSON.
 * handler(req, res, body) — return true to indicate you handled the response.
 */
export async function makeServer(handler) {
    const state = {
        requests: [],
        connections: 0,
        inFlight: 0,
        peakConcurrent: 0,
    };

    const server = http.createServer((req, res) => {
        state.inFlight++;
        state.peakConcurrent = Math.max(state.peakConcurrent, state.inFlight);
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', async () => {
            let body = raw;
            try { body = JSON.parse(raw); } catch { /* keep raw string */ }
            state.requests.push({ method: req.method, url: req.url, headers: req.headers, body, raw });
            const handled = handler ? await handler(req, res, body) : false;
            if (!handled) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ echo: body }));
            }
            state.inFlight--;
        });
    });

    server.on('connection', () => state.connections++);
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;

    return {
        url: `http://localhost:${port}`,
        port,
        get requests() { return state.requests; },
        get connections() { return state.connections; },
        get peakConcurrent() { return state.peakConcurrent; },
        close: () => new Promise((r) => server.close(r)),
    };
}
