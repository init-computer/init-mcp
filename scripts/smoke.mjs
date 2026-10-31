// Offline smoke tests: package contents, CLI help, SDK import, MCP handshake.
import { execFileSync, spawn } from "node:child_process";
import assert from "node:assert/strict";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

for (const name of ["sdk", "cli", "mcp"]) {
	const [pack] = JSON.parse(execFileSync(npm, ["pack", "--dry-run", "--json", "-w", `@init-computer/${name}`], { encoding: "utf8", shell: process.platform === "win32" }));
	const files = pack.files.map((file) => file.path);
	assert.ok(files.includes("LICENSE"), `${name}: LICENSE missing from package`);
	assert.ok(!files.some((file) => /(^|\/)\.env|node_modules/.test(file)), `${name}: unexpected files in package`);
	console.log(`ok ${name} pack (${files.length} files)`);
}

const help = execFileSync(process.execPath, ["packages/cli/bin/init.js", "--help"], { encoding: "utf8" });
assert.match(help, /init generate/);
console.log("ok cli --help");

const sdk = await import("../packages/sdk/dist/index.js");
assert.equal(typeof sdk.createClient, "function");
console.log("ok sdk import");

const tools = await new Promise((resolve, reject) => {
	const child = spawn(process.execPath, ["packages/mcp/bin/init-mcp.js"], { env: { ...process.env, INIT_API_KEY: "init_sk_smoke" } });
	let buffer = "";
	const timer = setTimeout(() => { child.kill(); reject(new Error("MCP handshake timed out")); }, 10000);
	child.stdout.on("data", (chunk) => {
		buffer += chunk;
		for (const line of buffer.split("\n").slice(0, -1)) {
			const message = JSON.parse(line);
			if (message.id === 2) { clearTimeout(timer); child.kill(); resolve(message.result.tools); }
		}
		buffer = buffer.slice(buffer.lastIndexOf("\n") + 1);
	});
	const send = (message) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
	send({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } });
	send({ method: "notifications/initialized" });
	send({ id: 2, method: "tools/list" });
});
assert.ok(tools.some((tool) => tool.name === "init_generate"), "MCP: init_generate missing");
console.log(`ok mcp handshake (${tools.length} tools)`);
