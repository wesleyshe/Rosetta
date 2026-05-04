# Contributing to Rosetta

Two kinds of contributions are useful: **skills** (new shortcut specs in the registry) and **code** (the MCP server, the backend, the site, the docs). Skills land via an automated review-and-merge path; code lands via standard GitHub PRs.

If you're here to file an issue rather than open a PR, jump to [Reporting issues](#reporting-issues).

---

## Quick start

- Install the MCP per [`docs/install.md`](docs/install.md).
- Run `npm install && npm run validate-registry` from the repo root before opening any registry PR.
- Skill submissions can be auto-merged through the MCP's `registry_submit` tool. Manual PRs are also welcome.

---

## Contributing a skill

A "skill" in Rosetta is one entry in `registry/apps/{app_id}/shortcuts.json` — an atomic intent + actions + verification. See [`docs/skills.md`](docs/skills.md) for the authoring spec; this section covers the contribution flow.

### Path A — let the explore skill submit for you (recommended)

This is what the explore seed skill does. It runs an MCP-driven session against a target app, drafts shortcuts, verifies each one, and submits the verified findings as auto-merged PRs.

1. Finish the install in [`docs/install.md`](docs/install.md) including step 6 (GitHub OAuth).
2. Paste the explore seed skill into a fresh chat in your MCP client.
3. Tell the agent: `Explore <app> for <N> minutes.`

The agent calls `explore_submit_findings` at the end of the session. Each verified finding becomes a PR via the backend's `/submit` endpoint, which validates against schema, runs the prompt-injection reviewer, opens a PR under your GitHub identity, and auto-merges if the reviewer passes.

What you'll see when it works: PR URLs in the agent's final summary, and entries in the live registry within ~1 minute of merge (Railway redeploys on merge).

### Path B — hand-author one shortcut, submit via the MCP

Use this when the explore skill isn't a fit (e.g., an app it can't reliably probe, or a shortcut you want to author deliberately).

1. Open `registry/apps/{app_id}/shortcuts.json`. If the app folder doesn't exist yet, see [Adding a new app](#adding-a-new-app).
2. Add your shortcut, following the schema in [`docs/skills.md`](docs/skills.md). Required `metadata` fields: `contributor_id` (your GitHub handle), `payment_destination` (always `null`), `token_cost_estimate`, `speed_estimate_ms`, `submitted_at` (today, `YYYY-MM-DD`).
3. Run `npm run validate-registry` from the repo root. Fix anything it flags.
4. Submit through the MCP. From an MCP-capable chat client with `ROSETTA_GITHUB_TOKEN` set, ask the agent to call `registry_submit` with your spec. Or call the backend directly:
   ```sh
   curl -X POST https://rosetta-production-e301.up.railway.app/submit \
     -H "Authorization: Bearer $ROSETTA_GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     -d @your-shortcut.json
   ```
5. Watch the response for the PR URL. The auto-merge usually completes in under a minute.

### Path C — standard GitHub PR

Use this for changes that don't fit the per-shortcut submit endpoint:

- **Adding a new app** (creating `meta.json`, `workflow.json`, `shortcuts.json`, and an `index.json` row).
- **Bulk shortcut additions** (more than one or two at once).
- **Edits to existing shortcuts** (the `/submit` endpoint only inserts).
- **Schema or tooling changes.**

Fork, branch, run `npm run validate-registry`, open a PR. Tag it with what you changed in the title (e.g. `photoshop: add clone-stamp shortcut`). A maintainer reviews; this path doesn't auto-merge.

### Validation

`npm run validate-registry` runs from the repo root. It performs:

1. JSON Schema validation of `meta.json`, `workflow.json`, `shortcuts.json` against `registry/schemas/`.
2. Action `$defs` byte-identical between `workflow.schema.json` and `shortcut.schema.json`.
3. Shortcut `id` uniqueness within each `shortcuts.json`.
4. Folder name == `meta.id` == `workflow.app_id` == `shortcuts.app_id`.
5. Every `{placeholder}` used in actions / verification is declared in the shortcut's `parameters[]`.
6. `registry/index.json` consistency: every app folder is listed and every listing has a folder.

The backend's `/submit` endpoint runs the same checks before auto-merging. If your local validate passes but `/submit` fails, see [Troubleshooting in install.md](docs/install.md#troubleshooting).

### What gets rejected

