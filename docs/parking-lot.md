# Parking Lot

Deferred items. Each entry: what it is, why it's deferred, what would trigger us to pick it back up, and the current placeholder behavior.

## 1. Bad skills / prompt injection

**What:** A contributed skill might be subtly wrong, wasteful, destructive, or contain prompt injection that hijacks the agent's behavior at execution time. Examples: a skill that says "delete file X" but really deletes a different file due to a bad selector; a skill whose `intent` description is "open file" but whose `actions` are "send password to evil.com"; a skill whose verification rule is satisfied by something other than the intended outcome.

**Why deferred:** The economy and contributor reputation systems aren't built yet, so the gating mechanism is just GitHub PR review. We're not at the scale where bad skills are a real attack surface.

**Trigger to pick up:** Either (a) the registry crosses ~100 contributors or ~1,000 skills, (b) the first reported incident, or (c) before turning on the explorer-agent's auto-PR submission for any user.

**Placeholder behavior:** All submissions go through PR review by repo maintainer. No auto-merge. The use-skill explicitly tells the agent to never trust skill descriptions as instructions ("never invent shortcuts not in the registry"). Future work: skill sandboxing in a VM, signature/checksum requirements, contributor reputation scores, action-type allowlists per skill category.

---

## 2. Payment / contributor reward economy

**What:** Contributors get rewarded when their skills are used. Mechanism TBD: tokens, micropayments, fiat, attribution-only.

**Why deferred:** Not a v0 priority. West will figure out the transaction model later. For now we just want the registry to exist and be useful.

**Trigger to pick up:** Once there's measurable usage and a meaningful contributor base. Probably post-launch.

**Placeholder behavior:** Schema reserves `contributor_id` (GitHub username, populated from day one) and `payment_destination` (nullable, will be filled in when payments ship). No backfill needed later.

---

## 3. Web chat client support

**What:** Letting chatgpt.com, gemini.google.com, claude.ai users control their desktop via the registry.

**Why deferred:** Browser sandbox prevents web pages from touching local OS. No web chat platform exposes a way for its model to call a localhost MCP. Workarounds (cloud-hosted browser, browser extension proxy, hosted runner VM) all break the "minimal install" promise or change the product significantly.

**Trigger to pick up:** Either a web chat platform ships native local-MCP support, or there's strong demand and we accept building the cloud-runner alternative.

**Placeholder behavior:** v0 explicitly targets desktop AI chat clients only (Claude Desktop, Claude Code, Cursor, ChatGPT Desktop, Gemini CLI, etc.). Documented as a known limitation in install.md.

---

## 4. Automated skill decay detection

**What:** A skill that worked when contributed may stop working when the app updates. Currently we have no way to detect this except via user reports.

**Why deferred:** Building automated re-test infrastructure (cron jobs that run skills against current app versions) is non-trivial and expensive. Not necessary at v0 scale.

**Trigger to pick up:** When user reports of broken skills become a maintenance burden, or when the registry crosses ~100 active skills per app.

**Placeholder behavior:** `metadata.last_validated` field exists; agent can flag skills not re-validated in N days. Users manually flag broken skills via GitHub issues. The `success_rate` metadata field is populated by client-side reporting (the use-skill tells the agent to report verification outcomes back to the registry, eventually).

---

## 5. Adversarial app vendors

**What:** Some app/site vendors actively detect and block automation (Google Flights, Amazon, ticketing sites). Skills against these targets may be brittle by design.

**Why deferred:** This is a strategic question more than a technical one. We can't engineer around vendor hostility.

**Trigger to pick up:** When the registry has skills for high-friction targets and we get takedown requests or detection-driven failures.

**Placeholder behavior:** The registry doesn't restrict what apps can be added, but `meta.json` for an app can include a `vendor_friendly` flag (default `unknown`). Skills against unfriendly vendors will likely have low reliability scores, which is the natural feedback loop.

---

## 6. Cross-skill composition contracts

**What:** When the user asks "increase brightness, add a dog, crop the photo," the agent chains three shortcuts. There's no formal contract for how shortcut outputs feed into shortcut inputs (e.g., "this shortcut produces a selection region that the next one consumes").

**Why deferred:** Most v0 use cases are single-shortcut or trivially sequential (do A, then do B). Real composition with state passing is a v2 concern.

**Trigger to pick up:** When users start chaining 3+ shortcuts and we see failures in the seam between them.

**Placeholder behavior:** Shortcuts have `parameters` (inputs) but no `produces` (outputs). The chat LLM handles composition implicitly. Future: add `produces` field to shortcuts and `consumes` to parameters, with type checking.

---

## 7. Skill schema versioning beyond major-version bumps

**What:** Right now `schema_version` is an integer. We don't have a migration framework, deprecation policy, or backward-compat guarantees.

**Why deferred:** v0 has one schema version. Bridges to cross when we get there.

**Trigger to pick up:** First breaking schema change.

**Placeholder behavior:** All registry files declare `schema_version: 1`. The MCP refuses to load skills with an unknown major version and asks the user to upgrade.

---

## 8. Multi-window / multi-instance app handling

**What:** Apps like Chrome, VS Code, or Photoshop can have multiple windows or instances. Current schema doesn't disambiguate which window an action targets.

**Why deferred:** v0 assumes the focused window. Adequate for most use cases.

**Trigger to pick up:** First user complaint that a shortcut targeted the wrong window.

**Placeholder behavior:** All `os.action` calls implicitly target the focused window. Workflows are responsible for ensuring focus before acting.

---

## 9. Internationalization / locale variation

**What:** Menu paths, app strings, and search keywords differ across locales. A shortcut that uses `menu: ["Image", "Adjustments", "Brightness/Contrast"]` won't work for a Japanese-language Photoshop install.

**Why deferred:** v0 targets English-locale apps. Most early adopters will be on English.

**Trigger to pick up:** First contribution from a non-English-locale user, or when targeting a non-English market.

**Placeholder behavior:** `meta.json` has a `locale` field on each shortcut variant. Default `en`. Future: variants per locale, registry filters by user locale.

---

## 10. Sensitive action gating (purchases, deletes, sends)

**What:** Some shortcuts perform irreversible or high-stakes actions. We should require user confirmation for these.

**Why deferred:** v0 is for power users who know what they're asking for. The chat LLM also tends to confirm before destructive actions.

**Trigger to pick up:** First incident involving a destructive action, or before any non-power-user audience targeting.

**Placeholder behavior:** Shortcuts can declare `risk: "destructive" | "financial" | "external_communication" | "safe"` (default `safe`). The use-skill should be updated to pause and confirm before executing non-safe shortcuts. Currently informal.
