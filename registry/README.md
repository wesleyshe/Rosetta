# registry/

Static JSON skill registry. Served as-is via GitHub Pages.

Layout (lands in Phase 1 — see `PLAN.md`):

- `index.json` — list of apps with versions/platforms
- `schemas/` — JSON Schemas (`workflow.schema.json`, `shortcut.schema.json`, `meta.schema.json`)
- `apps/{app_id}/` — `meta.json`, `workflow.json`, `shortcuts.json` per app

See `docs/architecture.md` for the full data model.
