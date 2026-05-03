# Rosetta

A community-shared registry of "skills" — semantic, verified action sequences that let any MCP-capable AI chat client drive desktop apps without per-app handcoding. Install one MCP server, paste a seed skill into your client (Claude Desktop, Claude Code, Cursor, ChatGPT Desktop, etc.), and start giving natural-language commands. Discover once, replay deterministically, fall back to vision when needed. Framed as a transition-era layer until apps ship native AI interfaces.

## Status

Pre-code, design locked. No installable artifacts yet. See [`PLAN.md`](PLAN.md) for current phase, [`docs/architecture.md`](docs/architecture.md) for the full design, and [`CLAUDE.md`](CLAUDE.md) for the project index.

Website link: TBD (Phase 2).

## Repo layout

- `registry/` — static JSON skill registry (Phase 1+)
- `mcp/` — TypeScript MCP server (Phase 3+)
- `site/` — static website source, served by the Railway backend (Phase 2+)
- `backend/` — Railway-hosted Fastify + Prisma + Postgres backend for submissions, telemetry, and lookup (Phase 6a/6b). Also serves the static site and the generated `skill.md` agent-context endpoints.
- `docs/` — architecture, design rationale, deferred items

## License

MIT. See [`LICENSE`](LICENSE).
