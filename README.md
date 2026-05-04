# Rosetta

A community-shared registry of "skills" — semantic, verified action sequences that let any MCP-capable AI chat client drive desktop apps without per-app handcoding. Install one MCP server, paste a seed skill into your client (Claude Desktop, Claude Code, Cursor, ChatGPT Desktop, etc.), and start giving natural-language commands. Discover once, replay deterministically, fall back to vision when needed. Framed as a transition-era layer until apps ship native AI interfaces.

**Site:** https://rosetta-production-e301.up.railway.app

## Status

Soft launch on Phase 7b. macOS only in v0; Windows and Linux land later. Two seed apps in the registry today — VS Code (architectural reference) and Adobe Photoshop (the launch-time value target, 42 shortcuts including 5 contributed by an explorer-agent run).

Two skills:

- **Use skill** — anonymous, no auth required. Looks up shortcuts in the live registry and replays them deterministically.
- **Explore skill** — GitHub OAuth required. Maps a new app within a wall-clock budget and contributes shortcut specs back as auto-merged PRs.

Both run off the same one-line MCP install. See [`docs/install.md`](docs/install.md).

## Quick start

1. Read [`docs/install.md`](docs/install.md). About 10 minutes the first time.
2. Open https://rosetta-production-e301.up.railway.app, copy the use-skill text, paste into a fresh Claude Desktop chat.
3. Try: `Open /Users/me/Desktop/cat.jpg in Photoshop.`

## Contributing

Skills land via auto-merged PRs through the explore skill, or via standard GitHub PRs for hand-authored shortcuts and new apps. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/skills.md`](docs/skills.md).

## Repo layout

- `registry/` — static JSON skill registry, source of truth.
- `mcp/` — TypeScript MCP server (`@modelcontextprotocol/sdk`). Built artifact lives at `mcp/dist/index.js`.
- `site/` — static website source, served by the Railway backend.
- `backend/` — Fastify + Prisma + Postgres on Railway. Submissions, telemetry, lookup, OAuth, and the per-app `skill.md` agent-context endpoint.
- `docs/` — architecture, design rationale, install guide, authoring guide, parking lot.

## Reference

- [`docs/architecture.md`](docs/architecture.md) — full system design.
- [`docs/skills.md`](docs/skills.md) — schema and authoring guide.
- [`docs/design-rationale.md`](docs/design-rationale.md) — why each major decision was made.
- [`docs/parking-lot.md`](docs/parking-lot.md) — deferred items with reasons.
- [`PLAN.md`](PLAN.md) — phased execution plan with status.
- [`CLAUDE.md`](CLAUDE.md) — project index for AI agents working on the codebase.

## License

MIT. See [`LICENSE`](LICENSE).
