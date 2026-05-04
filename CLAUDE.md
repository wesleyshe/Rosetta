# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Rosetta

A community-shared online registry of "skills" (semantic action sequences with built-in verification) that lets AI agents control any desktop app or website without per-app integration. Named for the translation layer between agent intent and app actions. Discover once, replay deterministically, fall back to vision when needed. Framed as a transition-era layer until apps ship native AI interfaces (MCP-style).

## Status

**Phase 7b: soft launch prep.** Codebase is shipping. Two seed apps in `registry/apps/` (VS Code architectural reference, Photoshop launch target — 42 shortcuts including 5 explorer-contributed). MCP, backend, site, and registry all build and deploy. Live at `https://rosetta-production-e301.up.railway.app`. See `PLAN.md` for phase status, `docs/architecture.md` for design, change log below for recent decisions.

Repo holds `CLAUDE.md`, `PLAN.md`, `README.md`, `LICENSE`, and `docs/`, plus stub READMEs in `registry/`, `mcp/`, `site/`, and `worker/` (the `worker/` folder will be renamed to `backend/` per the 2026-05-02 backend pivot). Read `docs/architecture.md` before writing any code — it is the canonical source for schema, MCP tools, seed skills, failure recovery flows, and the Postgres schema. `docs/design-rationale.md` records why each decision was made; consult it before reconsidering one.

## Commands

No build, lint, or test commands exist yet (Phase 0 of `PLAN.md` has not started). When tooling lands, update this section.

Planned per `PLAN.md`:

- **Phase 1** — `npm run validate-registry` (ajv-based JSON schema validation against `registry/schemas/*`).
- **Phase 3** — TypeScript MCP build/run scripts in `mcp/`. Distribution: `npx @rosetta-skills/mcp` (final npm name TBD).
- **Phase 3 smoke test** — install MCP in Claude Desktop, confirm tools appear, confirm `registry.lookup` returns VS Code shortcuts.
- **Phase 4** — cross-platform end-to-end test: drive VS Code via the MCP from Claude Desktop.

## What this project is (one paragraph)

Two seed skills (text blobs the user pastes into their desktop AI client) plus one MCP server (one-line install) plus one hosted JSON spec store plus a small Railway-hosted backend. Seed skill 1 ("use") tells the agent to look up skills from the registry and execute them. Seed skill 2 ("explore") tells the agent to map an app and contribute new skills back. Specs live in static JSON on GitHub Pages; runtime stats live in Postgres on Railway and are merged into lookup responses by the backend. Submissions go through an LLM-based prompt-injection reviewer and auto-merge to the spec store. Quality is determined post-hoc by hit rate (verification-pass percentage), not by upfront human review. Target clients: desktop AI chat apps that support MCP (Claude Desktop, Claude Code, Cursor, ChatGPT Desktop, etc.). Web chat clients are explicitly out of scope for v0.

## Architecture summary

Three hosted pieces (all on Railway, deployed from the same Git repo) plus the local MCP:

