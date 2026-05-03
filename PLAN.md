# Execution Plan

Live document. Update phase status as work progresses. Each phase has a goal, substeps, and a status marker.

Status markers: `[ ]` not started, `[~]` in progress, `[x]` done, `[!]` blocked.

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
- [x] `verify(spec, options?)` — six-type discriminated dispatcher with standardized `error_class`. Stateful AX rules + `screenshot_diff` require `options.observation.before`. `screenshot_diff` is a byte-level approximation in v0 (parking-lot 12)
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

- [ ] Rename `worker/` folder to `backend/` (`git mv worker backend` and update READMEs)
- [ ] `backend/` TypeScript project with Fastify + Prisma + Postgres. Mirror the Claw_Street_Bets structure where it makes sense.
- [ ] Provision Railway: Node.js service + Postgres add-on. Wire `DATABASE_URL` via Railway env.
- [ ] Configure Railway's GitHub integration to redeploy automatically on push to `main`.
- [ ] **Static-file serving** (`backend/src/static.ts`): serve `site/` (HTML, CSS, JS) and `registry/` (JSON specs) from the deploy's disk via `@fastify/static`. Confirm the website loads end-to-end at the Railway-assigned URL.
- [ ] **`skill.md` generator** (`backend/src/routes/skill_md.ts`): `GET /apps/{app_id}/skill.md` reads `meta.json` + `workflow.json` + `shortcuts.json` from disk and renders the agent-context markdown template (see `docs/architecture.md` § "The skill.md endpoint").
- [ ] `prisma/schema.prisma`: define `Execution`, `ShortcutStats`, `Contributor`, `Submission` models per `docs/architecture.md`
- [ ] `prisma migrate dev` for the initial migration
- [ ] GitHub OAuth flow on the static site, OAuth callback handled by `backend/src/routes/oauth.ts`. Hashed token stored in `Contributor.oauth_token_hash`.
- [ ] `backend/src/routes/submit.ts`: validates the spec against `shortcut.schema.json`, runs `reviewer.ts` (LLM prompt-injection check), creates a branch + commit + PR + auto-merge via the GitHub REST API using the contributor's token, writes a `Submission` row.
- [ ] `backend/src/reviewer.ts`: simple LLM call (Anthropic API) that returns `{ verdict: "passed" | "rejected" | "needs_human", reason: string }` for a given spec. Acknowledged shallow; sufficient for v0 per parking-lot item 1.
- [ ] `backend/src/github.ts`: thin wrapper over Octokit for branch / commit / PR / merge operations.
- [ ] `registry.submit(skill_spec)` MCP tool that calls `POST /submit`
- [ ] PR template auto-populated with the spec diff, reviewer verdict, and contributor handle
- [ ] Smoke test: explorer agent submits a real skill, backend reviewer passes it, PR opens and auto-merges, Railway redeploys, the website at `apps/{app_id}` shows the new shortcut, `lookup` returns it on next call.

**Estimate:** 8-12 hours (added static serving and skill.md generation versus the prior estimate).

---

## Phase 6b: Telemetry pipeline (`registry.report_execution`)

**Goal:** Use seed skill reports verification outcomes back to the backend after every execution. `ShortcutStats` aggregates update in real time and feed `registry.lookup` ranking.

- [ ] `backend/src/routes/report.ts`: validates the event, rate-limits by `(install_id, shortcut_id, day)`, inserts an `Execution` row, triggers `stats.ts` re-aggregation.
- [ ] `backend/src/stats.ts`: rolling re-computation of `use_count`, `success_count`, `success_rate`, `reliability_score` (Wilson lower bound), `last_validated` for the affected `(shortcut_id, app_version, platform)` row in `ShortcutStats`. Run inline on the request path; v0 scale doesn't need a job queue.
- [ ] `backend/src/routes/lookup.ts`: reads matching specs from the deploy's disk under `registry/apps/{app_id}/`, joins with `ShortcutStats`, applies cold-start logic (mark as `cold_start: true` when `use_count < MIN_SAMPLES_FOR_SCORE`, default 5), returns ranked array.
- [ ] `registry.report_execution(...)` MCP tool that posts the event. Called automatically by the use seed skill.
- [ ] Smoke test: run the same VS Code shortcut multiple times in a row, watch `success_rate` and `reliability_score` populate in Postgres, confirm `registry.lookup` returns updated stats.
- [ ] Smoke test: try to spam ten reports for the same shortcut from the same `install_id`, confirm rate limiting kicks in.

**Estimate:** 4-6 hours.

---

## Phase 7: Polish + first explorer run on a real app

**Goal:** v0 is shippable. Documentation complete. Photoshop has a starter set of shortcuts contributed by the explorer agent.

- [ ] Run explorer agent against Photoshop (or the next-priority app)
- [ ] Review and merge submitted PRs
- [ ] Write CONTRIBUTING.md
- [ ] Write `docs/install.md` with the one-command MCP install + paste seed skill flow
- [ ] Add issue templates for "broken skill" and "missing app"
- [ ] Soft launch: tweet, HN Show, Reddit r/LocalLLaMA

**Estimate:** 4-6 hours.

---

## Total estimated effort

37-63 hours of vibe-coding for v0 (revised again after the 2026-05-03 final lock-in: agent_primer field, explore budget+resume tooling, Railway-everywhere serving, skill.md generation). Achievable in a few weekends if focused, longer if exploring at each step.

## Notes for future updates

- Update phase status markers as work happens.
- If a phase's substeps change materially, edit the substeps and note the change at the bottom of `CLAUDE.md`.
- If a new phase is needed, insert it in order and renumber.
- Don't delete completed phases. Mark them `[x]` and leave them. The history is useful.
