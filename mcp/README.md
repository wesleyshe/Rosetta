# mcp/

TypeScript MCP server. Bundled: registry lookup + computer control + verification + submission, all in one install.

Lands in Phase 3 (registry tools) and Phase 4 (OS / verify / interpret tools). Distribution: `npx @rosetta-skills/mcp` (final npm name TBD).

See `docs/architecture.md` § "MCP server: tool surface" for the tool list.

## Submitting shortcuts (contributor setup)

To submit shortcuts back to the registry via the explore skill, set these env vars in your MCP config (e.g. Claude Desktop's `claude_desktop_config.json`, under the `rosetta` entry's `"env"` block):

```json
"ROSETTA_BACKEND_URL": "https://<your-railway-domain>",
"ROSETTA_GITHUB_TOKEN": "gho_..."
```

Get the OAuth token by visiting `<ROSETTA_BACKEND_URL>/auth/github/login` in a browser, authorizing the Rosetta MCP OAuth App, and extracting the `rosetta_token` cookie via DevTools (F12 → Application → Cookies → click the Railway domain → copy the `rosetta_token` value, which starts with `gho_`).

The cookie's `httpOnly` flag prevents JS from reading it; DevTools shows the value because that's a browser feature, not a JS feature. The token has `public_repo` scope and the cookie expires after 30 days unless re-authorized. Treat it like a password.

When `ROSETTA_BACKEND_URL` is unset, the MCP runs in dryrun mode for `registry.submit` — submissions log to stderr instead of hitting the backend. Useful for offline testing or before the backend is provisioned.
