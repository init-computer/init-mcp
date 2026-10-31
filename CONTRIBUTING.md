# Contributing

Thanks for helping improve Init's clients.

## Setup

```bash
git clone https://github.com/init-computer/init.git
cd init
npm install
npm test
```

`npm test` builds the SDK, checks each package's contents, runs `init --help` and does an MCP `initialize` / `tools/list` handshake. None of it calls the Init API.

To try your changes against the real API, set `INIT_API_KEY` and run the CLI from source:

```bash
node packages/cli/bin/init.js generate "an API that returns a random joke"
```

## Pull requests

- Keep changes focused, and explain the why in the description.
- Match the existing style: plain ES modules with no build step beyond copying the SDK into `dist/`.
- Never commit API keys or endpoint URLs from your account.

## Releases

Maintainers bump the version in `packages/<name>/package.json` and push a `<name>-v<version>` tag, for example `cli-v0.1.13`. CI tests, publishes to npm with provenance and creates a GitHub release.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
