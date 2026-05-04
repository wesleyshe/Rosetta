# mcp/

TypeScript MCP server. Bundled: registry lookup, computer control, verification, submission, and explore-session tools — all in one install.

Distributed from source in v0 (npm package planned post-launch). To install for use, follow [`docs/install.md`](../docs/install.md). Tool surface is documented in [`docs/architecture.md`](../docs/architecture.md) § "MCP server: tool surface".

## Local development

```sh
npm install
npm run build      # compiles to dist/index.js
```

To test changes against your own MCP client, point its `args` entry at `mcp/dist/index.js` (per [`docs/install.md`](../docs/install.md)) and rebuild + restart the client after each edit. The MCP log on macOS lives at `~/Library/Logs/Claude/mcp-server-rosetta.log`.

## Environment variables

Set these in your MCP client's config under the `rosetta` entry's `"env"` block:

- `ROSETTA_REGISTRY_PATH` — local fallback registry path. Used when the backend is unreachable.
- `ROSETTA_BACKEND_URL` — live registry URL. Defaults to the production Railway deploy. Unset to force dry-run mode (submissions log to stderr instead of hitting the backend).
- `ROSETTA_GITHUB_TOKEN` — required to submit shortcuts. Get it from `<ROSETTA_BACKEND_URL>/auth/github/token` after completing the OAuth flow at `/auth/github/login`. Treat like a password.

## Conventions

- macOS action dispatch routes through `osascript` / System Events. Don't reintroduce nut.js for macOS — see `docs/design-rationale.md` § "Why macOS action dispatch goes through AppleScript".
- nut.js retained for Windows / Linux until the cross-platform polish substep replaces it.
- Strict TypeScript with Node16 module resolution.
