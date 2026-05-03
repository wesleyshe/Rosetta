# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Rosetta

A community-shared online registry of "skills" (semantic action sequences with built-in verification) that lets AI agents control any desktop app or website without per-app integration. Named for the translation layer between agent intent and app actions. Discover once, replay deterministically, fall back to vision when needed. Framed as a transition-era layer until apps ship native AI interfaces (MCP-style).

## Status

**Phase: Pre-code, design locked.** All major architectural decisions made. See `PLAN.md` for execution phases. See `docs/architecture.md` for full design.

No code exists yet. The repo currently holds only `CLAUDE.md`, `PLAN.md`, and `docs/`. Read `docs/architecture.md` before writing any code — it is the canonical source for schema, MCP tools, seed skills, and failure recovery flows. `docs/design-rationale.md` records why each decision was made; consult it before reconsidering one.

## Commands

No build, lint, or test commands exist yet (Phase 0 of `PLAN.md` has not started). When tooling lands, update this section.

Planned per `PLAN.md`:

- **Phase 1** — `npm run validate-registry` (ajv-based JSON schema validation against `registry/schemas/*`).
- **Phase 3** — TypeScript MCP build/run scripts in `mcp/`. Distribution: `npx @rosetta-skills/mcp` (final npm name TBD).
- **Phase 3 smoke test** — install MCP in Claude Desktop, confirm tools appear, confirm `registry.lookup` returns VS Code shortcuts.
- **Phase 4** — cross-platform end-to-end test: drive VS Code via the MCP from Claude Desktop.

## What this project is (one paragraph)

Two seed skills (text blobs the user pastes into their desktop AI client) plus one MCP server (one-line install) plus one hosted JSON registry. Seed skill 1 ("use") tells the agent to look up skills from the registry and execute them. Seed skill 2 ("explore") tells the agent to map an app and contribute new skills back. The registry is a static GitHub-hosted JSON dataset, contribution via PR. Target clients: desktop AI chat apps that support MCP (Claude Desktop, Claude Code, Cursor, ChatGPT Desktop, etc.). Web chat clients are explicitly out of scope for v0.

## Architecture summary

Three pieces:

1. **Registry** — static JSON files in this repo, served via GitHub Pages CDN. One folder per app: `meta.json`, `workflow.json`, `shortcuts.json`. Contributions land via PRs created from a web upload form (Cloudflare Worker or similar).
2. **MCP server** — single bundled binary, installed via `npx @rosetta-skills/mcp` (or equivalent — final npm name TBD if `rosetta` is taken). Exposes registry lookup, computer-control (input, screenshot, accessibility tree), verification, and submission tools. Cross-platform (macOS, Windows, Linux).
3. **Static website** — two views per app: human-readable docs view, and the raw JSON. Plus copy-to-clipboard boxes for the two seed skills.

Full design lives in `docs/architecture.md`. Read that before writing code.

## Tech stack (decided)

- **MCP server:** TypeScript, using `@modelcontextprotocol/sdk`. Distributed via npm so users install with `npx`.
- **Registry storage:** GitHub repo, JSON files, served as static assets via GitHub Pages.
- **Website:** static HTML/CSS/JS, no framework. Hosted on GitHub Pages (same repo).
- **Submission flow:** Cloudflare Worker (or Vercel Edge Function) that takes uploads and creates GitHub PRs via the GitHub API.
- **Identity:** GitHub OAuth for both contributors and explorer-skill users. No anonymous submissions.
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

See `docs/parking-lot.md` for the full list. The big ones: web chat client support, payment / contributor reward economy, automated skill decay detection, prompt-injection / bad-skill defenses beyond GitHub PR review, cross-skill composition contracts.

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
