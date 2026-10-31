#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { InitApiError, createClient } from "@init-computer/sdk";
import { CLI_VERSION, setupGuest, guestApi, claimGuest, publicCommand } from "./guest.js";

const DEFAULT_BASE_URL = "https://api.init.computer";
const CONFIG_DIR = process.env.INIT_CONFIG_DIR || path.join(os.homedir(), ".init");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const HELP = `
init

Usage:
  init setup --guest --install-cli [--json]
  init usage [--json]
  init job <job-id> [--json]
  init public inspect <slug> [--json]
  init public use <slug> [--json]
  init claim [--wait 60] [--no-open] [--json]
  init login [--api-key init_sk_...] [--base-url https://api.init.computer] [--no-verify]
  init logout
  init auth status
	init generate "create a lead finder api" [--project Sales] [--json]
	init project generate "build a support suite" [--name Support]
	init project edit <project-id> "add ticket assignment"
	init project apply <directory|init.json> "add ticket assignment" [--name Support]
  init run <route|url> --data key=value [--body body.json] [--version 1]
  init resources [--q search] [--status enabled]
  init resource <id>
  init packages [--category Storage] [--enabled-category Database]

Auth:
  Run init setup --guest to start a metered trial without signup.
  Run init login to save an API key locally.
  You can also set INIT_API_KEY, or pass --api-key.

Global options:
  --api-key <key>       Init API key
  --base-url <url>      API origin, defaults to https://api.init.computer
  --json                Print compact JSON
  --pretty              Print pretty JSON, default
`;

main().catch((error) => {
  if (error instanceof InitApiError) {
    printError(error.message, error.status, error.details ?? error.response);
  } else {
    printError(error?.message || String(error),error?.status,error?.code?{code:error.code,claimCommand:'init claim'}:undefined);
  }
  process.exit(1);
});

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed.positionals[0];
  if(!command&&parsed.flags.version){console.log(CLI_VERSION);return;}
  const io={readConfig,writeConfig,configDir:CONFIG_DIR,localKey:readLocalEnvApiKey};
  if(command==='setup'){print(await setupGuest(parsed,io),parsed.flags);return;}
  if (!command || parsed.flags.help || parsed.flags.h) {
    console.log(HELP.trim());
    return;
  }

  if (command === "login") {
    print(await login(parsed), parsed.flags);
    return;
  }
  if (command === "logout") {
    print(logout(), parsed.flags);
    return;
  }
  if (command === "auth") {
    const local=auth(parsed);
    const config=readConfig();
    const apiKey=parsed.flags.apiKey||parsed.flags['api-key']||process.env.INIT_API_KEY||readLocalEnvApiKey()||config.apiKey;
    if(apiKey){try{print({...local,...await guestApi({apiKey,baseUrl:local.baseUrl})('/v1/identity')},parsed.flags);}catch(error){print({...local,authenticated:false,status:error.code??'unavailable'},parsed.flags);process.exitCode=1;}}
    else print({...local,status:'disconnected'},parsed.flags);
    return;
  }

  const config = readConfig();
  // Local convenience only: read exactly INIT_API_KEY from the caller's .env.
  // The file is never uploaded, listed, or synchronized.
  const localEnvKey = readLocalEnvApiKey();
  const client = createClient({
    apiKey: parsed.flags.apiKey || parsed.flags["api-key"] || process.env.INIT_API_KEY || localEnvKey || config.apiKey,
    baseUrl: parsed.flags.baseUrl || parsed.flags["base-url"] || process.env.INIT_API_BASE_URL || config.baseUrl,
  });
  const options={apiKey:parsed.flags.apiKey||parsed.flags['api-key']||process.env.INIT_API_KEY||localEnvKey||config.apiKey,baseUrl:parsed.flags.baseUrl||parsed.flags['base-url']||process.env.INIT_API_BASE_URL||config.baseUrl};
  if(command==='usage'){print(await guestApi(options)('/v1/usage'),parsed.flags);return;}
  if(command==='job'){const id=parsed.positionals[1];if(!/^[0-9a-f-]{36}$/i.test(id??''))throw new Error('job requires a job ID.');print(await guestApi(options)(`/v1/worker/${id}`),parsed.flags);return;}
  if(command==='claim'){print(await claimGuest(parsed,io,options),parsed.flags);return;}
  if(command==='public'){print(await publicCommand(parsed,options),parsed.flags);return;}

  let result;
  switch (command) {
    case "generate":
      result = await generate(client, parsed);
      break;
		case "project":
			result = await project(client, parsed);
			break;
    case "run":
      result = await run(client, parsed);
      break;
    case "resources":
      result = await client.resource.list(queryFromFlags(parsed.flags));
      break;
    case "resource":
      result = await resource(client, parsed);
      break;
    case "directories":
      result = await client.directory.list(queryFromFlags(parsed.flags));
      break;
    case "directory":
      result = await directory(client, parsed);
      break;
    case "daemons":
      result = await client.daemon.list(queryFromFlags(parsed.flags));
      break;
    case "daemon":
      result = await daemon(client, parsed);
      break;
    case "packages":
      result = await client.pkg.list(queryFromFlags(parsed.flags));
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }

  print(result, parsed.flags);
}

