# distil-proxy

MCP for the [Distil](https://distil.net) web proxy. Provides a fall through CLI and also gives Claude Desktop, Cursor, Windsurf and any MCP-compatible AI tool the ability to fetch web pages and search the web — clean Markdown, no noise.

## Tools

| Tool | Description |
|------|-------------|
| `distil_scrape` | Fetch a URL and return its content as clean Markdown. Handles JavaScript-rendered pages, PDFs, and automatic content extraction. |
| `distil_search` | Search the web and return results as Markdown. Includes titles, URLs, and snippet text for the top results. |
| `distil_screenshot` | Take a screenshot of a web page and return it as an image. |
| `distil_render` | Render a web page (such as a single page javascript app) before trying to extract markdown. |
| `distil_raw` | Fetch a URL and return its raw content bypassing any attempt to render markdown. |
| `distil_nocache` | Fetch a URL and return its content without using the cache. |


## Setup

### 1. Get a Distil API key

Sign up at [distil.net](https://distil.net) to get your API key (`dk_...`).

### 2. Add to your MCP config

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "Distil": {
      "command": "npx",
      "args": ["-y", "distil-proxy"],
      "env": {
        "DISTIL_API_KEY": "dk_your_key_here"
      }
    }
  }
}
```

**Cursor / Windsurf** — add the same block to your MCP settings file.

### 3. Restart your AI tool

The `distil_scrape`, `distil_search`, `distil_screenshot`, `distil_render`, `distil_raw` and `distil_nocache` tools will appear automatically.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `DISTIL_API_KEY` | *(required)* | Your Distil API key |
| `DISTIL_PROXY_URL` | `https://proxy.distil.net` | Proxy base URL (override for self-hosted) |

## Usage examples

Once installed, you can ask your AI assistant things like:

- *"Fetch https://example.com and summarise it"* → uses `distil_scrape`
- *"Search the web for the latest Node.js release notes"* → uses `distil_search`
- *"Take a screen shot of npmjs.org"* → uses `distil_screenshot`
- *"Go and read the web page of openai.com"* → uses `distil_render`
- *"Make sure you get the latest version of openclaw.ai"* → uses `distil_nocache`

## Running manually

```bash
DISTIL_API_KEY=dk_your_key npx distil-proxy
```

The server speaks [MCP JSON-RPC 2.0](https://modelcontextprotocol.io) over stdio.

## Development

```bash
# Clone the repo
git clone https://github.com/exec-io/distil-proxy.git
cd distil-proxy

# Run tests (no dependencies needed — uses Node built-ins only)
node --test test.js
```

## License

MIT — see [LICENSE.md](LICENSE.md) in the repo root.
