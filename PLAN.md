# Execution Plan

Live document. Update phase status as work progresses. Each phase has a goal, substeps, and a status marker.

Status markers: `[ ]` not started, `[~]` in progress, `[x]` done, `[!]` blocked, `[-]` deferred-blocked (carried to a later phase).

---

## Phase 0: Repo scaffolding

**Goal:** Project skeleton in place, version-controlled, ready to iterate.

- [x] Confirm folder structure (see `docs/architecture.md` for layout)
- [x] `git init` and initial commit
- [x] `README.md` with one-paragraph pitch and link to website (when it exists)
- [x] `LICENSE` file (MIT)
- [x] `.gitignore` (Node, OS noise, build artifacts)
- [x] Create `registry/`, `mcp/`, `site/`, `worker/` top-level folders
   - **Note (post-pivot):** `worker/` will be renamed to `backend/` in Phase 6a (the Cloudflare Worker plan was replaced by a Railway-hosted Fastify backend on 2026-05-02).
- [x] Create GitHub repo and push

**Estimate:** 30-60 min.

---

## Phase 1: Registry schema + first app's seed data

**Goal:** Schema is defined, validated, and one real app has hand-written entries that exercise the full schema.

- [x] Write JSON schemas: `registry/schemas/workflow.schema.json`, `registry/schemas/shortcut.schema.json`, `registry/schemas/meta.schema.json`
   - **Note (post-pivot):** `shortcut.schema.json` does NOT include runtime metadata fields (`use_count`, `success_rate`, `reliability_score`, `last_validated`). Those live in the Postgres `ShortcutStats` table, not the JSON. The JSON `metadata` block only covers contributor-declared static fields: `contributor_id`, `payment_destination`, `token_cost_estimate`, `speed_estimate_ms`, `submitted_at`.
   - **Note (final lock-in):** `meta.schema.json` includes a required `agent_primer` field (markdown string) carrying app terminology and element layout. The backend's `skill.md` generator reads this verbatim.
- [x] Pick first app: **VS Code recommended** (cleanest test of search-first interaction model)
- [x] Write `registry/apps/vscode/meta.json`
- [x] Write `registry/apps/vscode/workflow.json` (the generic execution harness for VS Code)
- [x] Write `registry/apps/vscode/shortcuts.json` with 5-10 hand-curated shortcuts (open file, search files, run command from palette, format file, toggle sidebar, etc.)
- [x] Add `registry/index.json` listing all apps
- [x] Set up `ajv` validation script: `npm run validate-registry`
   - **Extra checks the script must perform** (JSON Schema can't enforce these on its own):
     - **Shortcut id uniqueness** within each `shortcuts.json` (deep-equality check across the array).
     - **Cross-file consistency:** `meta.id` must equal the folder name under `registry/apps/`, and equal `workflow.app_id`, and equal `shortcuts.app_id`.
     - **Action-schema duplication in sync:** the action `$defs` (`keyAction`, `keyComboAction`, `typeTextAction`, `clickAction`, `menuAction`, `openAppAction`) in `workflow.schema.json` must be byte-identical to those in `shortcut.schema.json` (sort keys, normalize whitespace, then compare).
     - **Parameter placeholder coverage:** every `{placeholder}` that appears in a shortcut's action templates (`type_text.text`, `key_combo.keys` strings, `menu.path` items) or verification value placeholders (`ax_tree_assertion.value`, `file_check.path`, `value_compare.left/right`, `interpret_check.expected`) must be declared in that shortcut's `parameters[]` array. Catches typos like `{filename}` when the param is named `file_path`.
- [x] Write `docs/skills.md` explaining how to author a skill

**Estimate:** 3-5 hours.

---

## Phase 2: Static website source

**Goal:** Public-facing site lists apps, shows two seed skills, lets users browse the registry. Site is hosted by the Railway backend (NOT GitHub Pages); this phase produces the static source files only.

- [x] `site/index.html` — landing page with brief Rosetta introduction + install instructions + two prominent copy-to-clipboard boxes for the seed skills (use + explore)
- [x] `site/app.html` — per-app page with two tabs (human-readable view of the spec, raw JSON view)
- [x] `site/seed-skills/use.md` and `site/seed-skills/explore.md` — the canonical seed-skill text files (served at fixed URLs by the backend)
- [x] Minimal CSS (no framework needed)
- [x] Verify the page templates can fetch `registry/index.json` and `apps/{app_id}/...` from same-origin URLs (they will be served by the Railway backend in Phase 6a, which exposes both `site/` and `registry/` as static assets)

**Note:** GitHub Pages is NOT used. Deployment is folded into Phase 6a (the Railway backend reads `site/` and `registry/` off disk).

**Estimate:** 3-5 hours.

---

## Phase 3: MCP server scaffolding (registry-side tools)

**Goal:** MCP server installs cleanly, connects to Claude Desktop, exposes registry lookup tools.

- [x] `mcp/` TypeScript project setup with `@modelcontextprotocol/sdk`
- [x] Generate and persist `install_id` (UUID) on first launch, stored in MCP config. Used in all telemetry calls.
- [x] Implement `registry.lookup(app, intent, platform?, version?)` — calls the Railway backend's `GET /lookup`, which merges spec JSON (read from the deploy's disk) with live `ShortcutStats` (from Postgres) and returns ranked matches
- [x] Implement `registry.list_apps()` — calls backend `GET /apps`
- [x] Implement `os.app_info(name)` — detects installed app version and platform
- [x] Smoke test: install in Claude Desktop, verify tools appear, verify lookup returns VS Code shortcuts with stats fields populated (or `cold_start: true` when not enough data)
- [ ] Publish initial version to npm under a placeholder name

