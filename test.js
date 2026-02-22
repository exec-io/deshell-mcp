'use strict';
// Tests for distil-mcp — uses Node built-in test runner (node --test)
// Spawns the MCP server as a child process and exercises it over stdio.

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http     = require('node:http');
const path     = require('node:path');

const SERVER = path.join(__dirname, 'index.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Spawn the MCP server, send a sequence of JSON-RPC messages, collect `n` responses. */
function rpc(messages, { env = {}, count } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [SERVER], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const responses = [];
    let buf = '';

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try { responses.push(JSON.parse(line)); } catch { /* ignore */ }
        if (responses.length >= (count || messages.length)) {
          proc.kill();
          resolve(responses);
        }
      }
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (responses.length < (count || messages.length)) {
        resolve(responses); // return what we have
      }
    });

    for (const msg of messages) {
      proc.stdin.write(JSON.stringify(msg) + '\n');
    }
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('initialize returns protocolVersion and serverInfo', async () => {
  const [res] = await rpc([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
  ]);
  assert.equal(res.id, 1);
  assert.equal(res.result.protocolVersion, '2024-11-05');
  assert.equal(res.result.serverInfo.name, 'distil-mcp');
  assert.ok(res.result.capabilities.tools);
});

test('tools/list returns distil_scrape and distil_search', async () => {
  const [init, list] = await rpc([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  ], { count: 2 });

  assert.equal(list.id, 2);
  const names = list.result.tools.map((t) => t.name);
  assert.deepEqual(names, ['distil_scrape', 'distil_search', 'distil_screenshot', 'distil_render', 'distil_raw', 'distil_nocache']);

  const scrape = list.result.tools.find((t) => t.name === 'distil_scrape');
  assert.ok(scrape.description);
  assert.equal(scrape.inputSchema.required[0], 'url');

  const search = list.result.tools.find((t) => t.name === 'distil_search');
  assert.ok(search.description);
  assert.equal(search.inputSchema.required[0], 'query');

  const screenshot = list.result.tools.find((t) => t.name === 'distil_screenshot');
  assert.ok(screenshot.description);
  assert.equal(screenshot.inputSchema.required[0], 'url');

  const render = list.result.tools.find((t) => t.name === 'distil_render');
  assert.ok(render.description);
  assert.equal(render.inputSchema.required[0], 'url');

  const raw = list.result.tools.find((t) => t.name === 'distil_raw');
  assert.ok(raw.description);
  assert.equal(raw.inputSchema.required[0], 'url');

  const nocache = list.result.tools.find((t) => t.name === 'distil_nocache');
  assert.ok(nocache.description);
  assert.equal(nocache.inputSchema.required[0], 'url');
});

test('tools/call returns error when DISTIL_API_KEY is missing', async () => {
  const env = { DISTIL_API_KEY: '' };
  const [res] = await rpc([
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'distil_scrape', arguments: { url: 'https://example.com' } } },
  ], { env });
  assert.ok(res.error, 'Expected an error response');
  assert.match(res.error.message, /DISTIL_API_KEY/);
});

test('tools/call distil_scrape proxies to DISTIL_PROXY_URL', async () => {
  // Spin up a tiny local HTTP server to act as the proxy
  const server = http.createServer((req, res) => {
    assert.ok(req.headers['x-distil-key'], 'Missing X-Distil-Key header');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`# Mocked scrape for ${req.url}`);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  try {
    const env = {
      DISTIL_API_KEY: 'dk_test',
      DISTIL_PROXY_URL: `http://127.0.0.1:${port}`,
    };
    const [res] = await rpc([
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'distil_scrape', arguments: { url: 'https://example.com' } } },
    ], { env });

    assert.ok(!res.error, `Unexpected error: ${res.error?.message}`);
    assert.equal(res.result.content[0].type, 'text');
    assert.match(res.result.content[0].text, /Mocked scrape/);
  } finally {
    server.close();
  }
});

test('tools/call DISTIL_search appends Accept: text/markdown header', async () => {
  const receivedHeaders = {};
  const server = http.createServer((req, res) => {
    Object.assign(receivedHeaders, req.headers);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`# Search results for ${req.url}`);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  try {
    const env = {
      DISTIL_API_KEY: 'dk_test',
      DISTIL_PROXY_URL: `http://127.0.0.1:${port}`,
    };
    const [res] = await rpc([
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'distil_search', arguments: { query: 'Distil ai proxy' } } },
    ], { env });

    assert.ok(!res.error, `Unexpected error: ${res.error?.message}`);
    assert.equal(receivedHeaders.accept, 'text/markdown');
    assert.match(res.result.content[0].text, /Search results/);
  } finally {
    server.close();
  }
});

test('unknown method returns JSON-RPC error -32601', async () => {
  const [res] = await rpc([
    { jsonrpc: '2.0', id: 42, method: 'notamethod', params: {} },
  ]);
  assert.equal(res.id, 42);
  assert.equal(res.error.code, -32601);
  assert.match(res.error.message, /notamethod/);
});

test('initialized notification receives no response', async () => {
  // Send initialized (no id) followed by a ping — should only get one response
  const responses = await rpc([
    { jsonrpc: '2.0', method: 'initialized' },         // notification — no response
    { jsonrpc: '2.0', id: 1, method: 'ping', params: {} }, // should respond
  ], { count: 1 });
  assert.equal(responses.length, 1);
  assert.equal(responses[0].id, 1);
  assert.deepEqual(responses[0].result, {});
});

test('ping returns empty result', async () => {
  const [res] = await rpc([
    { jsonrpc: '2.0', id: 99, method: 'ping', params: {} },
  ]);
  assert.equal(res.id, 99);
  assert.deepEqual(res.result, {});
});

test('DISTIL_PROXY_URL override is respected', async () => {
  let hitCustomProxy = false;
  const server = http.createServer((req, res) => {
    hitCustomProxy = true;
    res.writeHead(200);
    res.end('custom proxy hit');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  try {
    const env = {
      DISTIL_API_KEY: 'dk_test',
      DISTIL_PROXY_URL: `http://127.0.0.1:${port}`,
    };
    await rpc([
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'distil_scrape', arguments: { url: 'https://example.com' } } },
    ], { env });
    assert.ok(hitCustomProxy, 'Custom proxy was not hit');
  } finally {
    server.close();
  }
});
