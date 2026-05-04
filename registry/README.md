# registry/

Static JSON skill registry. Source of truth lives in this folder under Git. Served as-is by the Railway backend (which reads it off the deploy's disk).

Layout:

- `index.json` — list of apps with versions/platforms
- `schemas/` — JSON Schemas (`workflow.schema.json`, `shortcut.schema.json`, `meta.schema.json`)
- `apps/{app_id}/` — `meta.json`, `workflow.json`, `shortcuts.json` per app

To validate the registry before opening a PR, run `npm run validate-registry` from the repo root. The backend's `/submit` endpoint runs the same checks. Authoring guide: [`../docs/skills.md`](../docs/skills.md). Full data model: [`../docs/architecture.md`](../docs/architecture.md).
