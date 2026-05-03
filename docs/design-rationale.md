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

## Why GitHub-as-database, not a real DB

**Considered:** Postgres on Supabase / Neon / Railway with a web frontend. Or Cloudflare D1.

**Chose static JSON in a Git repo, served by GitHub Pages CDN, because:**
- Zero hosting cost for v0.
- Full version history, public auditability, free PR-based moderation.
- Easy rollback if a bad skill gets in (revert the commit).
- Forking is trivial. Anyone can run their own instance of the registry.
- No backend to maintain or pay for.

**What this costs us:** No transactional features (relevant when payments ship), slower iteration on schema changes, slower lookups than an indexed DB. All acceptable at v0 scale. Migration path to a real DB is straightforward when needed.

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

## Why GitHub OAuth required, no anonymous contributions

**Considered:** Anonymous web upload form. Lower friction.

**Chose GitHub OAuth for both contributors and explorer-skill users because:**
- Reputation is a load-bearing concept once the registry has scale. Anonymous contributions undermine reputation tracking.
- GitHub identity is essentially free for any developer audience.
- Identity gives us a future hook for the payment economy (`contributor_id` is in the schema from day one).
- Identity makes spam and bad-skill remediation easier.

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

## What was almost a different product

A few framings West and I considered and rejected. Recording these so the project doesn't accidentally drift back into them:

- **A test-automation framework dressed up as an agent product.** The temptation: lean hard on verification, position this as "Selenium for the AI era." Rejected because it would alienate the actual user (someone who just wants their AI to do a task), and because the registry's value isn't in the verification rules, it's in the shared semantic library.
- **A browser-automation product.** Rejected because the interesting space is desktop apps where there's no DOM. Browser-only would put us in a crowded market (Skyvern, Browser Use, Stagehand, Operator) with weaker differentiation.
- **A managed cloud product.** Rejected because the user controlling their own desktop is the whole point. Cloud-runner architectures change what the product *is*.
- **A monetized marketplace.** Rejected for v0. Schema reserves the fields, payments parked. Trying to monetize before there's usage is a classic ordering mistake.