async function login(parsed) {
  const apiKey = parsed.flags.apiKey || parsed.flags["api-key"] || await promptHidden("Init API key: ");
  if (!apiKey || apiKey === true) {
    throw new Error("login requires an API key.");
  }
  const baseUrl = parsed.flags.baseUrl || parsed.flags["base-url"] || process.env.INIT_API_BASE_URL || DEFAULT_BASE_URL;
  const client = createClient({ apiKey, baseUrl });
  if (!parsed.flags.noVerify && !parsed.flags["no-verify"]) {
    await client.pkg.list();
  }
  writeConfig({ apiKey: String(apiKey), baseUrl: String(baseUrl) });
  return {
    success: true,
    message: "Logged in. API key saved for future init commands.",
    configFile: CONFIG_FILE,
    baseUrl,
  };
}

function logout() {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.rmSync(CONFIG_FILE);
  }
  return {
    success: true,
    message: "Logged out. Saved init credentials removed.",
    configFile: CONFIG_FILE,
  };
}

function auth(parsed) {
  const action = parsed.positionals[1];
  if (action !== "status") {
    throw new Error("Unknown auth action. Try: init auth status");
  }
  const config = readConfig();
  const envKey = Boolean(process.env.INIT_API_KEY);
  const localEnvKey = Boolean(readLocalEnvApiKey());
  const flagKey = Boolean(parsed.flags.apiKey || parsed.flags["api-key"]);
  const configKey = Boolean(config.apiKey);
  return {
    authenticated: flagKey || envKey || localEnvKey || configKey,
    source: flagKey ? "flag" : envKey ? "env" : localEnvKey ? "local_env" : configKey ? "config" : null,
    configFile: CONFIG_FILE,
    baseUrl: parsed.flags.baseUrl || parsed.flags["base-url"] || process.env.INIT_API_BASE_URL || config.baseUrl || DEFAULT_BASE_URL,
  };
}

