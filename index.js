#!/usr/bin/env node
// @deshell/mcp — MCP server for the DeShell proxy
// Exposes deshell_scrape and deshell_search as MCP tools over JSON-RPC 2.0 stdio.
// Usage: npx @deshell/mcp (set DESHELL_API_KEY env var first)
'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

const PROXY_BASE = (process.env.DESHELL_PROXY_URL || 'https://proxy.deshell.ai').replace(/\/$/, '');
const API_KEY    = process.env.DESHELL_API_KEY || '';
const VERSION    = require('./package.json').version;

// ── HTTP helper ───────────────────────────────────────────────────────────────

function get(url, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(url, { headers }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return get(res.headers.location, headers).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Request timed out')));
  });
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'deshell_scrape',
    description: 'Fetch a URL and return its content as clean Markdown. Handles JavaScript-rendered pages, PDFs, and automatic content extraction.',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'The URL to fetch and convert to Markdown' } },
      required: ['url'],
    },
  },
  {
    name: 'deshell_search',
    description: 'Search the web and return results as Markdown. Includes titles, URLs, and snippet text for the top results.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The search query' } },
      required: ['query'],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

async function callTool(name, args) {
  if (!API_KEY) throw new Error('DESHELL_API_KEY environment variable is required');
  const headers = { 'X-DeShell-Key': API_KEY };

  if (name === 'deshell_scrape') {
    if (!args.url) throw new Error('url is required');
    return get(`${PROXY_BASE}/${args.url}`, headers);
  }
  if (name === 'deshell_search') {
    if (!args.query) throw new Error('query is required');
    return get(`${PROXY_BASE}/search?q=${encodeURIComponent(args.query)}`, { ...headers, 'Accept': 'text/markdown' });
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ── JSON-RPC transport ────────────────────────────────────────────────────────

const write = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');
const ok    = (id, result) => write({ jsonrpc: '2.0', id, result });
const fail  = (id, code, message) => write({ jsonrpc: '2.0', id, error: { code, message } });

async function dispatch(msg) {
  const { id, method, params } = msg;
  try {
    switch (method) {
      case 'initialize':
        ok(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: '@deshell/mcp', version: VERSION } });
        break;
      case 'initialized':
      case 'notifications/initialized':
        break; // notification — no response
      case 'ping':
        ok(id, {});
        break;
      case 'tools/list':
        ok(id, { tools: TOOLS });
        break;
      case 'tools/call': {
        const text = await callTool(params.name, params.arguments || {});
        ok(id, { content: [{ type: 'text', text }] });
        break;
      }
      default:
        if (id != null) fail(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    if (id != null) fail(id, -32603, err.message);
  }
}

// ── Stdin reader ──────────────────────────────────────────────────────────────

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try { dispatch(JSON.parse(line)); }
    catch { fail(null, -32700, 'Parse error'); }
  }
});
process.stdin.on('end', () => process.exit(0));
