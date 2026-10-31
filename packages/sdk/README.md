# Init SDK

The official JavaScript SDK for Init. Describe a backend capability, get a deployed endpoint with a stable route and schema, then run or version it from your application.

Init provides the generated API plus the data, storage, runtime, package connections, and version history behind it.

[Documentation](https://www.init.computer/docs#sdk) · [CLI](https://www.npmjs.com/package/@init-computer/cli) · [MCP](https://www.init.computer/mcp) · [Pricing](https://www.init.computer/pricing)

Start with the free plan. An account and API key are required; usage limits apply and projects require a paid plan.

## Install

```bash
npm install @init-computer/sdk
```

Requires Node.js 18 or a runtime with `fetch`.

## Authenticate

The SDK uses `INIT_API_KEY` and `INIT_API_BASE_URL` when present:

```bash
export INIT_API_KEY=init_sk_...
```

```js
import { createClient } from "@init-computer/sdk";

const init = createClient();
```

Pass credentials explicitly when configuration is not process-based:

```js
const init = createClient({
  apiKey: process.env.INIT_API_KEY,
  baseUrl: "https://api.init.computer",
});
```

Keep API keys server-side and use a revocable key for CI or agents.

## Generate an endpoint

```js
const api = await init.generate({
  prompt: `Create a lead enrichment API.

Input fields: companyName string required, website url required, targetPersona string optional.
Output fields: companySummary string, buyingSignals array, recommendedPersonas array, nextSteps array.
Return structured JSON only.`,
});

console.log(api.url, api.route, api.resourceId, api.versionId);
console.log(api.inputStructure, api.outputStructure);
```

Use `resource_id` in a generation request to create a new version of an existing endpoint while keeping its resource identity.

## Projects

Projects group related endpoints:

```js
const project = await init.project.generate({
  name: "Customer Support",
  prompt: "Build ticket intake and status lookup.",
});

await init.project.edit(project.project.id, {
  prompt: "Add ticket assignment and a status lookup endpoint.",
});
```

Attach a generated endpoint to existing projects with the `projects` field in the generation request.

## Run an endpoint

Use the returned URL or route. A bare route uses version 1 by default:

```js
const result = await init.run(api.url, {
  companyName: "Snowflake",
  website: "https://www.snowflake.com",
  targetPersona: "VP Sales",
});

console.log(result);
```

Select a version explicitly:

```js
await init.run("abc123", { topic: "fintech" }, { version: 2 });
```

For multipart endpoints, pass `FormData`; the SDK preserves it and does not JSON-encode the form:

```js
const form = new FormData();
form.append("file", reportFile);
form.append("summaryStyle", "executive");
await init.run("quarterly-report-reader", form, { requestFormat: "multipart/form-data" });
```

## Edit and manage resources

```js
const edited = await init.resource.update(api.resourceId, { name: "Lead Enrichment" });
const versions = await init.resource.versions(api.resourceId);
await init.resource.activateVersion(api.resourceId, "version_uuid");
const resources = await init.resource.list({ q: "lead", status: "enabled" });
```

For a prompt-driven edit, call `init.generate({ resource_id: api.resourceId, prompt: "..." })`.

## Discover packages

Packages expose the runtime capabilities available to generated endpoints:

```js
const databases = await init.pkg.list({ category: "Database" });
const storage = await init.pkg.list({ category: "Storage" });
```

Package rows include `primitiveMetanames`, `runtimeAdapter`, and `runtimeBaseUrl`. Use those fields to distinguish executable integrations from catalog entries that still require a provider-specific transport.

## Errors

Failed calls throw `InitApiError`:

```js
import { InitApiError } from "@init-computer/sdk";

try {
  await init.run("missing-route", {});
} catch (error) {
  if (error instanceof InitApiError) {
    console.error(error.status, error.message, error.details);
  }
}
```

Common statuses are `402` (plan limit), `429` (concurrency), `500` (server error), and `503` (temporarily unavailable).

## Apply an init.json contract

The SDK accepts a parsed `init.json`. A manifest with a project ID and a prompt edits that project; otherwise it imports a project. The returned `initJson` is a project summary built from endpoint records: its `tables` array is currently empty. Review it before replacing a manifest that contains table definitions.

```js
const manifest = JSON.parse(await fs.promises.readFile("init.json", "utf8"));
const applied = await init.project.applyInitJson(manifest, {
  prompt: "Add ticket assignment and expose the assigned team in status results",
});
await fs.promises.writeFile("init.json", JSON.stringify(applied.initJson, null, 2) + "\n");
```
