<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/init-lockup-on-dark.svg">
    <img alt="Init" src=".github/assets/init-lockup.svg" height="64">
  </picture>
</p>

<p align="center"><b>Describe it. Init runs it.</b><br>The backend engineer for your coding agent.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@init-computer/cli"><img alt="CLI" src="https://img.shields.io/npm/v/@init-computer/cli?label=cli&color=FF4D1A"></a>
  <a href="https://www.npmjs.com/package/@init-computer/sdk"><img alt="SDK" src="https://img.shields.io/npm/v/@init-computer/sdk?label=sdk&color=FF4D1A"></a>
  <a href="https://www.npmjs.com/package/@init-computer/mcp"><img alt="MCP" src="https://img.shields.io/npm/v/@init-computer/mcp?label=mcp&color=FF4D1A"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-0E0E10"></a>
</p>

---

Describe an endpoint in plain English. Init ships it as a live, typed, versioned HTTPS API in seconds, with auth and secrets handled. An endpoint can combine LLM reasoning, web search and scraping, document processing, image, video and voice generation, email, maps, a database, file storage, compute and scheduled jobs.

This repo holds Init's open-source clients:

| Package | What it does |
|---|---|
| [`@init-computer/cli`](packages/cli) | `init` in your terminal, scripts and CI |
| [`@init-computer/sdk`](packages/sdk) | JavaScript client for Node.js 18+ |
| [`@init-computer/mcp`](packages/mcp) | MCP server for Claude Code, Cursor, Codex, Windsurf and any MCP client |

## In your coding agent

Install the [agent kit](https://github.com/init-computer/agent-kit), then type:

```
/backend email me the top Hacker News posts every morning
```

Or add the MCP server directly:

```bash
claude mcp add init --env INIT_API_KEY=init_sk_... -- npx -y @init-computer/mcp
```

```json
{
  "mcpServers": {
    "init": {
      "command": "npx",
      "args": ["-y", "@init-computer/mcp"],
      "env": { "INIT_API_KEY": "init_sk_..." }
    }
  }
}
```

## From the terminal

```bash
npm install -g @init-computer/cli
init login
init generate "An API that takes a company website and returns a sales brief with sources"
init run <route> --data website=https://www.snowflake.com
```

Get an API key at [init.computer](https://www.init.computer/sign-up?utm_source=github&utm_medium=init). See the [CLI reference](packages/cli#readme).

## From code

```js
import { createClient } from "@init-computer/sdk";

const init = createClient(); // reads INIT_API_KEY

const api = await init.generate({
  prompt: "Extract line items, totals and the due date from an invoice PDF",
});

const result = await init.run(api.url, { fileUrl: "https://example.com/invoice.pdf" });
```

See the [SDK reference](packages/sdk#readme).

## Examples

[init-computer/examples](https://github.com/init-computer/examples) has runnable examples and starter templates. You can also generate and version endpoints in CI with [init-action](https://github.com/init-computer/init-action), or use the [Vercel AI SDK and n8n integrations](https://github.com/init-computer/integrations).

## Built with Init

```md
[![Built with Init](https://raw.githubusercontent.com/init-computer/init/main/.github/assets/built-with-init-light.svg)](https://www.init.computer/?utm_source=badge)
```

[![Built with Init](.github/assets/built-with-init-light.svg)](https://www.init.computer/?utm_source=badge)

## Development

```bash
npm install
npm test        # pack checks plus CLI, SDK and MCP smoke tests
```

The packages are npm workspaces. Releases are tagged `cli-v*`, `sdk-v*` or `mcp-v*`, and CI publishes them to npm with provenance. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). The Init service has its own [terms](https://www.init.computer/terms).
