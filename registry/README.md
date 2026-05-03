# registry/

Static JSON skill registry. Source of truth lives in this folder under Git. Served as-is by the Railway backend (which reads it off the deploy's disk).

Layout (lands in Phase 1 — see `PLAN.md`):

- `index.json` — list of apps with versions/platforms
- `schemas/` — JSON Schemas (`workflow.schema.json`, `shortcut.schema.json`, `meta.schema.json`)
- `apps/{app_id}/` — `meta.json`, `workflow.json`, `shortcuts.json` per app

See `docs/architecture.md` for the full data model.