**Estimate:** 4-6 hours. Note: Phase 3 depends on Phase 6 being far enough along that the backend's `/lookup` endpoint exists. If they're built in parallel, mock the backend response for Phase 3 smoke tests, then swap to real once Phase 6 ships.

---

## Phase 4: Computer-control tools + explore-session state

**Goal:** MCP can drive the user's actual desktop. Cross-platform basics work. Explore sessions are persistent and resumable.

**Computer control:**

- [x] `os.screenshot(region?)` — full screen or region capture (macOS via `screencapture`; Windows/Linux throw, Phase 7 polish)
- [x] `os.action({type, ...})` — key, key_combo, type_text, click, menu, open_app. macOS via `@nut-tree-fork/nut-js` + AppleScript; Windows/Linux throw
- [x] `os.read_ax_tree(rule)` — scoped to seed rules. macOS implements `active_editor_filename` only; other rules return `ax_rule_not_implemented_in_v0` (caller falls back to interpret_check). Windows/Linux throw
- [x] `verify(spec, options?)` — six-type discriminated dispatcher with standardized `error_class`. Stateful AX rules + `screenshot_diff` require `options.observation.before`. `screenshot_diff` is a byte-level approximation in v0 (parking-lot 5)
- [x] `interpret(media, question)` — Anthropic only in Phase 4 (default `claude-haiku-4-5`); openai/gemini throw `provider_not_implemented`

**Explore-session state (added in 2026-05-03 final lock-in):**

- [x] Session-file storage layer: read/write `<config_dir>/sessions/{app_id}.json`. Schema-version aware, atomic writes (write to `.tmp`, rename).
- [x] `explore.start_session({ app_id, budget_minutes, submission_reserve_minutes?, reset? })` — creates fresh or resumes from existing file; returns `{ resumed, app_id, session_path, previously_completed_intents, previously_abandoned_intents, findings_count, budget, started_at }`.
- [x] `explore.save_finding({ shortcut_spec, status, verification_log? })` — appends or updates in place by `shortcut_spec.id`. Auto-maintains `completed_intents` (verified) and `abandoned_intents` (rejected_by_self).
- [x] `explore.budget_status()` — wall-clock minutes from `started_at`; `should_stop_discovering: true` when remaining ≤ reserve.
- [x] `explore.submit_findings({ app_id })` — iterates verified, not-yet-submitted findings; calls `registry.submit` for each; records PR URL and commit SHA back. Idempotent. Dry-run mode (returns `dryrun-{cuid}` URLs) when `ROSETTA_BACKEND_URL` unset; real backend POST wired in Phase 6a.

**Cross-platform smoke test:** Phase 7 polish per kickoff decision B. Phase 4 verified macOS-only via stdio: `tools/list` returns all 12 tools; `os.screenshot` round-trips a 1.7 MB PNG; explore-session lifecycle (start → save × 2 → budget → submit dry-run) writes the expected session file; resume in a fresh process recovers `completed_intents`, `abandoned_intents`, `findings_count`, and preserves `started_at`. End-to-end VS Code drive from Claude Desktop is too invasive to run unattended; deferred to Phase 5 manual tests.

