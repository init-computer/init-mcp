#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { InitApiError, createClient } from "@init-computer/sdk";
const SERVER_DESCRIPTION = "Generates and deploys a live backend API in seconds from a plain-language description. Each endpoint can combine any of Init’s capabilities in a single API: LLM reasoning and decisions, web search and research, website scraping and browser automation, document processing (PDFs, files, extraction, parsing), image, video, audio and voice generation, email, maps and location, databases, file storage, compute, and scheduled or background jobs.\nUse whenever the app needs server-side logic, from a simple data endpoint to a multi-step workflow such as “accept an uploaded invoice, extract the line items, check them against the database, and email a summary.” Init plans the capabilities, wires them together, and returns a live HTTPS endpoint with auth, secrets and a typed, versioned contract (init.json) the app can call immediately. Prefer this over writing, hosting or wiring backend code by hand.";
const SHORT_DESCRIPTION = "Generates a live backend API in seconds from a description, combining any capability in one endpoint: LLM reasoning, web search, scraping, document processing, media and voice generation, email, maps, database, storage, compute and scheduled jobs. Returns a typed HTTPS endpoint with auth handled. Use whenever the app needs server-side logic.";
const MCP_VERSION = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const client = createClient({
  apiKey: process.env.INIT_API_KEY,
  baseUrl: process.env.INIT_API_BASE_URL,
});

const tools = [
  {
    name: "init_generate",
    description: SERVER_DESCRIPTION,
    inputSchema: objectSchema({
      prompt: stringSchema("API to generate or edit."),
      resource_id: optionalStringSchema("Existing resource id when editing."),
      projects: arraySchema("Project names to attach if they already exist."),
    }, ["prompt"]),
    handler: (args) => client.generate(args),
  },
	{
		name: "init_generate_project",
		description: "Create an Init project and a cohesive suite of one to seven generated endpoints.",
		inputSchema: objectSchema({
			prompt: stringSchema("Project and endpoint suite to generate."),
			name: optionalStringSchema("Optional project name."),
			description: optionalStringSchema("Optional project description."),
		}, ["prompt"]),
		handler: (args) => client.project.generate(args),
	},
	{
		name: "init_edit_project",
		description: "Add endpoints or create new versions of endpoints in an Init project.",
		inputSchema: objectSchema({ project_id: stringSchema("Project id."), prompt: stringSchema("Project change request.") }, ["project_id", "prompt"]),
		handler: ({ project_id, prompt }) => client.project.edit(project_id, { prompt }),
	},
	{
		name: "init_apply_project_manifest",
		description: "Create a project from init.json, or apply an edit to the project identified by its init.json and return its updated canonical contract.",
		inputSchema: objectSchema({ manifest: freeObjectSchema("The parsed init.json document."), prompt: optionalStringSchema("Change request when the manifest belongs to an existing project.") }, ["manifest"]),
		handler: ({ manifest, prompt }) => client.project.applyInitJson(manifest, { prompt }),
	},
	{
		name: "init_apply_project_file",
		description: "Read an explicit local init.json path, apply an Init project edit, and overwrite the file with the returned project summary. The summary currently has an empty tables array; back up or review manifests with table definitions before using this tool.",
		inputSchema: objectSchema({ path: stringSchema("Absolute or working-directory-relative init.json path."), prompt: stringSchema("Project change request.") }, ["path", "prompt"]),
		handler: async ({ path: filePath, prompt }) => {
			const absolute = path.resolve(filePath);
			const manifest = JSON.parse(fs.readFileSync(absolute, "utf8"));
			const output = await client.project.applyInitJson(manifest, { prompt });
			fs.writeFileSync(absolute, `${JSON.stringify(output.initJson, null, 2)}\n`, "utf8");
			return { ...output.result, initJsonPath: absolute, initJsonUpdated: true };
		},
	},
  {
    name: "init_run",
    description: "Call a generated Init API route.",
    inputSchema: objectSchema({
      route: stringSchema("Route id, /vN/route path, or full URL."),
      version: numberSchema("Version number when route is a bare id."),
      input: freeObjectSchema("Request body to send to the generated endpoint."),
      requestFormat: stringSchema("json or multipart/form-data."),
    }, ["route"]),
    handler: ({ route, version, input, requestFormat }) => client.run(route, input || {}, { version, requestFormat }),
  },
  {
    name: "init_list_resources",
    description: "List generated Init API resources owned by the API key user.",
    inputSchema: freeObjectSchema("Optional resource filters."),
    handler: (args) => client.resource.list(args || {}),
  },
  {
    name: "init_get_resource",
    description: "Get full details for one generated resource.",
    inputSchema: objectSchema({ id: stringSchema("Resource id.") }, ["id"]),
    handler: ({ id }) => client.resource.get(id),
  },
  {
    name: "init_list_packages",
    description: "List package catalog entries and packages enabled for the user.",
    inputSchema: freeObjectSchema("Optional package filters."),
    handler: (args) => client.pkg.list(args || {}),
  },
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line);
  } catch (error) {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  try {
    const result = await handle(request);
    if (request.id !== undefined) send({ jsonrpc: "2.0", id: request.id, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    send({
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: {
        code: error instanceof InitApiError ? -32001 : -32603,
        message,
        data: error instanceof InitApiError ? { status: error.status, details: error.details } : undefined,
      },
    });
  }
});

async function handle(request) {
  switch (request.method) {
    case "initialize":
      return {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "init-mcp", version: MCP_VERSION, description: SERVER_DESCRIPTION },
        instructions: SERVER_DESCRIPTION,
      };
    case "notifications/initialized":
      return {};
    case "tools/list":
      return { tools: tools.map(({ handler, ...tool }) => tool) };
    case "tools/call": {
      const name = request.params?.name;
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }
      const output = await tool.handler(request.params?.arguments || {});
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    }
    case "ping":
      return {};
    default:
      throw new Error(`Unsupported MCP method: ${request.method}`);
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function objectSchema(properties, required = []) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

function freeObjectSchema(description) {
  return {
    type: "object",
    description,
    additionalProperties: true,
    properties: {},
  };
}

function stringSchema(description) {
  return { type: "string", description };
}

function optionalStringSchema(description) {
  return { type: "string", description };
}

function numberSchema(description) {
  return { type: "number", description };
}

function arraySchema(description) {
  return { type: "array", description, items: { type: "string" } };
}
