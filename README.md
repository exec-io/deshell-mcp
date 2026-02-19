# @deshell/mcp

MCP server for the [DeShell](https://deshell.ai) web proxy. Gives Claude Desktop, Cursor, Windsurf, and any MCP-compatible AI tool the ability to fetch web pages and search the web — clean Markdown, no noise.

## Tools

| Tool | Description |
|------|-------------|
| `deshell_scrape` | Fetch a URL and return its content as clean Markdown. Handles JavaScript-rendered pages, PDFs, and automatic content extraction. |
| `deshell_search` | Search the web and return results as Markdown. Returns titles, URLs, and snippet text for the top results. |

## Setup

### 1. Get a DeShell API key

Sign up at [deshell.ai](https://deshell.ai) to get your API key (`dk_...`).

### 2. Add to your MCP config

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "deshell": {
      "command": "npx",
      "args": ["-y", "@deshell/mcp"],
      "env": {
        "DESHELL_API_KEY": "dk_your_key_here"
      }
    }
  }
}
```

**Cursor / Windsurf** — add the same block to your MCP settings file.

### 3. Restart your AI tool

The `deshell_scrape` and `deshell_search` tools will appear automatically.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `DESHELL_API_KEY` | *(required)* | Your DeShell API key |
| `DESHELL_PROXY_URL` | `https://proxy.deshell.ai` | Proxy base URL (override for self-hosted) |

## Usage examples

Once installed, you can ask your AI assistant things like:

- *"Fetch https://example.com and summarise it"* → uses `deshell_scrape`
- *"Search the web for the latest Node.js release notes"* → uses `deshell_search`

## Running manually

```bash
DESHELL_API_KEY=dk_your_key npx @deshell/mcp
```

The server speaks [MCP JSON-RPC 2.0](https://modelcontextprotocol.io) over stdio.

## Development

```bash
# Clone the deshell repo
git clone https://github.com/exec-io/deshell.git
cd deshell/mcp

# Run tests (no dependencies needed — uses Node built-ins only)
node --test test.js
```

## License

MIT — see [LICENSE.md](../LICENSE.md) in the repo root.