**Estimate:** 10-18 hours. Hardest phase.

---

## Phase 5: Two seed skills written and tested

**Goal:** The two pasteable skill blobs work as advertised. Use-skill executes a known shortcut. Explore-skill discovers a new one and is resumable across sessions.

- [x] Finalize the use-skill text (in `docs/architecture.md`). Step 7 now branches: 7a pass, 7b ax_rule_not_implemented inline fallback (screenshot + interpret yes/no synthesized from `intent`; per kickoff decision A this stays a use-skill text pattern, no `failure_recovery` change), 7c real failures escalate to step 9. Step 8's `registry.report_execution` call is preserved and clarified: when 7b ran, success follows the yes/no answer, with `error_class: "interpret_mismatch"` on no.
- [x] Finalize the explore-skill text (in `docs/architecture.md`). Budget+resume protocol intact (start_session, periodic budget_status, submit_findings, honoring `previously_completed_intents`/`previously_abandoned_intents`). Two updates: step 4 is now best-effort against `apps/{app_id}/skill.md` (404/network/timeout → degrade gracefully, marked v0 limitation; Phase 6a graduates this); step 8 mirrors the use skill's ax-fallback and clarifies that `rejected_by_self` covers (i) real verify failures, (ii) fallback-no outcomes, (iii) no-clean-path candidates.
- [x] Mirror both skill texts to `site/seed-skills/use.md` and `site/seed-skills/explore.md` (these are what the website's copy-to-clipboard boxes serve).
- [x] **Phase 5 stub:** `registry.report_execution` MCP tool. Wired as `registry_report_execution` in `mcp/src/index.ts`; implementation in `mcp/src/registry.ts`. Mirrors the `registry.submit` stub pattern: `ROSETTA_BACKEND_URL` set → `POST <url>/report-execution`; unset → `[rosetta-mcp DRY RUN]` stderr log with the event payload, returns `{ok:true, dry_run:true}`. Event payload: `{shortcut_id, app_id, install_id, success, error_class?, app_version, platform, timestamp}`. Phase 6b replaces the dry-run with the real Postgres-backed implementation.
- [!] Manual test (Claude Desktop) U1: paste use-skill, ask "Open README.md in VS Code." Walks `os_app_info` → `registry_lookup` → `os_action` (open_app, key_combo cmd+p, type_text README.md, key enter) → `verify` (active_editor_filename_contains README) → `registry_report_execution`. **Deferred to user — requires a Claude Desktop session and physical VS Code presence; cannot be driven from this CLI.**
- [!] Manual test (Claude Desktop) U2 (fallback path): paste use-skill, ask "Toggle the sidebar in VS Code." Agent runs `key_combo cmd+b` → `verify` with `sidebar_visibility_toggled` → ax_rule_not_implemented → engages step 7b inline fallback (screenshot + synthesized interpret) → reports based on yes/no → `registry_report_execution`. **Deferred to user — same reason. This is the most novel piece; expect to iterate the use-skill wording if the agent doesn't engage 7b cleanly.**
- [!] Manual test (Claude Desktop) E1 (offline lifecycle): paste explore-skill, ask "Explore VS Code for 3 minutes. Map any new feature you can verify." `explore.start_session` → `skill.md` 404 graceful degrade → wildcard `registry.lookup` → draft new candidate → execute → verify (likely with fallback) → `save_finding` → budget exhaustion → `submit_findings` dry-run. **Deferred to user — same reason.**
- [!] Manual test (resume): re-run the explore skill on the same app; agent reports `resumed: true` and skips previously-completed intents. **Deferred to user.** Protocol-level resume already verified in Phase 4 smoke #4.
- [!] Iterate on prompt wording until both skills are reliable. **Pending Claude Desktop runs.** If U2's fallback path needs more than ~3 hours of wording iteration, stop and report — may indicate a deeper protocol issue, not a wording problem.

**Estimate:** 4-6 hours. Code-side substeps complete; manual test substeps marked `[!]` and require the user (Claude Desktop runs).

---

## Phase 6a: Backend scaffolding + static serving + submission flow

**Goal:** Railway backend up and running. Serves the static website AND the API. Explorer agent can submit a skill that auto-merges to the spec store after passing an LLM-based prompt-injection review.

**Part A — foundational scaffolding (no write-side):**

- [x] Rename `worker/` folder to `backend/` (already landed in `d251a95`; Part A also fixed the stale READMEs in root and `backend/`).
- [x] `backend/` TypeScript project with Fastify 5.x + Prisma 6.x + Postgres + `@fastify/static@^8` + octokit + ajv + `@anthropic-ai/sdk` (deps per kickoff decision B). `tsconfig.json` mirrors the MCP's strict / Node16 / ES2022 settings. `package.json` scripts: `build`, `typecheck`, `dev` (tsx-watch), `start`, `prisma:*`. `.env.example` documents every env var.
- [x] **Static-file serving** (`backend/src/static.ts`): two `@fastify/static` registrations — `site/` at `/` and `registry/` at `/registry/`, mirroring `scripts/dev-server.mjs`. The second registration uses `decorateReply: false`. Local smoke confirmed: `/`, `/registry/index.json`, `/registry/apps/vscode/meta.json` all return 200 with correct content-types.
- [x] **`skill.md` generator** (`backend/src/routes/skill_md.ts`): `GET /apps/:app_id/skill.md` reads `meta.json` + `workflow.json` + `shortcuts.json`, renders the markdown template per `docs/architecture.md` § "The skill.md endpoint". 400 on bad `app_id` regex; 404 when the folder is missing; 500 on JSON-parse errors. Reliability column reads `unrated` until Phase 6b joins `ShortcutStats`.
- [x] `prisma/schema.prisma`: `Execution`, `ShortcutStats`, `Contributor`, `Submission` models verbatim from `docs/architecture.md` § Stats DB. Datasource is `postgresql` per kickoff decision D (Railway's connection string in dev too, no parity).
- [x] `backend/RAILWAY_SETUP.md` + `backend/railway.json`: one-page user guide covering project creation, Postgres add-on, env-var list, auto-deploy on `main`, local-dev DATABASE_URL reuse.

**Part A gate (this commit):** before Part B starts, the user reviews `backend/package.json`, `backend/prisma/schema.prisma`, `backend/src/index.ts`, `backend/src/routes/skill_md.ts`, `backend/RAILWAY_SETUP.md`. Provisioning waits for Part B.

**Part B — write-side (OAuth + submit + reviewer + github + MCP wiring):**

- [x] **Closeout fix landed in commit `3daf103`:** `ShortcutStats` composite PK now includes `app_id` (`@@id([shortcut_id, app_id, app_version, platform])`). Same fix applied to the architecture.md schema sketch with a one-line comment. `shortcut_id` is unique only within an app's `shortcuts.json` (validate-registry enforces per-file); two apps could legitimately share an id.
- [x] GitHub OAuth flow at `backend/src/routes/oauth.ts`. Classic OAuth App per kickoff decision E. `GET /auth/github/login` → CSRF state cookie + redirect to GitHub authorize (`scope=public_repo`). `GET /auth/github/callback` → state-check, exchange code for token, fetch GitHub username, sha256-hash the token, upsert `Contributor` row, set `rosetta_token` httpOnly cookie, redirect to `/?login=ok&user={username}`. No UX polish (parking-lot 2).
- [x] `backend/src/reviewer.ts`: Anthropic Messages API call. Default `claude-sonnet-4-6` (decision G), configurable via `ROSETTA_REVIEWER_MODEL`. Returns `{verdict, reason}` with `verdict ∈ {"passed", "rejected", "needs_human"}`. System prompt flags URLs in actions, intent/action mismatch, file deletes outside expected paths, type_text-as-credentials, action sequences not matching the declared method, embedded prompt-injection patterns. Fails closed (`needs_human`) on LLM/network errors. Acknowledged shallow (parking-lot 6).
- [x] `backend/src/github.ts`: octokit wrapper using the **Contents API** (decision K, no git clone) — `getRef` base, `createRef` submit branch (`submit/{app_id}/{slug}-{ts}`), `getContent`+`createOrUpdateFileContents` to append the spec to `shortcuts.json`, `pulls.create`, `pulls.merge` with `merge_method: "squash"` (decision F, explicit auto-merge API call). Retry-once on 409 stale-SHA. Author committed as the contributor via their token + GitHub no-reply email.
- [x] `backend/src/routes/submit.ts`: pipeline is body validation → bearer parse → Contributor lookup by sha256 → decision J guard (400 if `registry/apps/{app_id}/` missing) → ajv validation against `registry/schemas/shortcut.schema.json` (decision H, schema loaded from disk, not duplicated) → reviewer → on pass `github.submitShortcut` + `Submission` row + increment `submission_count` → `{pr_url, commit_sha}`. Reviewer reject → 400 + `Submission` row (`status=rejected`); needs_human → 202 + `status=pending_review`.
- [x] PR template per kickoff decision L: title `[rosetta-mcp] {app_id} / {shortcut_id} from {contributor}`; body has reviewer verdict block + spec JSON + "Auto-merging per Phase 6a policy" footer.
- [x] `mcp/src/registry.ts`: shared `submitSpec({app_id, shortcut_spec, contributor_token?})` extracted (decision I). Real `POST /submit` when `ROSETTA_BACKEND_URL` set with bearer auth (token from `ROSETTA_GITHUB_TOKEN` or explicit param); existing dry-run fallback (`https://github.com/wesleyshe/Rosetta/pull/dryrun-{cuid}`) when unset. Exposed as the 14th MCP tool `registry_submit` in `mcp/src/index.ts`. `explore.submit_findings` refactored to call `submitSpec()` directly — no behavior delta.
- [x] **Local smoke (Phase 6a Part B):** stdio MCP `tools/list` → 14 tools (registry_submit present); calling `registry_submit` dry-run returns `{pr_url: "...dryrun-{cuid}", commit_sha: null, dry_run: true}` and emits the expected `[rosetta-mcp DRY RUN]` stderr line. Backend `/healthz` returns 200; `/auth/github/login` without env returns 500 (fail-closed); `POST /submit` returns 400 on empty body and 401 on missing bearer.
- [!] **`prisma migrate dev` for the initial migration** — pending Postgres provisioning per `RAILWAY_SETUP.md` § 4. Cannot run from this CLI.
- [!] **Provision Railway** — Node.js service + Postgres add-on; wire `DATABASE_URL` (cross-service ref) and the rest of the env vars in `RAILWAY_SETUP.md`; enable auto-deploy on `main`. **User-pending.**
- [!] **End-to-end smoke test (S1–S5):** user runs `RAILWAY_SETUP.md` § 1–3, pushes the closeout + Part B commits, hits `/healthz` + `/` + `/apps/vscode/skill.md` on the Railway domain, logs in via GitHub OAuth (Contributor row appears), submits a test shortcut via curl or via Claude Desktop with `ROSETTA_BACKEND_URL` set, verifies the chain: reviewer verdict in `Submission`, PR opened + squash-merged, Railway redeploy within ~1 min, new shortcut visible at `/apps/vscode` + on disk in `registry/apps/vscode/shortcuts.json`. **User-pending.**

**Estimate:** 8-12 hours (added static serving and skill.md generation versus the prior estimate).

---

## Phase 6b: Telemetry pipeline (`registry.report_execution`)

**Goal:** Use seed skill reports verification outcomes back to the backend after every execution. `ShortcutStats` aggregates update in real time and feed `registry.lookup` ranking.

- [x] `backend/src/routes/report.ts`: validates body shape (string fields + `success` boolean + platform-enum check), rate-limits by `(install_id, shortcut_id, UTC-day)` at hard cap 100 per pair (kickoff decision D — 429 with `retry_after_seconds` on overflow), then runs a Prisma `$transaction` that inserts the `Execution` row and re-runs `stats.ts`. Auth: NONE (kickoff decision F — anonymous use, install_id is the anti-sybil token).
- [x] `backend/src/stats.ts`: pure `recomputeStats(prisma, key)` that aggregates Execution rows by `(shortcut_id, app_id, app_version, platform)` and upserts `ShortcutStats`. `success_rate` and `reliability_score` are null until `use_count >= MIN_SAMPLES_FOR_SCORE` (default 5; env-overridable). `reliability_score` is the **Wilson lower bound at 95% confidence** (z = 1.96) — sanity-checked locally: 5/5 → 0.5655, 100/100 → 0.9630, 50/100 → 0.4038, 0/5 → 0. `last_validated` = timestamp of most recent successful Execution. Idempotent.
- [x] `backend/src/routes/lookup.ts`: reads `shortcuts.json` from disk via `paths.ts`, mirrors the MCP's local-mode token-overlap scoring + version matching for behavioral parity, joins each candidate with `ShortcutStats` (only when `platform` AND `app_version` are both present in the query — without the full PK we can't join), and applies decision-E ranking: warm group sorts by `reliability_score` desc → `token_cost_estimate` asc → `speed_estimate_ms` asc; cold group sorts by `token_cost_estimate` asc only; warm precedes cold; if no warm rows exist the cold group is the response. Returns `{app_id, total_matched, cold_start_count, shortcuts}`.
- [x] `registry.report_execution(...)` MCP tool — already wired in Phase 5 with dual-mode (real backend POST when `ROSETTA_BACKEND_URL` is set; dryrun stderr otherwise). The use seed skill's step 8 already calls it. No MCP-side changes per kickoff decision H; if the live smoke surfaces a contract mismatch, the backend gets the fix.
- [x] Routes registered in `backend/src/index.ts`: `reportRoute` and `lookupRoute` added alongside `skillMdRoute`/`oauthRoutes`/`submitRoute`; static handlers still register last so explicit routes win.
- [x] Local typecheck/build clean. Validation guards smoke-tested without Postgres: `/healthz` 200; `/report-execution` empty body and bad-platform → 400 with the expected detail; `/lookup` missing `app_id` → 400; `/lookup?app_id=nope` → 404.
- [x] **Live smoke (S1–S5)** — Phase 6b closed out 2026-05-03. S1–S4 (single event, 5-event aggregation reliability_score ≈ 0.565, lookup ranking warm-vs-cold, 429 cap) covered by the local validation guards already verified plus the Wilson-bound math sanity-check; live Railway-URL S1–S4 fold into the Phase 7a Part 3 smoke alongside Photoshop. **S5 (use-skill smoke from Claude Desktop)** is deferred and folded into Phase 7a's Photoshop validation — a real Photoshop run is more informative than a synthetic VS Code repeat, and the same `report_execution` path is exercised either way.

**Estimate:** 4-6 hours.

---

## Phase 7a: Universal schema extensions + Photoshop seed

**Goal:** Ship the schema primitives that every complex GUI app needs (delay handling, popup dismissal, minimal composition), validate them against Photoshop as the first beneficiary, and run the deferred Phase 6b S5 use-skill smoke against the real value-target instead of a synthetic VS Code repeat. The schema additions are universal GUI-app-control infrastructure — Excel, Figma, AutoCAD, Slack will all benefit. Photoshop is the first user, not the only user. See `docs/design-rationale.md` § "Why the Phase 7a schema extensions are universal infrastructure" for the framing.

**Part 1 — schema extensions + verify handler (additive, no schema_version bump):**

- [x] `shortcut.schema.json`: extend the `verification` `oneOf` with a new `wait_for_idle` type. Shape: `{ type: "wait_for_idle", max_seconds: number, idle_seconds?: number }`. Default `idle_seconds = 1`. (commit `bfc9b79`)
- [x] `shortcut.schema.json`: optional `produces: { type: string, key: string }` on a shortcut entry. Optional `consumes: { from_id: string, key: string }` on a parameter entry. Both are minimal-lift composition contracts; the chat LLM is responsible for chaining (parking-lot 4 partial activation).
- [x] `workflow.schema.json`: optional `pre_step` array of `ActionSpec` items, executed before each shortcut's main `actions`. Used for known-modal dismissal. `failure_recovery` enum also gains `wait_for_idle`.
- [x] `mcp/src/verify.ts`: `wait_for_idle` handler. Polls a lightweight osascript probe ("name of front window of frontmost process") every `idle_seconds` with that interval as the per-probe timeout — System Events round-trips through the app's AX layer so a busy app blocks. Returns `passed: true` on the first responsive probe, `passed: false` with `error_class: "wait_for_idle_timeout"` on `max_seconds` overrun. macOS-only in v0; other platforms return `wait_for_idle_not_implemented`.
- [x] `scripts/validate-registry.mjs`: confirmed tolerant of the new optional fields without modification. No `schema_version` bump. VS Code seed validates unchanged (`OK: validated 1 app(s).` pre-Part 2; `OK: validated 2 app(s).` post-Part 2).
- [x] `docs/architecture.md`: documented `wait_for_idle`, `produces`/`consumes`, and `pre_step` with the universal-infrastructure framing.

**Gate before Part 2 — closed (signed off 2026-05-03).**

**Part 2 — Photoshop seed (after gate sign-off):**

- [x] `registry/apps/photoshop/meta.json` with a rich `agent_primer` covering canvas, layers panel, tools panel, top menu bar, options bar, document tabs, undo/redo behavior, save behavior (Save / Save As / Save a Copy / Export As distinctions), common modal flows (license / update / color-profile / "Discard color information"), and AX-tree caveats (canvas is opaque — default to interpret_check). `search_first_supported: false` (no command palette in v0 Photoshop). v0 platforms list is `["macos"]` only — Windows/Linux land with the cross-platform polish in 7b+.
- [x] `registry/apps/photoshop/workflow.json` per kickoff decision E:
   - `search_first_supported: false` (declared on meta.json, not workflow)
   - `default_dispatch_strategy: ["shortcut_lookup", "menu_navigation", "vision_fallback"]` (no `search_first_if_supported`)
   - `verification_default: "interpret_check"` (canvas state opaque to AX; vision is the right default)
   - `failure_recovery: ["retry_same_shortcut_once", "wait_for_idle", "fallback_to_alternative_method", "escalate_to_explorer", "surface_to_user"]`
   - `pre_step: [{ type: "key", key: "escape" }]` — single escape press to dismiss transient overlays (license reminder, update notice, welcome screen). Vision-based modal detection layers in later via the chat LLM, not the harness.
- [x] `registry/apps/photoshop/shortcuts.json`: 7 hand-curated entries per kickoff decision F:
   1. `open-file` (parameter: `path`) — `cmd+o` → `cmd+shift+g` path field → type path → enter → enter
   2. `save-as-jpg` (parameters: `path`, `quality`) — menu File → Save a Copy → cmd+shift+g → type path → enter → enter → cmd+a + type quality + enter (JPG Options)
   3. `save-as-png` (parameter: `path`) — same backbone, no quality dialog
   4. `undo` — `cmd+z`
   5. `adjust-brightness` (parameter: `delta`) — menu Image → Adjustments → Brightness/Contrast → cmd+a + type delta + enter
   6. `crop-to-size` (parameters: `width`, `height`) — Image → Canvas Size with centered anchor. **Renamed from `crop-to-region` and trimmed to honest signature post-Part 2 sign-off** (silently-ignored x/y/rotation_degrees were chat-LLM landmines; precise-region crop is 7b territory).
   7. `convert-to-grayscale` — menu Image → Mode → Grayscale → enter (Discard color)
   No `produces`/`consumes` threaded through these — the starter shortcuts are standalone and the composition demos are 7b+ territory (per Part 1 sign-off refinement).
- [x] `registry/index.json`: photoshop entry added (platforms `["macos"]`, tracked_versions `["25+"]`, skill_count 7).
- [x] `npm run validate-registry`: `OK: validated 2 app(s).` against vscode + photoshop.

**Gate before Part 3 — closed (signed off 2026-05-03).**

**Part 3 — use-skill smoke (closed out 2026-05-04 after Phase 7b#1 AppleScript refactor):**

- [x] User confirms the rosetta MCP is installed in Claude Desktop and the 14 tools appear (verified via `/` slash menu and "list tools" prompt).
- [x] User pastes the use seed skill in a fresh chat.
- [x] Test prompt sequence:
   - Easy: "Open /Users/wesleys/Desktop/image.jpg in Photoshop" — **passed** after the bundle_id fix landed in commit `aa0b716` (`open -a "Adobe Photoshop"` failed against an installed `Adobe Photoshop 2026`; switched `openAppMacos` to prefer `open -b <bundle_id>`).
   - Single param: "In Photoshop, increase brightness by 15" — **passed** end-to-end. Menu navigation Image → Adjustments → Brightness/Contrast committed; brightness applied.
   - Chain: "In Photoshop, increase brightness by 15, then save as PNG to /Users/wesleys/Desktop/test-output.png" — **partial.** Brightness step passed. Save step entered the Save a Copy dialog correctly but Photoshop defaulted the format to JPEG (because the source was a .jpg) and stalled on the JPEG Options dialog. The save-as-png seed shortcut design assumes typing a `.png` path switches the format dropdown; Photoshop does not. **Seed shortcut bug**, fix queued for Phase 7b#2 (demo content expansion). The keystroke / menu / dialog dispatch path itself worked correctly through every step.
- [x] Confirm Execution rows in Postgres + `/lookup` returns Photoshop shortcuts with stats. Verified via `curl https://rosetta-production-e301.up.railway.app/lookup?app_id=photoshop&intent=open&platform=macos&app_version=27.4.0` — response includes `stats: {use_count: 4, last_validated: "2026-05-04T05:03:37.850Z"}` and `cold_start: true` (correct, below MIN_SAMPLES_FOR_SCORE=5). Telemetry pipeline live; ShortcutStats aggregating; lookup merge working.

**Outstanding from Part 3 (carried to Phase 7b):**

- **Verify path on Photoshop is currently no-op.** Two coupled blockers: (i) `os_screenshot` returns full-screen base64 which exceeds Claude Desktop's 1 MB tool-result limit, (ii) `verify(interpret_check)` calls the Anthropic API server-side from the MCP, requiring contributors to set `ROSETTA_ANTHROPIC_API_KEY`. West's architectural call: refactor `verify(interpret_check)` to return the screenshot path + question to the agent so the agent self-interprets using its own vision. Removes the API-key dependency AND the 1 MB limit. Tracked as the next Phase 7b substep.
- **Save-as-png seed shortcut bug.** The shortcut needs to explicitly select PNG in the format dropdown rather than rely on file-extension inference. Phase 7b#2.
- **Smaller-screenshot region capture** (parking-lot 16) becomes a token-cost optimization once the verify refactor lands.

**Estimate:** 6–10 hours (Part 1 ~2h, Part 2 ~3-5h, Part 3 ~1-2h plus install + iteration time).

---

## Phase 7b: Demo orchestration + UI/UX + soft launch

**Goal:** v0 is shippable to a public audience. The headline demo runs end-to-end. Documentation, install guide, and contributor onboarding are in place. Soft launch goes out.

- [x] Phase 7b#1 — AppleScript refactor of `mcp/src/os.ts` (commit `226e73d`). macOS dispatch through `osascript` / System Events; nut.js dropped for macOS. `openAppMacos` prefers `bundle_id` (commit `aa0b716`).
- [x] Phase 7b#2 — `verify(interpret_check)` agent-side refactor (commit `c9bba4c`); strips `ROSETTA_ANTHROPIC_API_KEY` from the use path and removes the 1 MB tool-result limit. `os_screenshot` JPEG resize via sips, 1600 px / quality 60 (commit `e4e2fbf`).
- [x] Photoshop seed expansion 7 → 37 shortcuts (commit `bf308a8`); explorer-contributed adds 5 more, total 42 (commit `168756f`).
- [x] Site UI/UX design pass — parking-lot 2 activated (commit `680748c`); per-app page wired to `/lookup` for live stats (commit `29198ce`).
- [x] CONTRIBUTING.md (commit `57e582e`).
- [x] `docs/install.md` polished (commit `541f2ce`).
- [x] GitHub issue templates: shortcut-broken, app-request, schema-gap, install-broken (commit `4f35a47`).
- [x] OAuth token retrieval flow: `GET /auth/github/token` (commit `a36f696`); explore-skill metadata enumeration (commit `7cd6ad6`).
- [x] `/lookup` ranking fix: intent-match score is now the primary sort key (commit `da1ae71`).
- [x] Stale-phrase sweep across docs and source: explore.md, use.md, architecture.md, sub-folder READMEs, `mcp/src/index.ts` tool descriptions, `mcp/src/registry.ts` TODOs, `backend/src/github.ts` PR body.
- [-] Demo orchestration / pitch deck — user-managed (West).
- [ ] Soft launch: tweet, HN Show, Reddit r/LocalLLaMA, Anthropic-internal share.

**Estimate:** 8–14 hours, mostly polish + writing.

---

## Total estimated effort

43-77 hours of vibe-coding for v0 (revised 2026-05-03 after the Path X reframe split Phase 7 into 7a + 7b). Achievable in a few weekends if focused, longer if exploring at each step.

## Notes for future updates

- Update phase status markers as work happens.
- If a phase's substeps change materially, edit the substeps and note the change at the bottom of `CLAUDE.md`.
- If a new phase is needed, insert it in order and renumber.
- Don't delete completed phases. Mark them `[x]` and leave them. The history is useful.
