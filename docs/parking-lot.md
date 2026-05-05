# Parking Lot

Deferred items, **ranked by priority — top = highest priority**. The first item is the next thing to revisit when we have parking-lot bandwidth. When adding new items, slot in by priority and renumber the list. Each entry: what it is, why it's deferred, what would trigger us to pick it back up, and the current placeholder behavior.

## Status overview

Numbers are stable IDs (referenced by code, change-log, and docs). Items don't move when their status changes — the marker is updated in place.

| #  | Item                                                  | Status                       |
|----|-------------------------------------------------------|------------------------------|
| 1  | Workflow plurality                                    | Parked                       |
| 2  | Website UI / UX design                                | Implemented (2026-05-03)     |
| 3  | Sensitive action gating                               | Implemented (2026-05-04)     |
| 4  | Cross-skill composition contracts                     | Implemented (2026-05-05)     |
| 5  | screenshot_diff semantic refinements                  | Partially implemented (2026-05-04) |
| 6  | Bad skills / prompt injection                         | Partially implemented (2026-05-02) |
| 7  | Nixpacks injects secrets at build time                | Implemented (2026-05-05)     |
| 8  | Automated skill decay detection                       | Partially implemented (2026-05-02) |
| 9  | Multi-window / multi-instance app handling            | Partially implemented (2026-05-05) |
| 10 | Adversarial app vendors                               | Resolved — no engineering action |
| 11 | Internationalization / locale variation               | Partially implemented (2026-05-05) |
| 12 | Graduate to Prisma migrations                         | Parked                       |
| 13 | Skill schema versioning beyond major-version bumps    | Partially implemented (2026-05-05) |
| 14 | Web chat client support                               | Parked                       |
| 15 | Payment / contributor reward economy                  | Parked                       |
| 16 | Smaller screenshots for vision-based verification     | Partially implemented (2026-05-04) |

"Implemented" = the original deferral is fully resolved. "Partially implemented" = some sub-pieces shipped; the rest are documented under **Still parked** in that item's body. "Parked" = not started in v0.

## 1. Workflow plurality / competition between workflows per app

