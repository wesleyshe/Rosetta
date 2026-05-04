# Design Rationale

A record of why this project is structured the way it is. Each section pairs a decision with the alternatives considered and why they were rejected. Use this when revisiting a decision, when onboarding new contributors, or when judging whether a parked item should be activated.

Captured from a design conversation between West and Claude on 2026-05-02. Will be updated as future decisions evolve.

---

## Why this project exists at all

**Decision:** Build a community registry of semantic agent skills with built-in verification, paired with a small MCP server that lets any AI chat client consume and contribute to it.

**Thesis:** Agents controlling third-party software is currently dominated by two extremes that both fail in practice. Pure vision (Claude Computer Use, OpenAI CUA, Gemini's computer use endpoint) is too slow, too expensive, and too brittle to serve as a serious automation layer at scale. App-specific scripting libraries (pywinauto, atomacos, AppleScript, COM, AutoHotkey) are fast and reliable but require per-app handcoding by a developer.

The middle ground that doesn't yet exist: a shared, semantic representation of how to do things in apps, that agents discover collaboratively and replay deterministically. That's what this registry is.

**Framing:** Explicitly transition-era. In the long run, apps should ship native agent interfaces (MCP servers, structured tool APIs). This registry fills the gap until they do. The product should be designed assuming it will eventually be obsoleted by app-vendor-published interfaces, and that's fine.

---

## Why not pure vision-based control

**Considered:** Skip the registry entirely. Rely on Claude Computer Use, OpenAI CUA, or Gemini's computer-use endpoint. Tokens are getting cheaper, context windows are getting bigger, eventually the cost issue resolves itself.

**Rejected because:**
- Token cost will trend down but latency is bounded by inference time, which scales with token count. Vision-heavy loops will always be 2-5x slower per step than structured-input loops, regardless of token price.
- Pixel coordinates are not portable across machines. Different resolution, DPI scaling, theme, font size, OS version, and app version mean a workflow recorded with vision can't be shared with another user reliably. Without portability, there's no shared workflow database.
- For a shared workflow database to be useful, the representation has to be semantic, which immediately requires non-vision primitives.

**What we kept from vision:** It remains a fallback when semantic targets fail to resolve. It is also the primary mechanism for the explore-skill's discovery phase.

---

## Why MCP as the universal interface

**Considered:** Ship a custom protocol. Ship a browser extension. Ship platform-specific plugins (one per AI client).

**Chose MCP because:**
- Open standard that Anthropic, OpenAI, Google, and most agent IDEs have converged on.
- One install (a single MCP server) reaches Claude Desktop, Claude Code, Cursor, Windsurf, Cline, ChatGPT Desktop, Gemini CLI, and others.
- Gives us the "one install, paste seed skill, done" onboarding story.

**Tradeoff:** Web chat clients (chatgpt.com, gemini.google.com, claude.ai) cannot reach a local MCP. Explicitly out of scope for v0 (parked).

---

## Why bundled MCP, not slim

**Considered:** Ship a slim MCP that only does registry lookup, and rely on the user installing a separate computer-control MCP (several open-source ones exist).

**Chose bundled because:**
- User experience requires one install, not two. Slim plus separate computer-control means two installs and two configs to maintain.
- The computer-control code is small (a few hundred lines wrapping nut.js, native AX bindings, mss for screenshots). Maintenance cost is low.
- Bundling lets us guarantee that the verification primitives interoperate cleanly with the action primitives (same screenshot library, same AX queries, same coordinate conventions).

**What this costs us:** More platform-specific code to test. Mitigated by relying on well-tested OSS libraries for the platform interactions.

---

## Why GitHub-as-spec-store, plus a real DB for stats

**Originally considered:** Postgres on Supabase / Neon / Railway with a web frontend. Or Cloudflare D1.

**Original v0 decision (made 2026-05-02):** Static JSON in a Git repo, served by GitHub Pages CDN, with PR-based contribution.

**Amended (2026-05-02):** Hybrid. Specs stay in Git; runtime stats move to Postgres on Railway. The original arguments still hold for the spec side. The original assumption that stats could ride along in the JSON did not survive contact with the actual usage model.

**What stays in Git (immutable spec):**
- `id`, `intent`, `parameters`, `app_id`, `platforms`, `app_versions`, `method`, `actions`, `verification`, `schema_version`, `contributor_id`, `payment_destination`, `token_cost_estimate`, `speed_estimate_ms`, `submitted_at`.
- These are contributor-declared, change rarely, and benefit from diff-based review and rollback.

**What lives in Postgres (mutable stats):**
- `use_count`, `success_count`, `success_rate`, `reliability_score`, `last_validated`, raw `Execution` events.
- These update on every shortcut execution. Storing them in Git would mean one commit per execution, which is absurd at any real scale.

**Why this split is the right v0 shape, not premature optimization:**
- The `success_rate` mechanism is the registry's quality signal. Without live stats, ranking falls back to author-declared metadata (gameable) or human review (slow). Neither matches the design goal of agents continuously contributing and consuming with minimal friction.
- The PR-per-execution alternative was dismissed without serious consideration in the original rationale. On revisit it's clearly unworkable: even at modest usage (one user, ten executions a day) the repo history becomes useless.
- The pure GitHub-as-database approach forced human review as the only quality gate. Removing the human gate (because the explore-skill auto-submits) requires a different quality gate. Hit-rate is that gate. Hit-rate requires telemetry. Telemetry requires a DB.

**What this costs us:**
- A backend service to maintain (Railway pays the operational tax, see "Why Railway for the backend").
- Two stores to keep in sync. Mitigated by treating Git as the source of truth for specs (Postgres references but never overrides) and Postgres as the source of truth for stats (Git never references). The two intersect only at lookup time, where the backend joins them.

---

## Why ratings are verification results, not user votes

**Considered:** A `registry.rate(shortcut_id, score)` MCP tool that lets the agent or user submit a 1-5 rating after each execution.

**Rejected because:**
- Ratings without authentication are gameable. Spawning fake "success" ratings to push your own (potentially malicious) shortcut to the top costs nothing.
- Ratings with authentication require GitHub OAuth on the use path, which destroys the "install and go" install funnel.
- Either choice is bad. Sidestep both: don't have a separate rating signal. Use the verification result that's already part of every shortcut.

**Decision:** The MCP automatically reports `(shortcut_id, verification_result, error_class, app_version, platform, install_id)` to `registry.report_execution` after every execution. Reliability score is "fraction of executions where the bundled verification passed."

**Why this is hard to spoof:**
- The data point is "verification passed under these conditions," not "user X claims it worked." The verification step depends on actual system state (file existence, AX tree, screenshot diff). Faking a success requires actually running the shortcut and having actual verification pass, which means the shortcut actually works.
- Sybil resistance comes from per-`install_id` rate limits on `report_execution`. The MCP mints a stable random UUID at first launch and includes it in every report. To pad a shortcut's stats, an attacker would need to spin up many MCP installs, which has real cost.

**What this costs us:**
- Verification specs that are weak or trivially satisfied will produce noisy stats. Mitigated by the existing convention that verification is first-class — shortcuts with bad verification spec quality is a contributor-quality problem and can be addressed in PR review of the spec itself.
- Qualitative signals ("worked but did the wrong thing") aren't captured. Acceptable for v0; reserved for a later authenticated feedback channel if needed.

---

## Why we dropped GitHub Pages and went Railway-everywhere

**Originally:** Site on GitHub Pages (free, static CDN, immutable). Backend on Railway. Two hosts.

**Amended (2026-05-03):** Single Railway service serves both the static site and the API. GitHub Pages is not used.

**Why:**
- **One source of truth at runtime.** Specs are authored in Git (still the source of truth for spec data), and Railway reads them off the deploy's disk. Whichever spec is on `main` is what's served. No "the website hasn't redeployed yet" ambiguity between Pages and Railway.
- **Operational simplicity.** One host, one deploy log, one place where things can go wrong. The cost of GitHub Pages going stale relative to Railway (e.g., site shows stats from yesterday because Pages cache hasn't busted but the backend has new data) was a real failure mode in the previous design.
- **The cost objection is gone.** West already pays for Railway. The marginal cost of static traffic on Railway versus free Pages is negligible at v0 scale.
- **Submission-to-live latency is comparable.** Pages republishes within ~1 minute of a merge; Railway redeploys within ~1 minute of a push to `main` via its GitHub integration. Same order of magnitude.

**What this costs us:**
- Static traffic now costs (rounding-error). Acceptable.
- A redeploy on every auto-merged submission. At v0 scale this is fine; if submissions pick up to many per minute, switch to a webhook-driven incremental refresh that avoids full redeploys. Reserved for later.

---

## Why JSON is source of truth, `skill.md` is generated

**Considered:** Author shortcut data as `skill.md` (markdown with embedded structured blocks for actions/verification, à la Claude Code skills) and treat the markdown as canonical. JSON is a parsed view if needed.

**Considered:** Author both. JSON for the MCP, hand-written markdown for agent context.

**Chose JSON-as-source, skill.md-as-generated because:**
- Validation is much easier on a single shape. JSON schema (via ajv) gives us guaranteed conformance for actions, verification rules, and parameter types. Markdown-as-source would require a custom parser plus a schema for the embedded blocks, doubling the validation surface.
- Authoring two parallel files (JSON + hand-written markdown) creates drift. The markdown will fall out of date relative to the JSON within a week.
- The `skill.md` agent-context view is a thin render: `meta.json` (mostly the `agent_primer` field) + `workflow.json` summary + `shortcuts.json` intent list. Server-side template, no logic, never authored directly.
- This pattern matches what works in Claude Code's own skill system: structured data drives both human-readable and machine-readable representations.

**What this costs us:**
- The markdown is less expressive than hand-authored docs would be. Mitigated by the `agent_primer` field, which is itself a free-text markdown blob; contributors can write whatever orienting context they want there, and it lands in `skill.md` as the lead section.
- We can't do markdown-only edits to fix a typo in agent-facing docs without re-touching `meta.json`. Acceptable; that's the same coupling that other configuration-as-code systems have.

---

## Why explore is budget-bounded and resumable in v0

**Considered:** Single-session explore. The agent runs as long as it wants, submits as it goes, and stops when it's done. State is conversational only.

**Rejected because:**
- Real apps (Photoshop, AutoCAD, Excel) have hundreds of capabilities. A serious mapping pass takes hours, not minutes. Forcing a single uninterrupted session pushes the user toward either a shallow pass or a budget-blowing marathon.
- Without resume, the user pays exploration cost twice for the same app every time they want to extend coverage. The skill becomes "explore the same first 10 features in a different order each session."
- Without budget tracking, the agent has no incentive to reserve resources for submission. Late-stage exploration runs out of budget before findings are uploaded; the work is wasted.

**Decision (2026-05-03):**
- Wall-clock minutes as the budget unit (not tokens). The MCP can't reliably observe the chat client's token usage, but it can observe wall-clock time. Defaults to 30 minutes if the user doesn't specify. `submission_reserve_minutes` defaults to 5.
- Local session state file per app at `~/.config/rosetta-mcp/sessions/{app_id}.json`. Findings, completed intents, and abandoned intents persist across sessions.
- Three finding statuses: `drafted` (transient), `verified` (passed bundled verification, eligible for submission), `rejected_by_self` (failed verification or no clean path, recorded so future sessions don't re-attempt).
- Session-end policy (b) of three options considered: budget-exhaustion auto-ends the session, state persists, a fresh `explore.start_session` resumes from the file unless `{ reset: true }` is passed.

**Why not (a) sessions never end:**
- Indefinite session lifetimes mean budget tracking has no anchor; "minutes used" becomes meaningless.

**Why not (c) explicit close required:**
- Pushes management burden onto the user. If they forget to close a session, the file accumulates stale state forever. The implicit "session ends when budget exhausts" is a natural cycle.

**Four new MCP tools:** `explore.start_session`, `explore.save_finding`, `explore.budget_status`, `explore.submit_findings`. See `docs/architecture.md` for full signatures and the local file shape.

**What this costs us:**
- Token-based budgets (e.g., "explore for $5 of model spend") aren't supported in v0. Wall-clock is a proxy, not a perfect substitute. Reserved for later.
- Local state needs a versioned schema for the session file in case we evolve the shape. Schema_version field is included; migrations are deferred until we change it.

---

## Why Railway for the backend

**Considered:** Cloudflare Workers + D1, Cloudflare Workers + Neon Postgres, Vercel Edge + Supabase, self-hosted on Fly.io or Render.

**Originally chose Cloudflare Workers** for v0 (per architecture.md before the 2026-05-02 amendment). Reasoning: edge runtime, free tier, single-region simplicity, matched the static-only ethos of GitHub Pages.

**Amended to Railway because:**
- West already has a Railway subscription. Cost objection vanishes.
- The Claw_Street_Bets project established a Fastify + Prisma + Postgres + Railway pattern that this project can reuse without learning new deployment mechanics.
- Cloudflare Workers don't hold persistent TCP connections to Postgres. Connecting them to a real DB requires either Hyperdrive in front, a connection pooler sidecar, or an HTTP-only Postgres driver. Each adds a moving part. Railway-hosted Node.js services connect to Railway-hosted Postgres natively.
- The latency cost of single-region (vs edge) hosting is irrelevant for this workload. A `registry.lookup` happens once per agent task, not in a hot loop. Adding 50ms is invisible.

**What this costs us:**
- A monthly bill (already paid). Not a v0 concern.
- Single-region. If the registry ever needs global low-latency reads, put the lookup endpoint behind a CDN with cache invalidation on PR merge. Reserved for later.
- Cold starts on free Railway plans can be slow. Mitigated by always-on dyno or by a tiny pinger if needed.

---

## Why TypeScript for the MCP

**Considered:** Python (better libraries for AX and screenshots), Rust (single-binary distribution).

**Chose TypeScript because:**
- `npx` install is the cleanest cross-platform pitch.
- The MCP TypeScript SDK is the most mature.
- Most desktop AI client integration documentation uses TypeScript examples.

**What this costs us:** AX and screenshot libraries are slightly less mature in the Node ecosystem than in Python. Accepted because installation ergonomics matter more for adoption than implementation comfort.

---

## Why one workflow per app, with searchable shortcuts

**Considered:** Workflows scoped per task class within an app (one for image-edit, one for batch-export, one for selection ops). Or no workflow concept at all (just a flat list of shortcuts).

**Chose one workflow per app, plus a flat searchable shortcut library, because:**
- The workflow is the generic execution harness (open the app, dispatch action, verify, recover). It's the same shape for every app.
- The shortcuts are the content. Each one represents a single atomic capability.
- Multiple shortcuts can match one intent (apply filter via menu, via shortcut, via search). The agent picks based on metadata. This lets quality compete naturally rather than being deduplicated upfront.
- Per-task workflows would multiply maintenance burden without much expressive gain.

---

## Why search-first interaction matters as a method, not a primitive

**Considered:** Make `search` a first-class action type in the schema, separate from key combos and menu navigation.

**Chose to keep it as one method among many because:**
- Many modern apps (VS Code, Linear, Obsidian, Notion, Cursor, Slack) have a command palette: a single keyboard shortcut opens a search bar that triggers any action by name.
- This is gold for our use case because semantic intent maps directly to search query, the search bar is resistant to UI redesigns, and it works regardless of menu structure changes.
- But making it a special primitive would over-fit the schema to apps with command palettes. Apps without one would have a missing field.
- Better: it's just one method, ranked alongside keyboard shortcuts and menu navigation. The agent picks based on cost / speed / reliability metadata.

---

## Why verification is part of the workflow, not a separate layer

**Considered:** Position the product as "verification-first execution layer for agents, backed by a community library of verified skills." Treat verification as the headline feature.

**West pushed back on this framing.** Verification is part of how a workflow is defined, not a separate concern. The world treats workflows as "execute these steps." This registry treats workflows as "execute these steps and prove you did them." The registry holds workflow plus verification together as one artifact, not as separate schemas.

**In practice:** Every shortcut entry has a `verification` field. Skills with weak or no verification are still allowed (some atomic actions are deterministic enough to skip it), but the schema makes verification first-class.

---

## Why GitHub OAuth is required for submission, but not for use

**Considered (originally):** Require GitHub OAuth for both contributors AND every user of the registry, on the theory that identity-bound usage data is more useful than anonymous data.

**Considered (also):** Anonymous everywhere. Lower friction across the board.

**Decision (refined 2026-05-02):** Asymmetric auth.
- **Submission requires GitHub OAuth.** Every shortcut has a `contributor_id` (GitHub username). No anonymous submissions.
- **Use does not require auth.** The use seed skill works the moment the MCP is installed. Execution telemetry is reported anonymously, tagged with the MCP's locally-minted `install_id` for sybil resistance only.

**Why submission needs identity:**
- Reputation is load-bearing once the registry has scale. Anonymous contributions undermine it.
- Identity gives us a future hook for the payment economy (`contributor_id` and `payment_destination` are in the schema from day one).
- Identity makes spam and bad-skill remediation easier — a contributor whose shortcuts repeatedly fail at runtime can be soft-banned without affecting the rest of the registry.
- GitHub identity is essentially free for any developer audience.

**Why use does NOT need identity:**
- The "install and go" funnel is the product's biggest growth lever. Adding OAuth at the use step would gate the most common path on a multi-step browser dance.
- The rating signal we care about is the verification result, which is the same regardless of who ran it. We don't need a user identity to interpret the data point.
- Sybil resistance comes from per-`install_id` rate limits, not from auth. See "Why ratings are verification results, not user votes."

**What this costs us:** Friction at the contribution step. Acceptable because contributors are a small subset of users, and the explorer use case (where most contributions originate) requires the user to be deliberate about contributing anyway.

---

## Why desktop-only for v0

**Considered:** Support web chat clients (chatgpt.com, gemini.google.com, claude.ai) too.

**Cannot support them in v0 because:** Web chat clients run in a browser sandbox that can't touch the local OS, and no chat platform exposes a way for its model to call a localhost service. The workarounds (cloud-hosted browser, browser extension proxy, hosted runner VM) all break the "one install" promise or change the product significantly.

**Parked.** When a web chat platform ships native local-MCP support, or when there's strong demand and we accept building the cloud-runner alternative, we revisit.

---

## Why VS Code as the first app for Phase 1

**Recommended over Photoshop because:**
- Command palette (Cmd+Shift+P) is the canonical search-first interface. If our search-first hypothesis works, VS Code is where it shines hardest.
- Easy verification (file system state, editor state via AX tree).
- Multiplatform out of the box.
- Most early adopters of the registry will be developers who have VS Code installed.

**Photoshop is in Phase 7** as the first explorer-agent contribution because it stress-tests vision-based discovery and verification harder than VS Code does. Saving it for after the model has shaken down.

---

## Why a parking lot file exists

**Considered:** Track deferred items as GitHub issues only.

**Chose a markdown file because:**
- `docs/parking-lot.md` is part of the project's living context. Claude Code reads it.
- Each entry has a "trigger to pick back up" condition. This makes deferral explicit, not forgotten.
- Issues are for actionable work. Parking lot is for strategic deferrals that we don't want to lose track of.

Both can coexist (issues for tactical work, parking lot for strategic deferrals).

---

## Why a slim CLAUDE.md plus separate docs, not one giant file

**Considered:** Put everything in CLAUDE.md.

**Chose four files (CLAUDE.md, PLAN.md, docs/architecture.md, docs/parking-lot.md, plus this design-rationale.md) because:**
- CLAUDE.md gets loaded into context every Claude Code session. Bloating it costs tokens that could go toward actual work.
- Splitting by purpose makes each file focused. CLAUDE.md is the index. PLAN.md is the live work list. architecture.md is the canonical depth. parking-lot.md is the deferred pile. design-rationale.md is the why.
- Each file has a clear update trigger, so the system maintains itself rather than drifting.

**Limit:** Don't sprawl beyond five or six docs. If something doesn't fit one of the existing files cleanly, it's probably a sign the file structure needs rethinking, not a sign to add another file.

---

## Why Photoshop is the launch target, not VS Code

**Decision (2026-05-03, "Path X"):** VS Code stays in place as the architectural-validation seed; Photoshop becomes the launch-time value-target. Phase 7 splits into 7a (universal GUI-app-control schema extensions, validated against a hand-curated Photoshop seed) and 7b (demo, UI/UX, soft launch).

**Why VS Code was the right Phase 1 choice and the wrong v0 showcase:**

- VS Code was correct for Phase 1 because the command palette + clean AX tree make schema validation easy. It exercises search-first dispatch, parameter substitution, and three verification types (`ax_tree_assertion`, `file_check`, `interpret_check`) without forcing the schema to grow before its time. That's engineering correctness, not user value.
- VS Code's value-add over Claude Code is small. Claude Code already drives VS Code directly via file edits and terminal commands, on the same machine, in the same session. MCP-mediated keystroke routing is slower and more brittle than direct file edits — there's no story for why someone would prefer it.
- Shipping v0 with only VS Code as the showcase would miscommunicate what Rosetta is for. A would-be user reading the demo thinks "I already have Claude Code; why would I install this?" and bounces. The product looks like a worse version of an existing tool.

**Why Photoshop is the launch target instead:**

- Photoshop has no native AI integration. There is no Photoshop equivalent of Claude Code, no "Ask Photoshop" command, no MCP server shipped by Adobe. The agent path is the only path.
- Photoshop is complex enough to surface real engineering needs that VS Code doesn't: long-running operations with loading states (filters, exports), surprise modals (unsaved-changes dialogs, registration popups, "this format requires…" warnings), parameterized continuous numeric values (brightness +10, hue shift -25°), and chained operations where one step's output feeds the next (crop region → fill selection → export).
- Audience overlap with the actual product fit. Rosetta's value is "agents controlling apps the agent's vendor doesn't ship integrations for." Creative pros and power users are exactly that audience: they already pay for app subscriptions, they already pay for AI assistants, and the gap between the two is a real frustration.

**What this changes for Phase 1's choice:** Nothing. Phase 1's VS Code seed remains the architectural validation it was always intended to be. Adding Photoshop earlier would have stalled schema work on harder problems (delays, popups, composition) before the basics were locked in. The Path X reframe is a launch-positioning fix, not a Phase 1 redo.

---

## Why the Phase 7a schema extensions are universal infrastructure

**Decision (2026-05-03):** The three additions in Phase 7a — `wait_for_idle` verification primitive, `pre_step` action sequence on the workflow, and minimal `produces` / `consumes` composition fields — are framed and authored as universal GUI-app-control infrastructure, not as Photoshop-specific hacks.

**Why this framing matters:**

- Every complex GUI app has loading states. Photoshop's filters, AutoCAD's 3D renders, Figma's exports, Excel's heavy recalcs, even Slack's channel switches when a workspace is large — all benefit from "the action ran; now wait for the app to be responsive again before checking verification." Without `wait_for_idle`, every shortcut in this category needs a hand-tuned `sleep` or a flaky verify retry loop.
- Every complex GUI app has surprise modals. Photoshop's "this image has transparency" prompt, AutoCAD's drawing-recovery dialog, Figma's "you've been kicked from the file" notification, browser auth-required popups. The current schema has no place to declare "before each step, dismiss any obvious modal." Without `pre_step`, every shortcut author re-implements the same dismiss-then-proceed dance.
- Every complex GUI app eventually requires chained operations. The user says "crop to the red girl, then make her dress green, then export as PNG" — three shortcuts, with state passing between them (the crop region informs the selection bounds, the selection informs the export). The chat LLM handles composition implicitly today; once chains get long enough that the LLM forgets intermediate state, an explicit `produces` / `consumes` contract gives the registry a hook to surface "this shortcut emits a selection; this one expects one."

**Why we're authoring these now, with Photoshop as the first user, instead of waiting:**

- Photoshop is the first app where the absence of these primitives is a hard blocker, not a stylistic gap. Without `wait_for_idle`, the brightness shortcut races the canvas redraw and verifies against stale state. Without `pre_step` modal dismissal, a clean session-start can't be relied on. Without `produces`/`consumes`, the headline demo prompt ("crop, then color-shift, then export") falls apart under realistic chat-LLM context loads.
- The alternative — "ship Photoshop with workarounds, formalize the primitives later" — locks Photoshop's seed shortcuts into ad-hoc patterns that other contributors would copy. Authoring the primitives upfront keeps the registry's idiom consistent across apps.
- The cost is small. All three additions are optional fields in the schema. Existing VS Code seeds validate unchanged. The MCP's `verify` dispatcher gains one new case; `pre_step` is read by the chat LLM, not the harness, so no runtime change is required to enable it. Composition is schema-only in v0; type-checking and runtime validation stay parked (parking-lot 4).

**The framing rule going forward:** when a contributor proposes a schema extension, the test is "would Excel benefit? Figma? Slack? AutoCAD?" If the answer is "only this one app needs it," push back on the design — there's almost certainly a more general primitive hiding inside the proposal. The Phase 7a additions pass that test by construction; they were derived from a category-of-apps analysis, not from a Photoshop wishlist.

---

## Why macOS action dispatch goes through AppleScript, not nut.js

Direct synthetic-input calls (CGEventPost via nut.js) require Accessibility permission for the calling binary. When Claude.app spawns the MCP via its disclaimer helper, the actual calling binary is `/usr/local/bin/node` (a system path). macOS won't grant Accessibility to system-path binaries via the GUI Privacy & Security panel, copies of node to non-system paths also fail (verified 2026-05-03), and ad-hoc codesigning workarounds are fragile against node version updates.

The validated alternative: AppleScript via osascript. Synthetic input requests are dispatched via `tell application "System Events" to keystroke ...` commands. System Events is a system daemon that holds Accessibility entitlement by default. macOS attributes the privileged call to System Events, not to the calling chain. The MCP node process simply shells out to osascript; no permissions for node required.

Trade-offs: macOS-only path. Windows and Linux continue using nut.js until those platforms get equivalent native automation (parking-lot work). The long-term distribution answer for all platforms is a signed native helper bundled with the MCP install (parking-lot 7); the AppleScript dispatch is the cheaper interim solution that unblocks v0 launch on macOS.

Validation references: tested 2026-05-03. Test 1 (osascript-from-terminal): keystroke landed in TextEdit. Test 2 (osascript-from-MCP-spawned-node): keystroke landed in the focused window. Both without any TCC permission grants on the node binary.

---

## Why interpret_check is judged by the agent, not the MCP

The original Phase 4 implementation routed `verify(interpret_check)` through a server-side LLM call (default Anthropic claude-haiku-4-5). The Phase 7a Part 3 Photoshop smoke surfaced two blockers. First, it required an Anthropic API key on the use path; the use seed skill is supposed to be unauthenticated for the user, so a key requirement on every interpret_check verification would gate first-run usage on a developer credential. Second, the screenshot bytes flowed through the MCP tool-result text channel as base64, and Claude Desktop rejected payloads above roughly 1MB; full-resolution Retina screenshots overshot that threshold immediately.

The fix in Phase 7b#1.5 collapses both blockers. `verify(interpret_check)` now captures a screenshot, returns `passed: null` with `error_class: "agent_must_judge"`, and attaches the image as a separate MCP image content block alongside the text result. The host agent answers the yes/no question with its own native vision and reports success or failure to `registry.report_execution`. No API key is needed on the use path, and the image flows through the multimodal channel which has its own size budget rather than competing with text content. The standalone `interpret` tool stays in the codebase as a niche escape hatch for callers that explicitly want a server-side LLM judgment, but it is no longer in the use-skill's hot path.

---

## What was almost a different product

A few framings West and I considered and rejected. Recording these so the project doesn't accidentally drift back into them:

- **A test-automation framework dressed up as an agent product.** The temptation: lean hard on verification, position this as "Selenium for the AI era." Rejected because it would alienate the actual user (someone who just wants their AI to do a task), and because the registry's value isn't in the verification rules, it's in the shared semantic library.
- **A browser-automation product.** Rejected because the interesting space is desktop apps where there's no DOM. Browser-only would put us in a crowded market (Skyvern, Browser Use, Stagehand, Operator) with weaker differentiation.
- **A managed cloud product.** Rejected because the user controlling their own desktop is the whole point. Cloud-runner architectures change what the product *is*.
- **A monetized marketplace.** Rejected for v0. Schema reserves the fields, payments parked. Trying to monetize before there's usage is a classic ordering mistake.
