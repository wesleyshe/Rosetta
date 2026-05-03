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
- [x] Create GitHub repo and push

**Estimate:** 30-60 min.

---

## Phase 1: Registry schema + first app's seed data

**Goal:** Schema is defined, validated, and one real app has hand-written entries that exercise the full schema.

- [ ] Write JSON schemas: `registry/schemas/workflow.schema.json`, `registry/schemas/shortcut.schema.json`, `registry/schemas/meta.schema.json`
- [ ] Pick first app: **VS Code recommended** (cleanest test of search-first interaction model)
- [ ] Write `registry/apps/vscode/meta.json`
- [ ] Write `registry/apps/vscode/workflow.json` (the generic execution harness for VS Code)
- [ ] Write `registry/apps/vscode/shortcuts.json` with 5-10 hand-curated shortcuts (open file, search files, run command from palette, format file, toggle sidebar, etc.)
- [ ] Add `registry/index.json` listing all apps
- [ ] Set up `ajv` validation script: `npm run validate-registry`
- [ ] Write `docs/skills.md` explaining how to author a skill

**Estimate:** 3-5 hours.

---

## Phase 2: Static website

**Goal:** Public-facing site lists apps, shows two seed skills, lets users browse the registry.

- [ ] `site/index.html` — list of apps from `registry/index.json`
- [ ] `site/app.html` — per-app page with two tabs (human-readable view, raw JSON view)
- [ ] Two prominent copy-to-clipboard boxes for the seed skills (use + explore)
- [ ] Minimal CSS (no framework needed)
- [ ] GitHub Actions workflow to deploy `site/` to GitHub Pages
- [ ] Verify the site loads `registry/` JSON files at runtime

**Estimate:** 4-6 hours.

---

## Phase 3: MCP server scaffolding (registry-side tools)

**Goal:** MCP server installs cleanly, connects to Claude Desktop, exposes registry lookup tools.

- [ ] `mcp/` TypeScript project setup with `@modelcontextprotocol/sdk`
- [ ] Implement `registry.lookup(app, intent, platform?, version?)` — fetches from the hosted registry and returns matching skills ranked by reliability
- [ ] Implement `registry.list_apps()` — returns the full app list
- [ ] Implement `os.app_info(name)` — detects installed app version and platform
- [ ] Smoke test: install in Claude Desktop, verify tools appear, verify lookup returns VS Code shortcuts
- [ ] Publish initial version to npm under a placeholder name

**Estimate:** 4-6 hours.

---

## Phase 4: Computer-control tools

**Goal:** MCP can drive the user's actual desktop. Cross-platform basics work.

- [ ] `os.screenshot(region?)` — full screen or region capture
- [ ] `os.action({type, ...})` — keystroke, key combo, mouse click, type-text. Wraps platform-native input (use `nut.js` or `robotjs` for cross-platform)
- [ ] `os.read_ax_tree(window?)` — accessibility tree per platform (NSAccessibility on macOS, UIA on Windows, AT-SPI on Linux)
- [ ] `verify(spec, observation?)` — implement DOM assertion, AX assertion, screenshot diff, file existence/hash checks
- [ ] `interpret(media, question)` — calls a vision/audio model on captured media (start with a single configurable provider)
- [ ] Cross-platform smoke test: drive VS Code via the MCP from Claude Desktop, end-to-end

**Estimate:** 8-15 hours. Hardest phase.

---

## Phase 5: Two seed skills written and tested

**Goal:** The two pasteable skill blobs work as advertised. Use-skill executes a known shortcut. Explore-skill discovers a new one.

- [ ] Finalize the use-skill text (in `docs/architecture.md`)
- [ ] Finalize the explore-skill text (in `docs/architecture.md`)
- [ ] Manual test: paste use-skill into Claude Desktop, ask "open file X in VS Code," verify it works
- [ ] Manual test: paste explore-skill, ask agent to map a new VS Code feature, verify a draft shortcut spec gets generated
- [ ] Iterate on prompt wording until both skills are reliable

**Estimate:** 3-5 hours.

---

## Phase 6: Submission flow (PR-based contribution)

**Goal:** Explorer agent can submit new skills back to the registry without manual file editing.

- [ ] `worker/` Cloudflare Worker (or Vercel Edge Function) that takes a skill submission JSON + GitHub OAuth token
- [ ] Worker creates a branch, commits the new shortcut, opens a PR
- [ ] GitHub OAuth flow on the static site for contributor identity
- [ ] `registry.submit(skill_spec)` MCP tool that calls the worker
- [ ] PR template with auto-populated metadata
- [ ] Smoke test: explorer agent submits a real skill, PR appears, merge it manually

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

26-49 hours of vibe-coding for v0. Achievable in a few weekends if focused, longer if exploring at each step.

## Notes for future updates

- Update phase status markers as work happens.
- If a phase's substeps change materially, edit the substeps and note the change at the bottom of `CLAUDE.md`.
- If a new phase is needed, insert it in order and renumber.
- Don't delete completed phases. Mark them `[x]` and leave them. The history is useful.