**What:** workflow.json is currently singular per app — exactly one generic workflow describes how to dispatch and verify shortcuts for that app. This contradicts the "let competition drive quality" principle that already governs shortcuts (multiple shortcuts can match one intent; agent picks by reliability_score; we don't deduplicate). The same principle should apply to workflows: multiple plausible generic-workflow approaches per app should compete on empirical hit-rate. For an app like Photoshop, examples include: canvas-region screenshot vs full-screen, AX-only vs screenshot-based, interleaved vs end-only verification. Different approaches have different trade-offs (speed, robustness, UI-resistance). The registry should let users surface the empirically-best one rather than locking in a maintainer's guess.

**Why deferred:** v0 has only VS Code, where workflows are overwhelmingly palette-and-AX dominant. Competing approaches likely don't differ meaningfully in hit-rate. No empirical pressure to surface a winner because there's only one plausible workflow. The architectural change is non-trivial: workflows.json plural form, WorkflowStats table, lookup + selection logic, attribution of Execution events to a specific workflow_id.

**Trigger to pick up:** When authoring the second app's workflow (probably Photoshop in Phase 7) reveals that multiple plausible approaches exist and we want to A/B them empirically. Or when a contributor tries to submit a competing workflow approach for an existing app and there's no path.

**Placeholder behavior:** Maintainer authors the single workflow per app. If it turns out wrong, fix manually rather than receive competing submissions. Schema reserves nothing yet — when activated, the migration is non-trivial (singular → plural; schema_version bump likely required). The /submit endpoint accepts only shortcuts; workflow updates are maintainer-only.

**Why this matters:** Symmetric with how shortcuts already work. Without this, the registry can't empirically evolve workflow approaches, which limits its ability to handle apps with messy or vision-heavy UIs. Phase 7+ critical for any meaningful expansion beyond VS Code.

---

## 2. Website UI / UX design (IMPLEMENTED 2026-05-03)

**What:** A real design pass for the human-facing landing page and the per-app database pages — typography, color, spacing scale, reliability-score visualization, shortcut-list layout, cold-start indicators, mobile responsiveness, copy tone.

**Status:** Done. `docs/site-design.md` (50-100 lines) covers landing-page goal, visual anchor, per-app-page layout decisions, copy tone. Implementation lives in `site/index.html`, `site/app.html`, `site/style.css`. The per-app page reads live ShortcutStats from `/lookup` and renders reliability cells with a warm/cold-start split.

---

## 3. Sensitive action gating (IMPLEMENTED 2026-05-04)

**What:** Some shortcuts perform irreversible or high-stakes actions. The use-skill pauses to confirm before running them.

**Status:** Active in v0. The schema's `risk` field (`safe` default; `destructive`, `financial`, `external_communication`) gates step 5 of the use-skill protocol — anything other than `safe` triggers a plain-language confirmation before the shortcut's actions run. The agent treats the original user request as implicit consent when it explicitly named the destructive action. Photoshop seed shortcuts tagged: `convert-to-grayscale`, `merge-down`, `merge-visible`, `flatten-image`, `close-document`. `docs/skills.md` documents per-level guidance; the use-skill text is mirrored in `site/seed-skills/use.md` and `docs/architecture.md`.

**What's still parked:** Sandboxing, signed-skill requirements, action-type allowlists per risk class, and contributor reputation are all part of parking-lot 6 (bad skills / prompt injection) and stay parked until the trigger fires there.

**Trigger to pick those up:** First incident involving a destructive action that the LLM gate failed to catch, or before targeting a non-power-user audience.

---

## 4. Cross-skill composition contracts (IMPLEMENTED 2026-05-05)

**What:** When the user asks "increase brightness, add a dog, crop the photo," the agent chains shortcuts. The contract for how outputs feed into downstream inputs needs to be expressible AND enforceable at runtime.

**Status:** Both halves done.

- (2026-05-03) Schema surface: optional `produces: {type, key}` on a shortcut, optional `consumes: {from_id, key}` on a parameter. Contributors can declare composition intent.
- (2026-05-05) Runtime enforcement: `registry_chain_state` MCP tool with `set` / `get` / `list` operations. The use-skill calls `set` after each shortcut's verify passes (step 10) and `get` when resolving a downstream parameter that declares `consumes` (step 7). `get` throws on missing producer or type mismatch — the agent recovers by running the producer first, or by surfacing the broken chain to the user. Storage is process-local (one MCP process per chat session); chains spanning MCP restarts re-derive their state.

**Still parked:**
- Cross-app composition (the ledger keys by `(shortcut_id, key)` without app-scoping; contributors should keep keys distinct enough to avoid collision until app-scoping is added).
- Cross-session persistence (a chain that survives MCP restart). Tied to the explore-session persistence model; revisit when contributors hit it.
- A registry_execute consolidation tool that runs a shortcut end-to-end (open → execute → verify → set produces) atomically, removing the need for the LLM to orchestrate steps 6–11 per shortcut. Adds value for chained operations but the protocol-level approach works without it.

---

## 5. screenshot_diff semantic refinements (PARTIALLY IMPLEMENTED 2026-05-04, expanded 2026-05-05)

**What:** The `screenshot_diff` verification type originally expressed only `max_pixel_diff_ratio` ("verify nothing changed beyond N% of pixels"). The inverse direction ("verify something DID change"), region-aware assertions, a true PNG-decoded pixel diff, and reference-image hash matching were all parked.

**Status (2026-05-04):** Inverse direction shipped. `min_pixel_diff_ratio` is an optional field (default 0). Both bounds may coexist. The verifier returns `screenshot_changed_too_little` when `ratio < min` and `screenshot_changed_too_much` when `ratio > max`, mirror-symmetric.

**Status (2026-05-05):** True pixel diff shipped. `mcp/src/verify.ts` decodes both PNGs via `pngjs` and compares per-pixel R/G/B channels. Different-size images report 1.0; decode failure (non-PNG buffer) also reports 1.0 to keep the verifier total. Smoke against two back-to-back captures of an idle window: ratio ≈ 0.0004 (was 1.0 under the byte-level approximation), so the default `max: 0.02` no longer false-positives on real usage.

**Still parked:**
- Region-aware assertions: a `regions: [...]` array where each region has its own expected change behavior.
- Reference-image hash matching (`direction: "exact_match"`).

**Trigger to pick those up:** When a real shortcut needs per-region assertions, or when a contributor wants byte-stable expected-image comparisons.

---

## 6. Bad skills / prompt injection (PARTIALLY IMPLEMENTED 2026-05-02)

**What:** A contributed skill might be subtly wrong, wasteful, destructive, or contain prompt injection that hijacks the agent's behavior at execution time. Examples: a skill that says "delete file X" but really deletes a different file due to a bad selector; a skill whose `intent` description is "open file" but whose `actions` are "send password to evil.com"; a skill whose verification rule is satisfied by something other than the intended outcome.

**Status:** The original trigger condition (c) — "before turning on the explorer-agent's auto-PR submission" — has fired with the 2026-05-02 backend pivot. Submissions now auto-merge after an LLM-based reviewer. The full defense suite (sandboxing, signatures, fine-grained action allowlists) remains parked. What's now in v0:

- **Agent prompt-injection reviewer (LLM):** the backend's `/submit` endpoint runs the spec through an LLM check for obviously-malicious patterns (urls in actions, suspicious filenames, mismatch between `intent` and `actions`, etc.). Acknowledged shallow. Sufficient given the bootstrap-then-publish rollout plan and small initial registry size.
- **Verification-as-rating filter:** because reliability score is the verification-pass percentage, shortcuts that succeed locally but fail at scale get downranked automatically. This is the long-term filter once usage data accumulates.
- **GitHub identity on submission:** every spec carries `contributor_id`. Bad-actor accounts can be soft-banned by the backend without affecting the rest of the registry.

**Still parked (full activation triggers):** Either (a) registry crosses ~100 contributors or ~1,000 skills, (b) first reported incident of a malicious skill landing, or (c) before opening the contributor base beyond developers.

**Future work (not v0):** skill sandboxing in a VM, signature/checksum requirements, contributor reputation scores, action-type allowlists per skill category, mandatory human review for high-risk action types (file deletes, network requests, payments).

---

## 7. Nixpacks injects secrets as Docker ARG/ENV at build time (IMPLEMENTED 2026-05-05)

**What:** Railway's Nixpacks builder used to bake every project env var (including `ANTHROPIC_API_KEY` and `GITHUB_OAUTH_CLIENT_SECRET`) into image layers as ARG/ENV. Anyone with image-pull access could extract them.

**Status:** Replaced Nixpacks with a hand-written multi-stage `Dockerfile` at the repo root. The build accepts **no** secrets — `prisma generate` and `tsc` (the only build-time work) don't need them, so they don't appear as ARGs. Runtime secrets are injected to the running container by Railway at deploy time, never landing in image layers. `railway.json` switched from `"builder": "NIXPACKS"` to `"builder": "DOCKERFILE"`.

**One-time cutover task for the operator:** rotate any secrets that lived in pre-cutover deployed images. The image layers from those deploys may still exist in Railway's registry until garbage-collected, and they contain the plaintext values. Rotate `ANTHROPIC_API_KEY`, `GITHUB_OAUTH_CLIENT_SECRET`, and (defensively) regenerate the GitHub OAuth Client Secret. Update Railway env vars to the new values and trigger a redeploy.

**Still parked (not started):**
- BuildKit `--mount=type=secret` if a future build step actually needs a secret (e.g., a private npm registry token). Today nothing does.

---

## 8. Automated skill decay detection (PARTIALLY IMPLEMENTED 2026-05-02)

**What:** A skill that worked when contributed may stop working when the app updates. Currently we have no first-party way to test this proactively.

**Status (post-pivot):** Reactive decay detection is now in v0 via telemetry. Proactive (cron-driven re-validation) remains parked.

**What's in v0:**
- The use seed skill calls `registry.report_execution` after every shortcut run. The backend writes the event and updates `ShortcutStats` (`use_count`, `success_count`, `success_rate`, `reliability_score`, `last_validated` per `(shortcut_id, app_version, platform)`).
- Decaying shortcuts show declining `success_rate` and drop in lookup ranking automatically. Agents naturally pick fresher alternatives.
- `last_validated` is the timestamp of the most recent successful execution, derived from the events table.

**Still parked:** Cron-driven re-validation of all shortcuts on a schedule. Building re-test infrastructure (running every shortcut against current app versions automatically) is non-trivial. Not v0.

**Trigger to pick up the proactive piece:** When reactive telemetry alone isn't enough, e.g., a major app update silently breaks half the shortcuts and users hit the failures one by one before lookup ranking adjusts. Or when the registry crosses ~100 active skills per app and decay becomes a maintenance burden.

---

## 9. Multi-window / multi-instance app handling (PARTIALLY IMPLEMENTED 2026-05-05)

**What:** Apps like Chrome, VS Code, or Photoshop can have multiple windows or instances. Original v0 assumed the focused window for every action.

**Status:** Additive surface in. Two new pieces:

- `os_action` gains a `focus_window` action type: `{type: "focus_window", match: "title_contains" | "title_equals" | "index", value, app_id?}`. Resolves the matching window via osascript and raises it via `AXRaise` so the agent can target a specific window before sending keystrokes. Existing shortcuts are unchanged — they still operate on the frontmost window, but the agent can now flip the frontmost window first when the user names a target.
- `os_list_windows` tool returns `{app_id?, process_name, windows: [{index, title}, ...]}` for the frontmost app or a named `app_id`. The agent calls this before `focus_window` when it doesn't already know the title or index.

**Still parked:**
- Per-action window targeting (route a single keystroke to a non-frontmost window without raising it). Most apps require frontmost focus to receive synthetic input, so the focus-then-act pattern is the right primitive in practice.
- Multi-instance handling for apps that can have more than one running process under the same bundle id. v0 picks the first matching process.

**Trigger to pick the rest up:** When a user reports a shortcut still targeted the wrong window even after focus_window, or when an app's design forces input without raising (rare).

---

## 10. Adversarial app vendors (RESOLVED — no engineering action)

**What:** Some app/site vendors actively detect and block automation (Google Flights, Amazon, ticketing sites). Skills against these targets may be brittle by design.

**Resolution:** Closed without further work. This is a strategic and legal question, not an engineering one — Rosetta can't engineer around vendor hostility. The v0 mechanisms already cover what code can cover:

- `meta.json` can declare `vendor_friendly: "friendly" | "unknown" | "hostile"` so contributors can flag known-adversarial targets.
- Hostile-vendor shortcuts naturally degrade in `reliability_score` over time as detection breaks them — the verification-pass-rate filter handles this without per-vendor logic.
- If a vendor sends a takedown for a specific app's shortcuts, the response is administrative (remove the app folder + index entry, optionally soft-ban contributor accounts), not an engineering change.

No further code work is planned for this item.

---

## 11. Internationalization / locale variation (PARTIALLY IMPLEMENTED 2026-05-05)

**What:** Menu paths, app strings, and search keywords differ across locales. A shortcut that uses `menu: ["Image", "Adjustments", "Brightness/Contrast"]` won't work for a Japanese-language Photoshop install.

**Status:** Schema field is in. Each shortcut may declare an optional `locale` (BCP-47 form: `en`, `en-US`, `fr-FR`, `ja`); when absent, the shortcut inherits `meta.locale`. Contributors author locale variants by encoding the locale into the `id` (e.g. `open-file-fr`) since `id` uniqueness is enforced within an app.

**Still parked:**
- Hierarchical fallback at lookup time: `fr-CA` query should match `fr-CA` first, then `fr`, then `en`.
- Lookup filtering by user-locale parameter: `/lookup?app_id=...&intent=...&locale=fr-FR` returns the locale-matched variant ranked above the default.
- Validator support for cross-locale id collisions (e.g. warn if two shortcuts share an `intent` but only one declares `locale`).

**Trigger to pick up the rest:** First non-English-locale contribution, or when a contributor reports their locale variant getting outranked by the en default at lookup time.

---

## 12. Graduate to Prisma migrations

**What:** v0 uses `prisma db push --accept-data-loss --skip-generate` to bring the database into sync with `backend/prisma/schema.prisma` on every deploy. This is idempotent and requires no migration files, which lets us iterate the schema without ceremony. It does NOT give us versioned schema changes, rollback, audit, or safe destructive-change handling once the database holds real data.

**Why deferred:** Phase 6a v0 has zero rows in production and a schema that's still settling. `prisma migrate dev` would force a migration commit per schema tweak before the design has stabilized. `db push` keeps the iteration loop fast for the same blast-radius (an empty/dev-only DB).

**Trigger to pick up:** First non-trivial schema change after launch where the production DB has real `Execution` / `ShortcutStats` / `Contributor` / `Submission` rows that need preserving across the change. At that point switch to `prisma migrate deploy`, generate an initial baseline migration from the live schema, and bake migration creation into the contributor workflow.

**Placeholder behavior:** `backend/package.json`'s `prisma:deploy` script is `prisma db push --accept-data-loss --skip-generate`. The `--accept-data-loss` flag is a no-op on a schema-compatible push; it only matters when the schema would force a destructive change, at which point the script silently drops data. Acceptable in v0 because there is no data worth keeping; UNACCEPTABLE post-launch — that's the trigger.

**Related:** parking-lot 13 (skill schema versioning) covers the JSON-spec side. This item covers the Postgres side. They graduate independently.

---

## 13. Skill schema versioning beyond major-version bumps (PARTIALLY IMPLEMENTED 2026-05-05)

**What:** Right now `schema_version` is an integer. We don't have a migration framework, deprecation policy, or backward-compat guarantees.

**Status:** Refusal-on-unknown-version is now hard. `mcp/src/registry.ts` and `backend/src/routes/lookup.ts` both define `SUPPORTED_SCHEMA_VERSION = 1`. Either layer reading a `shortcuts.json` with `schema_version > 1` returns a clear error pointing the operator at the upgrade path (rebuild MCP / redeploy backend) instead of silently mis-interpreting newer fields. Bumping the constant is now a required step in any v2-introducing PR.

**Still parked:**
- Multi-version coexistence: serving v1 and v2 specs from the same backend. Today both sides assume a single supported major.
- Migration framework: a script that rewrites v1 JSON to v2 shape in-place during a major bump.
- Deprecation policy: when an old schema version is allowed to keep working vs. is force-rejected.

**Trigger to pick up the rest:** First proposed breaking schema change. The decision document for that change should specify which of the still-parked pieces it requires.

---

## 14. Web chat client support

**What:** Letting chatgpt.com, gemini.google.com, claude.ai users control their desktop via the registry.

**Why deferred:** Browser sandbox prevents web pages from touching local OS. No web chat platform exposes a way for its model to call a localhost MCP. Workarounds (cloud-hosted browser, browser extension proxy, hosted runner VM) all break the "minimal install" promise or change the product significantly.

**Trigger to pick up:** Either a web chat platform ships native local-MCP support, or there's strong demand and we accept building the cloud-runner alternative.

**Placeholder behavior:** v0 explicitly targets desktop AI chat clients only (Claude Desktop, Claude Code, Cursor, ChatGPT Desktop, Gemini CLI, etc.). Documented as a known limitation in install.md.

---

## 15. Payment / contributor reward economy

**What:** Contributors get rewarded when their skills are used. Mechanism TBD: tokens, micropayments, fiat, attribution-only.

**Why deferred:** Not a v0 priority. West will figure out the transaction model later. For now we just want the registry to exist and be useful.

**Trigger to pick up:** Once there's measurable usage and a meaningful contributor base. Probably post-launch.

**Placeholder behavior:** Schema reserves `contributor_id` (GitHub username, populated from day one) and `payment_destination` (nullable, will be filled in when payments ship). No backfill needed later.

---

## 16. Smaller screenshots for vision-based verification (PARTIALLY IMPLEMENTED 2026-05-04, expanded 2026-05-05)

**What:** `os_screenshot` accepts a `region: {x, y, width, height}` parameter, but the agent has no automated way to figure out useful regions. Full-screen captures on retina displays land at 5 to 10 MB, which inflates vision-model token cost on every `interpret_check` verification.

**Status:** (a) and (c) in. (b) still parked.

- (a) `os_screenshot({ region: "frontmost_window" })` resolves the frontmost app's frontmost window via osascript and captures only that rect; falls through to full-screen if the app has no windows. (2026-05-04)
- (c) Per-shortcut `verification.region` on `interpret_check`: accepts an absolute `{x, y, width, height}` rect OR `{relative_to: "window", x, y, width, height}` (offsets from the frontmost window's top-left, resolved at capture time). `verify(interpret_check)` defaults to frontmost-window when no region is declared. (2026-05-05)

**Still parked:**
- (b) **Per-app AX-based canvas detection:** new AX rules like `photoshop_canvas_bounds` that return the document area's frame rect by traversing the AX tree. Some apps (Photoshop) hide the canvas from AX entirely, so this would have to deduce by subtracting toolbars/panels from the window rect.

**Trigger to pick up (b):** When a shortcut needs a smaller-than-window capture and either the absolute or relative-to-window form is too brittle in practice (e.g., per-user Photoshop layouts where panels move).

**Note on numbering:** This item appends at #16 rather than slotting in by priority because earlier items (parking-lot 2, 4, 5, 6, 7, 8, 12, 13) are referenced by stable number elsewhere in code, change-log, and docs. Renumbering would invalidate those references. The preamble's "renumber the list" guidance pre-dates those references; treat numbers as stable IDs going forward.
