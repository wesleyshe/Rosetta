# Parking Lot

Deferred items, **ranked by priority — top = highest priority**. The first item is the next thing to revisit when we have parking-lot bandwidth. When adding new items, slot in by priority and renumber the list. Each entry: what it is, why it's deferred, what would trigger us to pick it back up, and the current placeholder behavior.

## 1. Workflow plurality / competition between workflows per app

**What:** workflow.json is currently singular per app — exactly one generic workflow describes how to dispatch and verify shortcuts for that app. This contradicts the "let competition drive quality" principle that already governs shortcuts (multiple shortcuts can match one intent; agent picks by reliability_score; we don't deduplicate). The same principle should apply to workflows: multiple plausible generic-workflow approaches per app should compete on empirical hit-rate. For an app like Photoshop, examples include: canvas-region screenshot vs full-screen, AX-only vs screenshot-based, interleaved vs end-only verification. Different approaches have different trade-offs (speed, robustness, UI-resistance). The registry should let users surface the empirically-best one rather than locking in a maintainer's guess.

**Why deferred:** v0 has only VS Code, where workflows are overwhelmingly palette-and-AX dominant. Competing approaches likely don't differ meaningfully in hit-rate. No empirical pressure to surface a winner because there's only one plausible workflow. The architectural change is non-trivial: workflows.json plural form, WorkflowStats table, lookup + selection logic, attribution of Execution events to a specific workflow_id.

**Trigger to pick up:** When authoring the second app's workflow (probably Photoshop in Phase 7) reveals that multiple plausible approaches exist and we want to A/B them empirically. Or when a contributor tries to submit a competing workflow approach for an existing app and there's no path.

**Placeholder behavior:** Maintainer authors the single workflow per app. If it turns out wrong, fix manually rather than receive competing submissions. Schema reserves nothing yet — when activated, the migration is non-trivial (singular → plural; schema_version bump likely required). The /submit endpoint accepts only shortcuts; workflow updates are maintainer-only.

**Why this matters:** Symmetric with how shortcuts already work. Without this, the registry can't empirically evolve workflow approaches, which limits its ability to handle apps with messy or vision-heavy UIs. Phase 7+ critical for any meaningful expansion beyond VS Code.

---

## 2. Website UI / UX design (landing + per-app database pages)

**What:** A real design pass for the human-facing landing page and the per-app database pages. Phase 2 currently produces functional HTML with minimal CSS but makes no decisions about: visual anchor (typography, color, spacing scale), reliability-score visualization, shortcut-list layout (table vs cards vs list), sort/filter behavior, cold-start indicators, agent_primer placement on the page, mobile responsiveness, or copy tone. The pages will be written and look "however the agent makes them look" without explicit design intent.

**Why deferred:** Schemas, MCP, backend, and seed skills are all higher-leverage. Landing-page polish before the product works is a classic ordering mistake. The user explicitly chose "think about it later" on 2026-05-03 after a design discussion.

**Trigger to pick up:** Before the page is shown to anyone outside the team. At the latest, before the Phase 7 soft launch (HN, Reddit, etc.). Earlier is better — ideally between Phase 6b shipping and Phase 7 starting, when the backend exists and there's real data (a few VS Code shortcuts plus stats) to design around. Earliest viable trigger: as soon as Phase 2 begins, draft `docs/site-design.md` first.

**Placeholder behavior:** Phase 2 will produce vanilla HTML/CSS that's functional but undesigned. Reliability scores will be rendered as plain numbers. Shortcuts will list in document order. Mobile behavior will be whatever vanilla HTML gives you. Acceptable for internal review and for showing to a small audience; not acceptable for soft launch.

**When picked up, write:** `docs/site-design.md` (50-100 lines) covering landing-page goal, visual anchor, per-app-page layout decisions, copy tone. Then revisit Phase 2's substeps and add design-implementation tasks. Don't drag into Figma-mockup-iteration territory; the goal is "intentional," not "designed-by-committee."

---

## 3. Sensitive action gating (purchases, deletes, sends)

**What:** Some shortcuts perform irreversible or high-stakes actions. We should require user confirmation for these.

**Why deferred:** v0 is for power users who know what they're asking for. The chat LLM also tends to confirm before destructive actions.

**Trigger to pick up:** First incident involving a destructive action, or before any non-power-user audience targeting.

**Placeholder behavior:** Shortcuts can declare `risk: "destructive" | "financial" | "external_communication" | "safe"` (default `safe`). The use-skill should be updated to pause and confirm before executing non-safe shortcuts. Currently informal.

---

## 4. Cross-skill composition contracts

**What:** When the user asks "increase brightness, add a dog, crop the photo," the agent chains three shortcuts. There's no formal contract for how shortcut outputs feed into shortcut inputs (e.g., "this shortcut produces a selection region that the next one consumes").

**Why deferred:** Most v0 use cases are single-shortcut or trivially sequential (do A, then do B). Real composition with state passing is a v2 concern.

**Trigger to pick up:** When users start chaining 3+ shortcuts and we see failures in the seam between them.

**Placeholder behavior:** Shortcuts have `parameters` (inputs) but no `produces` (outputs). The chat LLM handles composition implicitly. Future: add `produces` field to shortcuts and `consumes` to parameters, with type checking.

---

## 5. screenshot_diff semantic is one-directional

**What:** The `screenshot_diff` verification type currently expresses only `max_pixel_diff_ratio` — "verify nothing changed beyond N% of pixels." The inverse direction ("verify something DID change") and region-aware change assertions ("verify the sidebar region changed but the editor region did not") cannot be expressed.

**Why deferred:** Phase 1 doesn't have a concrete `verify()` implementation yet, so designing the right schema extension is premature. The seed shortcuts that needed an inverse-direction check (`toggle-zen-mode`, `format-current-file`) use `interpret_check` instead, which delegates to a vision model.

**Trigger to pick up:** During Phase 4, when `verify()` is being implemented and there's real usage to inform the design. Or when a contributor submits a shortcut where `interpret_check` feels like the wrong tool and `screenshot_diff` with new semantics would fit cleanly.

**Placeholder behavior:** Use `interpret_check` for "verify a visible toggle happened" cases. `screenshot_diff` in v0 is functionally limited to "verify nothing visually changed."

**Options to consider when picked up:**
- Add `min_pixel_diff_ratio` (the inverse of the current field): "verify at least N% of pixels changed."
- Add a `direction` enum: `"no_change" | "any_change" | "exact_match"` against a reference image hash.
- Add region-aware assertions: a `regions: [...]` array where each region has its own expected change behavior.
- Drop `screenshot_diff` entirely if `interpret_check` turns out to cover the same use cases more reliably in practice.

**v0 implementation note (added 2026-05-03):** The Phase 4 implementation uses a byte-level approximation in `mcp/src/verify.ts` (`verifyScreenshotDiff` / `approximateDiffRatio`), NOT a true PNG-decoded pixel diff. PNGs of different byte length are reported as 100% different; otherwise the ratio is the fraction of bytes that differ at corresponding offsets. Acceptable in v0 because no seed shortcut uses `screenshot_diff`. Proper pixel-decoded comparison is part of this item's scope when picked up in Phase 7 or later.

---

## 6. Bad skills / prompt injection (PARTIALLY ACTIVATED 2026-05-02)

**What:** A contributed skill might be subtly wrong, wasteful, destructive, or contain prompt injection that hijacks the agent's behavior at execution time. Examples: a skill that says "delete file X" but really deletes a different file due to a bad selector; a skill whose `intent` description is "open file" but whose `actions` are "send password to evil.com"; a skill whose verification rule is satisfied by something other than the intended outcome.

**Status:** The original trigger condition (c) — "before turning on the explorer-agent's auto-PR submission" — has fired with the 2026-05-02 backend pivot. Submissions now auto-merge after an LLM-based reviewer. The full defense suite (sandboxing, signatures, fine-grained action allowlists) remains parked. What's now in v0:

- **Agent prompt-injection reviewer (LLM):** the backend's `/submit` endpoint runs the spec through an LLM check for obviously-malicious patterns (urls in actions, suspicious filenames, mismatch between `intent` and `actions`, etc.). Acknowledged shallow. Sufficient given the bootstrap-then-publish rollout plan and small initial registry size.
- **Verification-as-rating filter:** because reliability score is the verification-pass percentage, shortcuts that succeed locally but fail at scale get downranked automatically. This is the long-term filter once usage data accumulates.
- **GitHub identity on submission:** every spec carries `contributor_id`. Bad-actor accounts can be soft-banned by the backend without affecting the rest of the registry.

**Still parked (full activation triggers):** Either (a) registry crosses ~100 contributors or ~1,000 skills, (b) first reported incident of a malicious skill landing, or (c) before opening the contributor base beyond developers.

**Future work (not v0):** skill sandboxing in a VM, signature/checksum requirements, contributor reputation scores, action-type allowlists per skill category, mandatory human review for high-risk action types (file deletes, network requests, payments).

---

## 7. Automated skill decay detection (PARTIALLY ACTIVATED 2026-05-02)

**What:** A skill that worked when contributed may stop working when the app updates. Currently we have no first-party way to test this proactively.

**Status (post-pivot):** Reactive decay detection is now in v0 via telemetry. Proactive (cron-driven re-validation) remains parked.

**What's in v0:**
- The use seed skill calls `registry.report_execution` after every shortcut run. The backend writes the event and updates `ShortcutStats` (`use_count`, `success_count`, `success_rate`, `reliability_score`, `last_validated` per `(shortcut_id, app_version, platform)`).
- Decaying shortcuts show declining `success_rate` and drop in lookup ranking automatically. Agents naturally pick fresher alternatives.
- `last_validated` is the timestamp of the most recent successful execution, derived from the events table.

**Still parked:** Cron-driven re-validation of all shortcuts on a schedule. Building re-test infrastructure (running every shortcut against current app versions automatically) is non-trivial. Not v0.

**Trigger to pick up the proactive piece:** When reactive telemetry alone isn't enough, e.g., a major app update silently breaks half the shortcuts and users hit the failures one by one before lookup ranking adjusts. Or when the registry crosses ~100 active skills per app and decay becomes a maintenance burden.

---

## 8. Multi-window / multi-instance app handling

**What:** Apps like Chrome, VS Code, or Photoshop can have multiple windows or instances. Current schema doesn't disambiguate which window an action targets.

**Why deferred:** v0 assumes the focused window. Adequate for most use cases.

**Trigger to pick up:** First user complaint that a shortcut targeted the wrong window.

**Placeholder behavior:** All `os.action` calls implicitly target the focused window. Workflows are responsible for ensuring focus before acting.

---

## 9. Adversarial app vendors

**What:** Some app/site vendors actively detect and block automation (Google Flights, Amazon, ticketing sites). Skills against these targets may be brittle by design.

**Why deferred:** This is a strategic question more than a technical one. We can't engineer around vendor hostility.

**Trigger to pick up:** When the registry has skills for high-friction targets and we get takedown requests or detection-driven failures.

**Placeholder behavior:** The registry doesn't restrict what apps can be added, but `meta.json` for an app can include a `vendor_friendly` flag (default `unknown`). Skills against unfriendly vendors will likely have low reliability scores, which is the natural feedback loop.

---

## 10. Internationalization / locale variation

**What:** Menu paths, app strings, and search keywords differ across locales. A shortcut that uses `menu: ["Image", "Adjustments", "Brightness/Contrast"]` won't work for a Japanese-language Photoshop install.

**Why deferred:** v0 targets English-locale apps. Most early adopters will be on English.

**Trigger to pick up:** First contribution from a non-English-locale user, or when targeting a non-English market.

**Placeholder behavior:** `meta.json` has a `locale` field on each shortcut variant. Default `en`. Future: variants per locale, registry filters by user locale.

---

## 11. Skill schema versioning beyond major-version bumps

**What:** Right now `schema_version` is an integer. We don't have a migration framework, deprecation policy, or backward-compat guarantees.

**Why deferred:** v0 has one schema version. Bridges to cross when we get there.

**Trigger to pick up:** First breaking schema change.

**Placeholder behavior:** All registry files declare `schema_version: 1`. The MCP refuses to load skills with an unknown major version and asks the user to upgrade.

---

## 12. Web chat client support

**What:** Letting chatgpt.com, gemini.google.com, claude.ai users control their desktop via the registry.

**Why deferred:** Browser sandbox prevents web pages from touching local OS. No web chat platform exposes a way for its model to call a localhost MCP. Workarounds (cloud-hosted browser, browser extension proxy, hosted runner VM) all break the "minimal install" promise or change the product significantly.

**Trigger to pick up:** Either a web chat platform ships native local-MCP support, or there's strong demand and we accept building the cloud-runner alternative.

**Placeholder behavior:** v0 explicitly targets desktop AI chat clients only (Claude Desktop, Claude Code, Cursor, ChatGPT Desktop, Gemini CLI, etc.). Documented as a known limitation in install.md.

---

## 13. Payment / contributor reward economy

**What:** Contributors get rewarded when their skills are used. Mechanism TBD: tokens, micropayments, fiat, attribution-only.

**Why deferred:** Not a v0 priority. West will figure out the transaction model later. For now we just want the registry to exist and be useful.

**Trigger to pick up:** Once there's measurable usage and a meaningful contributor base. Probably post-launch.

**Placeholder behavior:** Schema reserves `contributor_id` (GitHub username, populated from day one) and `payment_destination` (nullable, will be filled in when payments ship). No backfill needed later.
