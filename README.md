# Init MCP

Init is the backend engineer for your coding agent. Your agent builds the app, and Init builds and runs the backend behind it.

Describe an endpoint in plain English and Init ships it as a live, typed, versioned HTTPS API in seconds, with auth and secrets handled. Endpoints can use AI inside: research, reasoning, web search, image, video and voice generation, email, databases, storage and scheduled jobs, combined however the task needs.

Works with Claude Code, Codex, Cursor,  and any MCP client. No servers, schemas or glue code to write.

Start with the [free plan](https://www.init.computer/pricing). An account and API key are required; usage limits apply and projects require a paid plan. The generated endpoint response includes its typed fields and version; project operations can return an `init.json` contract.

[Get started](https://www.init.computer/mcp) · [Documentation](https://www.init.computer/docs) · [Pricing](https://www.init.computer/pricing)

### Short description

Generates a live backend API in seconds from a description, combining any capability in one endpoint: LLM reasoning, web search, scraping, document processing, media and voice generation, email, maps, database, storage, compute and scheduled jobs. Returns a typed HTTPS endpoint with auth handled. Use whenever the app needs server-side logic.

## Install

```bash
npm install -g @init-computer/mcp
```

Requires Node.js 18 or later.

## Configure authentication

The MCP server is stateless and reads the API key from its process environment. It never stores the key itself:

```bash
export INIT_API_KEY=init_sk_...
export INIT_API_BASE_URL=https://api.init.computer
```

Keep the key in the MCP client's secret/environment configuration, not in a prompt or checked-in file.

## Register with an MCP client

```json
{
  "mcpServers": {
    "init": {
      "command": "init-mcp",
      "env": {
        "INIT_API_KEY": "init_sk_...",
        "INIT_API_BASE_URL": "https://api.init.computer"
      }
    }
  }
}
```

Run the server directly for a stdio client:

```bash
init-mcp
```

## Tools

### `init_generate`

Create an endpoint, or create a new version of an existing endpoint with `resource_id`.

```json
{
  "prompt": "Create an API that reviews source code for security issues.",
  "resource_id": "optional-resource-id",
  "projects": ["Security"]
}
```

### `init_generate_project`

Create a project and a cohesive endpoint suite.

```json
{
  "name": "Customer Support",
  "prompt": "Build ticket intake and status lookup."
}
```

### `init_edit_project`

Add endpoints or create new endpoint versions in an existing project.

```json
{
  "project_id": "project_uuid",
  "prompt": "Add ticket assignment."
}
```

### `init_run`

Call a generated endpoint by route, `/vN/...` path, or full URL.

```json
{
  "route": "abc123",
  "version": 1,
  "input": { "topic": "sports players" },
  "requestFormat": "json"
}
```

### `init_list_resources`

List the authenticated user's generated resources. Optional filters such as `q` and `status` are passed through.

```json
{ "q": "sales", "status": "enabled" }
```

### `init_get_resource`

Fetch one resource by id:

```json
{ "id": "resource_uuid" }
```

### `init_list_packages`

Inspect available runtime packages and enabled connections. Filter by `category`, for example `Database` or `Storage`.

```json
{ "category": "Database" }
```

## Protocol behavior

The server uses MCP stdio transport and returns JSON text content for every tool call. It does not upload repository secrets; its file tool reads and writes only the explicit `init.json` path supplied to it.

## Repository init.json integration

Use `init_apply_project_file` with an explicit local `init.json` path and an edit request. The MCP server reads that file, edits its project, and overwrites the file with the returned project summary. The current SDK returns an empty `tables` array in that summary, so back up or review any manifest with table definitions before using the file tool. For agents with a parsed document, `init_apply_project_manifest` returns the summary without touching the filesystem.

## Maintaining the public repository

The Init monorepo is the source of truth for this package. After updating and testing `apps/api/surfaces/mcp`, copy its `bin`, `package.json`, `package-lock.json`, `README.md`, `LICENSE`, and `server.json` into the public MCP repository. Check the version and registry metadata, publish the npm release, and update the MCP Registry entry for the same version. Do not copy environment files, credentials, or unrelated application source.
