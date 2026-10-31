# Init CLI

Generate, deploy, and run backend endpoints from your terminal.

Init is a programmable backend platform. Describe the capability you need, and Init creates and operates the API, data, storage, and runtime behind it.

The `init` command brings that to terminal workflows, scripts, CI jobs, and local debugging. Use it to deploy endpoints, run them, edit versions, manage resources, and hand your backend to other AI agents.

Requires Node.js 18 or later. [Docs](https://www.init.computer/docs#cli) · [SDK](https://www.npmjs.com/package/@init-computer/sdk) · [MCP](https://www.init.computer/mcp) · [Pricing](https://www.init.computer/pricing).

Start with the free plan. An account and API key are required; usage limits apply and projects require a paid plan.

## Install

```bash
npm install -g @init-computer/cli
```

## Authenticate

Create an account at [init.computer](https://init.computer) to get an API key, then log in:

```bash
init login --api-key init_sk_...
```

Or run `init login` with no flag to paste the key interactively.

Check or clear your session:

```bash
init auth status
init logout
```

The CLI saves credentials to `~/.init/config.json`. Treat that file like a secret.

### CI, scripts, and servers

Set `INIT_API_KEY` instead of logging in:

```bash
export INIT_API_KEY=init_sk_...
```

For local development, the CLI also reads `INIT_API_KEY` from a `.env` file in the current directory. It checks an explicit flag first, then the process environment, then `.env`. It reads that one key only and never uploads, lists, or syncs `.env` files.

## Quickstart

From a prompt to a live, callable endpoint in three steps.

1. Generate an endpoint from a prompt.
2. Save the `resourceId` and `route` from the response.
3. Call the endpoint with `init run`.

```bash
init generate "Create a lead enrichment API. Input: companyName, website, targetPersona. Output: companySummary, buyingSignals, nextSteps. Return structured JSON only."

init run abc123 \
  --data companyName=Snowflake \
  --data website=https://www.snowflake.com \
  --data targetPersona="VP Sales"
```

## Generate an endpoint

`init generate` creates a deployed backend endpoint from a prompt.

```bash
init generate "Create a lead enrichment API. Input fields: companyName, website, targetPersona. Output fields: companySummary, buyingSignals, recommendedPersonas, nextSteps. Research the company and return structured JSON only."
```

For long prompts, pass a JSON request body:

```bash
init generate --body request.json
```

```json
{
  "prompt": "Create a lead enrichment API for B2B sales teams. Input fields: companyName string required, website url required, targetPersona string optional. Output fields: companySummary string, buyingSignals array with title evidence urgency, recommendedPersonas array with role reason outreachAngle, nextSteps array of strings. Store each generated brief and return structured JSON only.",
  "projects": ["Sales"]
}
```

### What you get back

| Field | Use it to |
| --- | --- |
| `url`, `route` | Run the deployed endpoint |
| `resourceId` | Inspect, edit, organize, or version the endpoint |
| `versionId` | Identify this version of the endpoint |
| Input and output schema | See what the endpoint accepts and returns |
| Generated pipeline | See the steps the endpoint runs |

Save the `resourceId` if you plan to change the endpoint later.

## Run an endpoint

`init run` calls a generated endpoint. Use the `route` or full `url`, not the `resourceId`.

### By route

```bash
init run abc123 --data companyName=Snowflake --data website=https://www.snowflake.com --data targetPersona="VP Sales"
```

### By URL

```bash
init run https://api.init.computer/v1/abc123 --body input.json
```

### From stdin

```bash
cat input.json | init run abc123 --body -
```

## Edit an endpoint

Pass the endpoint's `resourceId` to `init generate`. Init keeps the same resource and creates a new version.

```bash
init generate "Keep the same behavior, but add csv and confidenceScore outputs." --resource-id resource_uuid
```

## Projects

A project is a suite of related endpoints. You can create and edit the whole suite from a prompt, instead of building one endpoint at a time.

### Create a suite

```bash
init project generate "Build ticket intake and status lookup" --name "Customer Support"
```

### Edit a suite

```bash
init project edit <project-id> "Add ticket assignment"
```

You can also add a single endpoint to a project when you generate it, with the `projects` field in the request body (see [Generate an endpoint](#generate-an-endpoint)).

## Use with AI agents

An Init project can be exported as an `init.json` specification. It describes the project's endpoints in a form other AI agents can read.

To let an agent use your backend:

1. Generate your endpoints or project.
2. Give the agent your `init.json`.
3. The agent calls your endpoints with your API key.

Agents call your deployed endpoints with an API key. Use a key you can revoke, and keep it out of prompts and shared files.

## Send files

The CLI's `--body` option reads JSON; it does not upload local files as multipart data. For file inputs, use the JavaScript SDK with `FormData`, or send a multipart HTTP request directly. See the [SDK guide](https://www.init.computer/docs#sdk).

## Manage resources

A resource is an API you have generated.

```bash
init resources
init resources --q lead --status enabled
init resource resource_uuid
init resource resource_uuid versions
init resource resource_uuid activate version_uuid
init resource resource_uuid update --body patch.json
```

Example `patch.json`:

```json
{
  "name": "Lead Enrichment",
  "status": "enabled"
}
```

## Commands

| Command | What it does |
| --- | --- |
| `init login` | Save an API key (`--api-key` or interactive) |
| `init logout` | Clear saved credentials |
| `init auth status` | Show current authentication |
| `init generate` | Create an endpoint, or a new version with `--resource-id` |
| `init run` | Call an endpoint by route or URL |
| `init resources` | List endpoints; filter with `--q` and `--status` |
| `init resource` | Inspect one endpoint; subcommands `versions`, `activate`, `update` |
| `init project generate` | Generate a project suite |
| `init project edit` | Extend an existing project |

### Run flags

| Flag | Purpose |
| --- | --- |
| `--data key=value` | Set an input field. Repeat for more fields. |
| `--body <path\|->` | Send JSON from a file or stdin with `-` |

## Global options

| Option | Purpose |
| --- | --- |
| `--api-key <key>` | Use an API key without saving it |
| `--base-url <url>` | API origin. Defaults to `https://api.init.computer` |
| `--json` | Print compact JSON |
| `--pretty` | Print pretty JSON |

## Environment variables

| Variable | Purpose |
| --- | --- |
| `INIT_API_KEY` | API key for CI or server use |
| `INIT_API_BASE_URL` | API origin override |
| `INIT_CONFIG_DIR` | Where credentials are saved. Defaults to `~/.init` |

## Output

The CLI prints pretty JSON by default. Use `--json` for compact output in scripts:

```bash
init resources --json
```

## Errors

Failed requests print JSON with `success: false`, `error`, and `status`.

| Status | Meaning | What to do |
| --- | --- | --- |
| `402` | Plan limit reached | Upgrade your plan or enable overages |
| `429` | Too many concurrent requests | Retry after current runs finish |
| `500` | Internal server error. The public response is intentionally broad. | Retry; contact support if it persists |
| `503` | Init is temporarily unavailable | Retry shortly |

## Keep repository init.json current

Run this from a repository root to create a project and write its canonical contract into that repository:

```bash
init project apply . "Build customer ticket intake and a ticket status endpoint" --name "Customer support"
```

When `init.json` exists, Init reads `project.id`, applies the requested edit to that same project, then writes the updated contract back to the same file:

```bash
init project apply ./init.json "Add ticket assignment and include the assigned team in status results"
```

The CLI reads only `INIT_API_KEY` from the local process environment or local `.env`; it never uploads `.env` contents. An explicit `--api-key` takes precedence.
# Signup-free trial

```sh
npx --yes --package=@init-computer/cli@0.1.9 init setup --guest --install-cli --json
init usage --json
init public inspect <slug> --json
init public use <slug> --json
init run <returned-private-url> --data field=value --json
```

Setup installs and connects the CLI without browser login. It saves private local credentials, reuses an existing connection and never resets a trial. A guest workspace includes 100 executions, 50K combined metered tokens and $0.25 provider cost once, and expires after 30 days. Text, structured data, search and bounded jobs are supported. Availability depends on the platform's guest feature setting.

For background calls use `init run <url> --mode async ...`, then `init job <job-id> --json`. Schedules use `--daemon --interval-seconds 3600 --max-runs 10`; runs share the trial allowance. Run `init claim --wait 60 --json` to sign up, confirm ownership in the browser and add credit. Claiming preserves endpoints, records and usage. Keep local credentials out of chat, source control and browser code.
