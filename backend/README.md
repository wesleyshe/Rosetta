# backend/

Railway-hosted Fastify + Prisma + Postgres service. Single host for both the static website and the API.

Routes:
- `GET /` and assets — serves `site/` and `registry/` as static files.
- `GET /apps/{app_id}/skill.md` — generated agent-context markdown (combines `meta.json` + `workflow.json` + a summary of `shortcuts.json`).
- `POST /submit` — runs the LLM-based prompt-injection reviewer, then opens + auto-merges a GitHub PR via the contributor's OAuth token.
- `POST /report-execution` — receives verification-result events from the MCP, writes an `Execution` row, re-aggregates `ShortcutStats`.
- `GET /lookup` — joins specs on disk with live stats; returns ranked matches with `cold_start` flag.
- `GET /healthz` — liveness probe.
- GitHub OAuth: `/auth/github/login`, `/auth/github/callback`, `/auth/github/token`.

Run locally:
```
npm install
npm run prisma:generate
npm run dev
```

Provisioning the live service is documented in `RAILWAY_SETUP.md`.

See `docs/architecture.md` (System overview, Hosting and contribution flow, Stats DB, skill.md endpoint) for the full design.
