# worker/ (renaming to backend/ in Phase 6a)

This folder will be renamed `backend/` per the 2026-05-02 backend pivot. It will hold the Railway-hosted Fastify + Prisma + Postgres service.

Responsibilities:
- `POST /submit` — runs the LLM-based prompt-injection reviewer on a submitted spec, then opens a GitHub PR via the contributor's OAuth token and auto-merges it.
- `POST /report-execution` — receives verification-result events from the MCP and updates `ShortcutStats` aggregates in Postgres.
- `GET /lookup` — joins spec JSON (read from the deploy's disk) with live Postgres stats and returns ranked matches.
- GitHub OAuth callback for explore-skill users.

See `docs/architecture.md` (System overview, Stats DB) and `PLAN.md` (Phase 6a, Phase 6b) for the full design.

Lands in Phase 6a / 6b.