function readLocalEnvApiKey() {
  const envPath = path.join(process.cwd(), ".env");
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?INIT_API_KEY\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const key = match[1].replace(/^(["'])(.*)\1$/, "$2").trim();
      if (key) return key;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return undefined;
}

async function generate(client, parsed) {
  const prompt = parsed.positionals.slice(1).join(" ").trim();
  const body = await bodyFromFlags(parsed.flags);
	const projects = collectFlag(parsed.flags.project ?? parsed.flags.projects ?? parsed.flags.directory ?? parsed.flags.directories);
  return client.generate({
    ...(body || {}),
    ...(prompt ? { prompt } : {}),
		...(projects.length ? { projects } : {}),
    ...(parsed.flags.resourceId || parsed.flags["resource-id"]
      ? { resource_id: parsed.flags.resourceId || parsed.flags["resource-id"] }
      : {}),
  });
}

async function project(client, parsed) {
  const action = parsed.positionals[1];
  if (action === "generate") {
    const prompt = parsed.positionals.slice(2).join(" ").trim();
    if (!prompt) throw new Error("project generate requires a prompt.");
    return client.project.generate({ prompt, ...(parsed.flags.name ? { name: String(parsed.flags.name) } : {}), ...(parsed.flags.description ? { description: String(parsed.flags.description) } : {}) });
  }
  if (action === "edit") {
    const projectId = parsed.positionals[2];
    const prompt = parsed.positionals.slice(3).join(" ").trim();
    if (!projectId || !prompt) throw new Error("project edit requires a project id and prompt.");
    return client.project.edit(projectId, { prompt });
  }
  if (action === "apply") {
    const target = parsed.positionals[2];
    const prompt = parsed.positionals.slice(3).join(" ").trim();
    if (!target || !prompt) throw new Error("project apply requires an init.json path or directory and a change request.");
    const file = resolveInitJsonPath(target);
    let result;
    if (fs.existsSync(file)) {
      const manifest = JSON.parse(stripBom(fs.readFileSync(file, "utf8")));
      result = await client.project.applyInitJson(manifest, { prompt });
    } else {
      const created = await client.project.generate({ prompt, ...(parsed.flags.name ? { name: String(parsed.flags.name) } : {}) });
      const projectId = created?.project?.id;
      if (!projectId) throw new Error("Init did not return a project ID.");
      result = { result: created, initJson: await client.project.toInitJson(projectId) };
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(result.initJson, null, 2)}\n`, "utf8");
    return { ...result.result, initJsonPath: file, initJsonUpdated: true };
  }
  throw new Error("Unknown project action. Try: init project generate, init project edit, or init project apply");
}

function resolveInitJsonPath(target) {
  const resolved = path.resolve(target);
  return path.extname(resolved).toLowerCase() === ".json" ? resolved : path.join(resolved, "init.json");
}

async function run(client, parsed) {
  const route = parsed.positionals[1];
  if (!route) throw new Error("run requires a route or URL.");
  const body = (await bodyFromFlags(parsed.flags)) || {};
  const data = dataFromFlags(parsed.flags.data);
  const daemon = daemonFlags(parsed.flags);
  return client.run(route, { ...body, ...data, ...daemon, ...(parsed.flags.mode?{mode:String(parsed.flags.mode)}:{}) }, {
    version: numberFlag(parsed.flags.version),
    requestFormat: parsed.flags.requestFormat || parsed.flags["request-format"],
  });
}

async function resource(client, parsed) {
  const id = parsed.positionals[1];
  const action = parsed.positionals[2];
  if (!id) throw new Error("resource requires an id.");
  if (!action) return client.resource.get(id);
  if (action === "versions") return client.resource.versions(id);
  if (action === "activate") {
    const versionId = parsed.positionals[3] || parsed.flags.versionId || parsed.flags["version-id"];
    if (!versionId) throw new Error("resource activate requires a version id.");
    return client.resource.activateVersion(id, versionId);
  }
  if (action === "update") {
    const patch = (await bodyFromFlags(parsed.flags)) || dataFromFlags(parsed.flags.data);
    return client.resource.update(id, patch);
  }
  throw new Error(`Unknown resource action: ${action}`);
}

async function directory(client, parsed) {
  const action = parsed.positionals[1];
  const idOrName = parsed.positionals[2];
  if (action === "create") {
    if (!idOrName) throw new Error("directory create requires a name.");
    return client.directory.create({
      name: idOrName,
      description: parsed.flags.description || "",
    });
  }
  if (!idOrName) throw new Error("directory action requires an id.");
  if (action === "get") return client.directory.get(idOrName);
  if (action === "update") return client.directory.update(idOrName, (await bodyFromFlags(parsed.flags)) || dataFromFlags(parsed.flags.data));
  if (action === "delete") return client.directory.delete(idOrName);
  if (action === "add") return client.directory.addResources(idOrName, collectFlag(parsed.flags.resource || parsed.flags.resources));
  if (action === "remove") return client.directory.removeResource(idOrName, parsed.positionals[3]);
  throw new Error(`Unknown directory action: ${action}`);
}

async function daemon(client, parsed) {
  const action = parsed.positionals[1];
  const id = parsed.positionals[2];
  if (!id) throw new Error("daemon action requires an id.");
  if (action === "get") return client.daemon.get(id);
  if (action === "pause") return client.daemon.pause(id);
  if (action === "resume") return client.daemon.resume(id);
  if (action === "stop") return client.daemon.stop(id);
  if (action === "run") return client.daemon.run(id);
  throw new Error(`Unknown daemon action: ${action}`);
}

function parseArgs(args) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const raw = token.slice(2);
    const [key, inline] = raw.split("=", 2);
    const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = inline ?? (args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : true);
    flags[key] = append(flags[key], value);
    if (camelKey !== key) {
      flags[camelKey] = append(flags[camelKey], value);
    }
  }
  return { flags, positionals };
}

async function bodyFromFlags(flags) {
  const body = flags.body || flags.b;
  if (!body) return undefined;
  if (body === "-") return JSON.parse(stripBom(await readStdin()));
  const bodyText = String(body);
  if (bodyText.startsWith("@")) return JSON.parse(stripBom(fs.readFileSync(path.resolve(bodyText.slice(1)), "utf8")));
  if (fs.existsSync(bodyText)) return JSON.parse(stripBom(fs.readFileSync(path.resolve(bodyText), "utf8")));
  return JSON.parse(bodyText);
}

function dataFromFlags(value) {
  const result = {};
  for (const entry of collectFlag(value)) {
    const index = entry.indexOf("=");
    if (index === -1) continue;
    result[entry.slice(0, index)] = parseScalar(entry.slice(index + 1));
  }
  return result;
}

function queryFromFlags(flags) {
  const ignored = new Set([
    "apiKey",
    "api-key",
    "baseUrl",
    "base-url",
    "json",
    "pretty",
    "body",
    "b",
    "noVerify",
    "no-verify",
    "daemon",
    "intervalSeconds",
    "interval-seconds",
    "maxRuns",
    "max-runs",
    "requestFormat",
    "request-format",
    "version",
  ]);
  return Object.fromEntries(Object.entries(flags).filter(([key]) => !ignored.has(key)));
}

function collectFlag(value) {
  if (value === undefined || value === true) return [];
  return Array.isArray(value) ? value.flatMap(collectFlag) : String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function append(existing, value) {
  if (existing === undefined) return value;
  return Array.isArray(existing) ? [...existing, value] : [existing, value];
}

function parseScalar(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function numberFlag(value) {
  if (value === undefined || value === true) return undefined;
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function daemonFlags(flags) {
  if (!flags.daemon) return {};
  return {
    daemon: true,
    ...(numberFlag(flags.intervalSeconds || flags["interval-seconds"]) !== undefined
      ? { interval_seconds: numberFlag(flags.intervalSeconds || flags["interval-seconds"]) }
      : {}),
    ...(numberFlag(flags.maxRuns || flags["max-runs"]) !== undefined
      ? { max_runs: numberFlag(flags.maxRuns || flags["max-runs"]) }
      : {}),
  };
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { text += chunk; });
    process.stdin.on("end", () => resolve(text));
    process.stdin.on("error", reject);
  });
}

function stripBom(value) {
  return String(value).replace(/^\uFEFF/, "");
}

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode:0o700 });
  const temp=`${CONFIG_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp,CONFIG_FILE);
  fs.chmodSync(CONFIG_FILE,0o600);
}

function promptHidden(prompt) {
  if (!process.stdin.isTTY) {
    return readStdin().then((value) => value.trim());
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl.stdoutMuted = true;
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
    rl._writeToOutput = function writeToOutput(value) {
      if (rl.stdoutMuted) {
        if (value.includes(prompt)) {
          rl.output.write(value);
        }
        return;
      }
      rl.output.write(value);
    };
  });
}

function print(value, flags) {
  const compact = flags.json && !flags.pretty;
  console.log(JSON.stringify(value, null, compact ? 0 : 2));
}

function printError(message, status, details) {
  const payload = {
    success: false,
    error: statusMessage(status, message),
    ...(status ? { status } : {}),
    ...(details ? { details } : {}),
  };
  console.error(JSON.stringify(payload, null, 2));
}

function statusMessage(status, fallback) {
  if (status === 402) {
    return "Payment required. Upgrade your Init plan or enable overages to continue.";
  }
  if (status === 429) {
    return "Rate limit exceeded. Too many concurrent requests are running.";
  }
  if (status === 500) {
    return "Internal server error. Please try again later.";
  }
  if (status === 503) {
    return "Service temporarily unavailable. Please try again later.";
  }
  return fallback;
}