- **Schema violations.** `additionalProperties: false` is enforced. Runtime-stat fields (`use_count`, `success_rate`, `reliability_score`, `last_validated`) are forbidden in JSON — they live in Postgres.
- **Prompt-injection patterns.** The backend reviewer runs an LLM-based check on incoming specs. Specs that try to manipulate downstream agents (instructions in `intent`, hidden directives in `agent_primer`, etc.) are rejected with a reason.
- **Fragile shortcuts.** If your shortcut has no clean verification — i.e., no way to prove the action worked — it's not ready. Don't submit. Either find a better verification or drop the shortcut.
- **Duplicate `id` within an app.** Pick a different `id`. Multiple shortcuts CAN share an `intent` (different methods compete on reliability); they cannot share an `id`.

### Adding a new app

If `registry/apps/{your_app}/` doesn't exist yet:

1. Create the folder.
2. Add `meta.json`, `workflow.json`, `shortcuts.json`. Use `registry/apps/vscode/` as a starting reference (cleanest), or `registry/apps/photoshop/` (modal-heavy desktop app).
3. Add an entry to `registry/index.json`.
4. Author at least one shortcut so the app isn't empty.
5. Run `npm run validate-registry`.
6. Open a Path C PR.

Once the app is in the registry, future shortcuts for it can land via Path A or B.

---

## Contributing code

The codebase has four chunks. Pick the one your change touches and follow its conventions.

### `mcp/` — TypeScript MCP server

Local binary that the user's AI client launches.

```sh
cd mcp
npm install
npm run build      # compiles to dist/index.js
```

To test changes against your own MCP client, point its `args` entry at your local `mcp/dist/index.js` (see [install.md step 2](docs/install.md#step-2-wire-it-into-your-ai-client)) and rebuild + restart the client after each edit. The MCP log lives at `~/Library/Logs/Claude/mcp-server-rosetta.log` on macOS.

Conventions:

- Strict TypeScript with Node16 module resolution. No new deps without justification.
- macOS action dispatch routes through `osascript` / System Events (see `docs/design-rationale.md` § "Why macOS action dispatch goes through AppleScript"). Don't reintroduce nut.js for macOS.
- Tools are exported from `src/index.ts`. Keep their schemas in sync with what the agent actually receives.

### `backend/` — Fastify + Prisma backend

Hosted on Railway, deployed from the repo root.

```sh
cd backend
npm install
npm run build
```

Local dev requires a Postgres connection string in `.env` (Railway provides one for prod). Schema lives in `backend/prisma/schema.prisma`. v0 syncs the schema with `prisma db push --accept-data-loss --skip-generate` rather than versioned migrations (parking-lot 12 — graduates once production data exists).

Routes are split per file under `backend/src/routes/`. Add new routes by registering them in `backend/src/index.ts`.

### `site/` — static landing + per-app pages

Vanilla HTML/CSS/JS, no framework. Served by the backend at `/`.

To preview locally:

```sh
cd site
python3 -m http.server 8123
# open http://localhost:8123
```

Note that some fetches assume backend-served absolute paths (`/registry/...`, `/auth/github/...`); those won't work under a plain static server. Run the backend locally if you need full fidelity.

### `docs/` — design and authoring docs

Plain Markdown. `docs/architecture.md` is canonical for system design; `docs/design-rationale.md` records why each major decision was made; `docs/parking-lot.md` lists deferred items with reasons. Skill authoring lives in `docs/skills.md`.

If you're proposing an architectural change, edit `docs/architecture.md` AND add a rationale entry to `docs/design-rationale.md` in the same PR.

### Code PR conventions

- One focused change per PR. Bundle only when the changes are coupled (a schema change + the validator update that enforces it, etc.).
- Commit messages follow the existing style — see `git log --oneline` for examples. Roughly `<area>: <imperative summary>`. No emoji.
- Run the relevant build before pushing: `npm run build` in `mcp/` or `backend/`, `npm run validate-registry` from root for registry edits.
- For changes that touch the MCP's exposed tool surface or the registry schemas, update `docs/architecture.md` in the same PR.

---

## Reporting issues

File at https://github.com/wesleyshe/Rosetta/issues. The most useful issue kinds:

- **Shortcut doesn't work on my version.** Include the app, the shortcut `id`, your OS + app version, and the agent's verify output.
- **Install steps broke on a fresh machine.** Tell us where in [`docs/install.md`](docs/install.md) you got stuck and what your environment looks like.
- **Schema gap when authoring.** If you wanted to express something the schema doesn't support, file it — don't work around it silently.
- **App you want covered.** Especially if you'd be willing to run an explore session against it.

Issue templates exist for each of these under `.github/ISSUE_TEMPLATE/`.

---

## License

By contributing, you agree your contributions are licensed under the MIT License. See [`LICENSE`](LICENSE).