1. **Spec store** — JSON files in this repo at `registry/apps/{app_id}/`: `meta.json` (incl. `agent_primer` markdown), `workflow.json`, `shortcuts.json`. Git is the source of truth. Specs are immutable contracts. Runtime metadata (use_count, success_rate, etc.) is NOT stored here.
2. **Railway service (`backend/`)** — Fastify TypeScript service, deployed from the repo. Serves the static website (`site/`), the raw spec JSON, the per-app generated `skill.md` (agent-readable view rendered from JSON), and the API endpoints: `POST /submit` (agent prompt-injection reviewer + GitHub PR auto-merge), `POST /report-execution` (telemetry), `GET /lookup` (merges spec JSON + live stats), GitHub OAuth callback. On every auto-merged submission, Railway redeploys via its GitHub integration; new specs go live in ~1 minute.
3. **Postgres on Railway** — `Execution` events, aggregated `ShortcutStats`, `Contributor` records, `Submission` audit rows. Specs are NOT in Postgres.
4. **MCP server (`mcp/`, local on user's desktop)** — single bundled binary, installed via `npx @rosetta-skills/mcp` (final npm name TBD). Exposes registry lookup, computer-control, verification, submission, execution-reporting, and explore-session tools. Maintains a local explore-session state file at `~/.config/rosetta-mcp/sessions/{app_id}.json` for budget tracking and resume. Cross-platform.

Full design lives in `docs/architecture.md`. Read that before writing code.

## Tech stack (decided)

- **MCP server:** TypeScript, using `@modelcontextprotocol/sdk`. Distributed via npm so users install with `npx`.
- **Spec storage:** Git repo. JSON files at `registry/apps/{app_id}/`. Source of truth.
- **Backend (`backend/`):** TypeScript + Fastify + Prisma. Deployed to Railway. Serves static site + spec JSON + generated `skill.md` + API endpoints. Same Fastify-style + Prisma + Postgres pattern used in the prior Claw_Street_Bets project. **No GitHub Pages.** Single host.
- **Database:** Postgres on Railway. Stores `Execution` events, aggregated `ShortcutStats`, `Contributor` records, and `Submission` audit rows. Prisma schema sketch in `docs/architecture.md`.
- **Website:** static HTML/CSS/JS, no framework. Source in `site/`, served by the Railway backend.
- **Submission flow:** MCP calls `POST /submit` on the Railway backend. Backend runs the agent prompt-injection reviewer, then uses the contributor's GitHub OAuth token to open a PR and auto-merge it. Railway redeploys on merge.
- **Telemetry flow:** MCP calls `POST /report-execution` after every shortcut run. No GitHub auth required; `install_id` (locally-minted UUID) is used for sybil-resistance rate limiting.
- **Explore flow:** MCP maintains a local session state file per app. Budget is wall-clock minutes (default 30). Three finding statuses: `drafted`, `verified`, `rejected_by_self`. Session ends on budget exhaustion; state persists for resume. Four new MCP tools (`explore.start_session`, `explore.save_finding`, `explore.budget_status`, `explore.submit_findings`).
- **Identity:** GitHub OAuth required for SUBMISSION, NOT for USE. Use is anonymous (with `install_id` for rate-limiting). Submissions carry `contributor_id` (GitHub username).
- **License:** MIT (most permissive for community contributions).

## Conventions

- **No premature framework adoption.** Vanilla TS for the MCP, vanilla HTML/JS for the site. Add libraries only when there's a concrete need.
- **JSON schemas are versioned.** Every registry file declares `schema_version`. Breaking schema changes bump the major version and require a migration path.
- **Skills are addressed by app + intent.** `registry/apps/{app_id}/shortcuts.json`, with each shortcut keyed by a stable `id`.
- **Multiple skills can match one intent.** The agent picks based on the cost / speed / reliability metadata. Don't deduplicate across methods; let competition drive quality.
- **Verification is first-class, not a separate layer.** Every shortcut entry has a `verification` field. A skill is "execute these steps and prove you did them," not just "execute these steps." Don't refactor verification out into its own schema.
- **Prefer search-first methods where the app supports them.** Command palettes (VS Code, Linear, Obsidian, Notion, Cursor, Slack) are the most resistant to UI redesigns. When authoring or selecting a shortcut, rank these above raw keyboard/menu paths. But don't make `search` a special primitive — it's one method among many in the schema.
- **Reserved fields stay reserved.** `contributor_id` and `payment_destination` exist in the schema from day one even though payments are parked. No backfills later.
- **Test against Claude Desktop first.** It's the most mature MCP client. If it works there, port to others.
- **First app is VS Code (Phase 1); first explorer-agent target is Photoshop (Phase 7).** This ordering is deliberate — see `docs/design-rationale.md` before reordering.

## Out of scope for v0

See `docs/parking-lot.md` for the full list. The big ones: web chat client support, payment / contributor reward economy, prompt-injection / bad-skill defenses beyond the v0 LLM reviewer + hit-rate filter, cross-skill composition contracts. Note: automated skill decay detection is *partially* in scope now — `success_rate` populates in v0 via `registry.report_execution`. Heavyweight cron-based re-validation is still parked.

## Update protocol (self-maintenance)

When any of the following happens, update this file:

- A decision in the "Tech stack" or "Conventions" sections changes — edit the relevant line and add a change-log entry below.
- The project moves to a new phase — update the "Status" line.
- Something previously parked gets activated — move the item from `docs/parking-lot.md` into scope here, add a change-log entry.
- Architectural facts in the "Architecture summary" diverge from `docs/architecture.md` — fix this file to match (architecture.md is the canonical source for design depth, this file is the index).

The user can also explicitly ask "update CLAUDE.md to reflect [X]." When they do, make the edit, add a change-log entry below with date and one-line summary, and confirm the change.

When updating, keep this file under ~250 lines. If it grows past that, factor detail out into the relevant `docs/` file and leave a one-line reference here.

## Reference

- `PLAN.md` — current execution plan with phase status
- `docs/architecture.md` — full design (schema, MCP tools, seed skill texts, failure recovery)
- `docs/parking-lot.md` — deferred items with reasons
- `docs/design-rationale.md` — why each major decision was made and what was rejected

## Change log

- **2026-05-02** — Initial setup. Architecture, tech stack, and conventions decided. Pre-code.
- **2026-05-02** — Project named "Rosetta" (working name; subject to trademark check before public launch — Apple's Rosetta translation layer is the most likely conflict, plus Stone Rosetta, Rosetta Code, Rosetta@home).
- **2026-05-02** — Added Claude Code preamble; added `Commands` section noting pre-code status and the planned tooling per `PLAN.md`; surfaced verification-first-class, search-first preference, and the VS-Code-then-Photoshop ordering as explicit conventions (previously implicit in `docs/design-rationale.md`).
- **2026-05-02** — Phase 0 scaffolding landed (substeps 1–6): `git init -b main`, `README.md`, `LICENSE` (MIT, copyright "West"), `.gitignore`, and stub `README.md` in each of `registry/`, `mcp/`, `site/`, `worker/`. Substep 7 (create GitHub repo and push) deferred — pending repo-name decision and user-side `gh` auth.
- **2026-05-02** — Phase 0 complete. GitHub repo published at `https://github.com/wesleyshe/Rosetta` (public, personal account); `origin/main` synced. Phase 0 fully `[x]`.
- **2026-05-02** — Backend pivot. Architecture moves from "GitHub-as-database" to a hybrid: specs stay in Git, runtime stats move to Postgres on Railway. Cloudflare Worker dropped in favor of a Fastify + Prisma backend (matches the existing Claw_Street_Bets pattern). Submissions are now auto-merged after an LLM-based prompt-injection reviewer; quality is determined post-hoc by verification-pass hit-rate via a new `registry.report_execution` MCP tool and `Execution` / `ShortcutStats` Postgres tables. Auth split clarified: OAuth required for submission, NOT for use; sybil resistance on the use path comes from a locally-minted `install_id`. The `worker/` folder will be renamed to `backend/`. Runtime metadata fields (use_count, success_rate, reliability_score, last_validated) are no longer in shortcut JSON. Affected docs: `docs/architecture.md`, `docs/design-rationale.md`, `docs/parking-lot.md`, `PLAN.md`.
- **2026-05-03** — Final design lock-in after the alignment pass. Three changes from the 2026-05-02 state:
   1. **GitHub Pages dropped.** The Railway backend now serves both the static site AND the API. Single host, single deploy, single source-of-truth. Specs are still authored in Git; Railway reads them off the deploy's disk and redeploys on merge.
   2. **`agent_primer` field added to `meta.json`.** Markdown-friendly free-text orientation blob covering app terminology and element layout. Surfaces in the generated per-app `skill.md` agent-context endpoint.
   3. **Explore is budget-bounded and resumable in v0.** Wall-clock-minutes budget (default 30, reserve 5 for submission), local session state file at `~/.config/rosetta-mcp/sessions/{app_id}.json`, three finding statuses (`drafted`, `verified`, `rejected_by_self`), session-end policy (b) (auto-end on budget exhaustion, state persists for resume, fresh start requires `{ reset: true }`). Four new MCP tools: `explore.start_session`, `explore.save_finding`, `explore.budget_status`, `explore.submit_findings`. Adds Phase 4 substeps and an explore-skill text rewrite. JSON is source of truth, `skill.md` is a generated read-only view rendered from `meta.json` + `workflow.json` + `shortcuts.json`.
- **2026-05-03** — Phase 1 complete. Three JSON Schemas in `registry/schemas/` (Draft 2020-12, strict, with `additionalProperties: false`, closed enums, mutually-exclusive `oneOf` on `openAppAction`, and runtime-stats fields rejected on the shortcut `metadata` block). VS Code seed at `registry/apps/vscode/` exercises three verification types (`ax_tree_assertion`, `file_check`, `interpret_check`) across 8 hand-curated shortcuts spanning `method: "shortcut"` and `method: "search"`. `npm run validate-registry` (root `package.json`, deps `ajv@^8.17` + `ajv-formats@^3`, script at `scripts/validate-registry.mjs`) performs schema validation plus the four cross-cutting checks listed under the Phase 1 substep in `PLAN.md` plus a sixth `index.json` ↔ `apps/` consistency check. `docs/skills.md` written as the contributor authoring guide. Validator passes against the seed.
- **2026-05-03** — Phase 2 complete (functional only; design pass tracked in parking-lot 2). `site/index.html` (landing + install + two seed-skill copy-to-clipboard boxes + app list fetched from `/registry/index.json`), `site/app.html` (per-app page with human-view / raw-JSON tabs, hand-rolled tiny markdown renderer for `agent_primer`), `site/seed-skills/{use,explore}.md` (mirrored from `docs/architecture.md`'s canonical text — Phase 5 will iterate), `site/style.css` (~140 lines, system fonts, no framework). All fetch URLs use absolute paths designed for Phase 6a's serving layout (site/ at /, registry/ at /registry/) — verified via a tiny dev-server smoke test (9 paths, all 200).
- **2026-05-03** — Phase 6a deploy fixes. (1) Build context expanded from `backend/` to whole-repo: root `package.json` and root `railway.json` now drive the build (`cd backend && npm ci && npm run build`, then `cd backend && npm run prisma:deploy && npm run start`). Reason: the runtime needs `site/` and `registry/` as siblings of `backend/dist/`, but Railway's previous `backend/`-only Root Directory left those folders out of the deploy image and Fastify's `@fastify/static` failed boot with `"root" path "/site" must exist`. (2) v0 schema management uses `prisma db push --accept-data-loss --skip-generate` instead of `prisma migrate deploy` — no migration files required, idempotent sync from `schema.prisma`. Graduates to real migrations once production data exists; tracked as parking-lot 12 ("Graduate to Prisma migrations"). User-side step: change Railway Root Directory from `backend` to empty/repo-root before the next deploy.
- **2026-05-03** — Path X reframe. VS Code stays as architectural validation seed (8 shortcuts, full backend pipeline tested). Photoshop becomes the launch-time value-target. Phase 7 splits into 7a (universal GUI-app-control schema extensions — delay handling, popup dismissal, minimal composition — applied first to a hand-curated Photoshop seed; use-skill smoke from Claude Desktop) and 7b (demo orchestration, UI/UX, CONTRIBUTING.md, install docs, pitch deck, soft launch). Composition contracts (parking-lot 4) partially activates in 7a. UI/UX (parking-lot 2) activates in 7b.
- **2026-05-03** — Phase 7a closes. Schema extensions (`wait_for_idle`, `pre_step`, `produces`/`consumes`) shipped. Hand-curated Photoshop seed (7 shortcuts) shipped. Use-skill smoke from Claude Desktop blocked by macOS TCC: Claude.app spawns node via a disclaimer helper, node calls nut.js's CGEventPost, macOS attributes the privileged call to node and refuses the silent fallback even when /usr/local/bin/node is added to Privacy & Security (system-path rejection). Validated alternative path: AppleScript via osascript routes through System Events, which holds its own entitlement; the chain Claude.app → disclaimer → node → osascript → System Events → synthetic input completes cleanly. Phase 7b's first substep refactors `os.ts` to dispatch macOS actions through osascript. nut.js retained for Windows/Linux. Long-term distribution answer is parking-lot 7 (signed native helper).
- **2026-05-04** — Phase 7b#1 lands and Phase 7a Part 3 closes. AppleScript refactor of `mcp/src/os.ts` shipped (commit `226e73d`): macOS dispatch for `key`, `key_combo`, `type_text`, and coordinate `click` routes through osascript / System Events. nut.js dropped entirely (import + dep + ~125 transitive packages). Char-based keystroke dispatch is keyboard-layout-aware (Dvorak-safe). Coordinate click is AX-mediated, not pixel-level; documented limitation. Companion fix `aa0b716`: `openAppMacos` prefers `bundle_id` over `display_name` because LaunchServices does not fuzzy-match (an installed `Adobe Photoshop 2026` is invisible to `open -a "Adobe Photoshop"`; `open -b com.adobe.Photoshop` is version-stable). Photoshop Part 3 smoke ran end-to-end through Claude Desktop on the live Railway backend: open-file shortcut and adjust-brightness shortcut both passed, save-as-png partially passed (action chain reached the Save a Copy dialog cleanly but the seed shortcut assumes typing a `.png` path switches the format dropdown — Photoshop defaults to JPEG when source is JPG; seed-shortcut bug, fix queued for Phase 7b#2). Telemetry verified live: `GET /lookup` returns Photoshop shortcuts with `stats.use_count: 4`, `last_validated: 2026-05-04T05:03:37.850Z`, `cold_start: true` (under MIN_SAMPLES_FOR_SCORE). Outstanding from Part 3, carried as Phase 7b substeps: (i) refactor `verify(interpret_check)` agent-side to remove the `ROSETTA_ANTHROPIC_API_KEY` dependency from the use path AND eliminate the >1MB Claude Desktop tool-result limit on screenshot bytes; (ii) fix the save-as-png seed shortcut to set the format dropdown explicitly.
- **2026-05-04** — Phase 7b#2-#5 lands; soft-launch readiness verified. (1) `verify(interpret_check)` refactored to return `passed: null` + `agent_must_judge` + image content for the agent to judge; eliminates `ROSETTA_ANTHROPIC_API_KEY` from the use path (commit `c9bba4c`). (2) `os_screenshot` caps JPEG at 1600 px longest side / quality 60 via `sips`; full-screen captures drop from ~1.35 MB to ~327 KB base64, fitting under Claude Desktop's 1 MB tool-result limit (commit `e4e2fbf`). (3) Photoshop seed expanded 7 → 37 shortcuts (Adobe-published basics, commit `bf308a8`); explorer first-run added 5 more verified shortcuts (`open-levels`, `open-curves`, `open-hue-saturation`, `open-color-balance`, `toggle-rulers`) bringing the registry to 42 (commit `168756f`). (4) `GET /auth/github/token` endpoint added so the OAuth flow can surface the user's token + config snippet (commit `a36f696`); explore-skill prompt now enumerates all five required `metadata` sub-fields including `payment_destination: null` (commit `7cd6ad6`). (5) Soft-launch docs: `docs/install.md` rewrite (expanded permissions section, troubleshooting categories, log path; commit `541f2ce`); `CONTRIBUTING.md` (three skill-contribution paths plus per-area code conventions; commit `57e582e`); four GitHub issue templates (commit `4f35a47`); `README.md` refreshed off "pre-code, design locked" framing (commit `3b2c1b9`). Site UI/UX activated parking-lot 2 (commit `680748c`). Parking-lot 16 added (region-capture screenshot optimization). Pending: registry_execute consolidation tool (parking-lot-style; explicitly deferred), tutorial-mining prompt expansion (Tier B).
