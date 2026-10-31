# Installing the Init MCP server (for AI agents)

These steps are for an agent such as Cline that is setting up the Init MCP server for a user.

1. Check that Node.js 18 or later is installed: `node --version`. If it isn't, ask the user to install it from https://nodejs.org.
2. Ask the user for their Init API key. It starts with `init_sk_`. If they don't have one, they can create one at https://www.init.computer/console/secrets after signing up at https://www.init.computer/sign-up. The free plan includes MCP access. Never guess, generate or print the key.
3. Add this server to the MCP settings file, replacing the placeholder with the user's key:

```json
{
  "mcpServers": {
    "init": {
      "command": "npx",
      "args": ["-y", "@init-computer/mcp"],
      "env": {
        "INIT_API_KEY": "init_sk_..."
      }
    }
  }
}
```

Nothing needs to be cloned or built. `npx` downloads the published package from npm.

4. Restart or reload the MCP servers. Then confirm that these tools appear: `init_generate`, `init_run`, `init_list_resources`, `init_get_resource`, `init_generate_project`, `init_edit_project`, `init_apply_project_manifest`, `init_apply_project_file` and `init_list_packages`.
5. Verify the key by calling `init_list_resources`. An authentication error means the key is wrong or missing.
6. Try it: call `init_generate` with `{"prompt": "An API that accepts a topic and returns a one-sentence fun fact about it as fact"}`. Then call `init_run` with the returned `url` and `{"topic": "octopuses"}`.

Optional: `INIT_API_BASE_URL` overrides the API origin. The default is https://api.init.computer.
