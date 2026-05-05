# Architecture

Full design for Rosetta. CLAUDE.md is the index; this file is the canonical depth.

## System overview

```
┌─────────────────────┐         ┌────────────────────────────┐
│   User's desktop    │         │   Hosted (single repo,     │
│                     │         │   single Railway service)  │
│  ┌───────────────┐  │         │                            │
│  │ AI chat client│  │         │  ┌──────────────────────┐  │
│  │ (Claude Desk) │  │  HTTPS  │  │ Railway service      │  │
│  └──────┬────────┘  │◄───────►│  │ (Fastify + Prisma):  │  │
│         │ MCP       │         │  │  - Static site       │  │
│  ┌──────▼────────┐  │         │  │  - /apps/.../skill.md│  │
│  │ Skills MCP    │◄─┼─────────┼─►│  - /apps/.../*.json  │  │
│  │ server (local)│  │         │  │  - GET /lookup       │  │
│  │ + local       │  │         │  │  - POST /submit      │  │
│  │ explore state │  │         │  │  - POST /report-exec │  │
│  └──────┬────────┘  │         │  │  - OAuth callback    │  │
│         │           │         │  └──────────┬───────────┘  │
│  ┌──────▼────────┐  │         │             │              │
│  │ OS / app under│  │         │  ┌──────────▼───────────┐  │
│  │ control       │  │         │  │ Postgres (Railway)   │  │
│  └───────────────┘  │         │  │  Execution events,   │  │
│                     │         │  │  ShortcutStats,      │  │
│                     │         │  │  Contributors,       │  │
│                     │         │  │  Submissions audit   │  │
│                     │         │  └──────────────────────┘  │
└─────────────────────┘         └────────────────────────────┘

  Source-of-truth flow: spec JSON in Git repo
  → PR auto-merge on submission
  → Railway redeploys
  → new specs live in ~1 minute
```

Three components on the hosted side, one on the desktop side:

1. **Git repo** (single source of truth): JSON spec files (`registry/apps/{app_id}/meta.json` + `workflow.json` + `shortcuts.json`), the static site source, the backend code, and the MCP code. Version history is the audit trail. Submissions land as auto-merged PRs.
2. **Railway service** (Fastify + Prisma, deployed from the repo): serves the static website, the raw spec JSON, the per-app generated `skill.md` agent-context endpoints, and the API endpoints (`/lookup`, `/submit`, `/report-execution`, OAuth callback). On every auto-merged submission, Railway redeploys via its GitHub integration and the new spec goes live in about a minute.
3. **Postgres on Railway**: holds `Execution` events, aggregated `ShortcutStats`, `Contributor` records, and `Submission` audit rows. Specs are NOT in Postgres; the database only holds runtime data.
4. **MCP server** (local on user's desktop): bundled daemon exposing registry-lookup, computer-control, verification, submission, execution-reporting, and explore-session tools. Maintains a local explore-session state file at `<config_dir>/sessions/{app_id}.json`, where `<config_dir>` is the user's MCP config directory (resolved per-platform; see `mcp/src/config.ts`).

User installs the MCP once, pastes one of the two seed skills into their AI chat client, and starts giving natural-language commands. The use seed skill requires no authentication. Only the explore seed skill (which submits new shortcuts) requires GitHub OAuth.

## Repo layout

```
/
├── CLAUDE.md                  # slim project index (always loaded)
├── PLAN.md                    # live phased execution plan
├── README.md                  # public-facing pitch
├── LICENSE                    # MIT
├── docs/
│   ├── architecture.md        # this file
│   ├── parking-lot.md         # deferred items
│   ├── skills.md              # how to author a skill (Phase 1)
│   └── install.md             # user-facing install guide (Phase 7)
├── registry/
│   ├── index.json             # list of apps with versions/platforms
│   ├── schemas/
│   │   ├── workflow.schema.json
│   │   ├── shortcut.schema.json
│   │   └── meta.schema.json
│   └── apps/
│       └── {app_id}/
│           ├── meta.json
│           ├── workflow.json
│           └── shortcuts.json
├── mcp/                       # TypeScript MCP server
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── registry.ts        # lookup, list_apps, submit, report_execution
│   │   ├── os.ts              # action, screenshot, read_ax_tree, app_info
│   │   ├── verify.ts          # verification primitives
│   │   └── interpret.ts       # vision/audio interpretation
│   └── README.md
├── site/                      # static website source (served by Railway)
│   ├── index.html             # human landing page with seed-skill copy boxes
│   ├── app.html               # per-app human view template
│   ├── style.css
│   └── seed-skills/
│       ├── use.md             # the use-skill text (served at /seed-skills/use.md)
│       └── explore.md         # the explore-skill text
└── backend/                   # Railway-hosted Fastify + Prisma service
    ├── package.json
    ├── prisma/
    │   ├── schema.prisma      # executions, shortcut_stats, contributors, submissions
    │   └── migrations/
    ├── src/
    │   ├── index.ts           # Fastify bootstrap; registers static + API routes
    │   ├── static.ts          # serves site/ and registry/ files
    │   ├── routes/
    │   │   ├── lookup.ts      # GET /lookup — merges spec JSON + live stats
    │   │   ├── submit.ts      # POST /submit — agent reviewer + GitHub PR + auto-merge
    │   │   ├── report.ts      # POST /report-execution — telemetry intake
    │   │   ├── oauth.ts       # GitHub OAuth callback for explore-skill users
    │   │   └── skill_md.ts    # GET /apps/{app_id}/skill.md — generated agent view
    │   ├── github.ts          # GitHub REST API client (PRs, branches, merges)
    │   ├── reviewer.ts        # LLM-based prompt-injection sanity check
    │   └── stats.ts           # rolling success_rate / reliability_score aggregation
    └── README.md
```

**Note:** the website is NOT separately hosted on GitHub Pages. The Railway service reads `site/` and `registry/` from disk and serves them as static assets alongside the API. Single host, single deploy, single source-of-truth.

## Registry data model

### `registry/index.json`

```json
{
  "schema_version": 1,
  "apps": [
    {
      "id": "vscode",
      "display_name": "Visual Studio Code",
      "platforms": ["macos", "windows", "linux"],
      "tracked_versions": ["1.85+"],
      "skill_count": 12,
      "last_updated": "2026-05-02"
    }
  ]
}
```

### `registry/apps/{app_id}/meta.json`

```json
{
  "schema_version": 1,
  "id": "vscode",
  "display_name": "Visual Studio Code",
  "category": "code-editor",
  "platforms": ["macos", "windows", "linux"],
  "detection": {
    "macos": { "bundle_id": "com.microsoft.VSCode" },
    "windows": { "process_name": "Code.exe" },
    "linux": { "binary": "code" }
  },
  "search_first_supported": true,
  "command_palette_shortcut": {
    "macos": "cmd+shift+p",
    "windows": "ctrl+shift+p",
    "linux": "ctrl+shift+p"
  },
  "agent_primer": "VS Code is a code editor with a tab-based interface. Key concepts: the **editor area** (center, where files open), the **sidebar** (left, for file explorer / search / source control / extensions), the **terminal panel** (bottom, toggleable with cmd+`), the **status bar** (very bottom), and the **command palette** (cmd+shift+p, the canonical search-first action surface). Files open as tabs across the top of the editor area. Use the command palette for any action whose name you know; fall back to keyboard shortcuts only when you need raw speed."
}
```

The `agent_primer` field is a markdown-friendly free-text blob that gives the agent enough orientation to interpret user intents. Element names (canvas, sidebar, palette, etc.) and the canonical interaction patterns belong here. The agent reads this once per app via the generated `skill.md` endpoint before picking a shortcut.

### `registry/apps/{app_id}/workflow.json`

The generic execution harness for the app. One per app.

```json
{
  "schema_version": 1,
  "app_id": "vscode",
  "open": [
    { "type": "open_app", "platform_specific": true }
  ],
  "default_dispatch_strategy": [
    "search_first_if_supported",
    "shortcut_lookup",
    "menu_navigation",
    "vision_fallback"
  ],
  "verification_default": "ax_tree_assertion",
  "failure_recovery": [
    "retry_same_shortcut_once",
    "fallback_to_alternative_method",
    "escalate_to_explorer",
    "surface_to_user"
  ]
}
```

**Optional `pre_step` (Phase 7a, 2026-05-03 — universal GUI-app-control infrastructure):** complex GUI apps (Photoshop, AutoCAD, Figma, Excel) often surface unexpected modals (unsaved-changes prompts, format warnings, registration popups) that derail an otherwise-correct shortcut. The optional `pre_step` array runs before each shortcut's main `actions` to dismiss any visible modal. Empty/absent for apps with clean session-start (VS Code).

```json
{
  "schema_version": 1,
  "app_id": "photoshop",
  "open": [
    { "type": "open_app", "platform_specific": true }
  ],
  "default_dispatch_strategy": [
    "shortcut_lookup",
    "menu_navigation",
    "vision_fallback"
  ],
  "verification_default": "interpret_check",
  "failure_recovery": [
    "retry_same_shortcut_once",
    "wait_for_idle",
    "fallback_to_alternative_method",
    "escalate_to_explorer",
    "surface_to_user"
  ],
  "pre_step": [
    { "type": "key", "key": "escape" }
  ]
}
```

The `wait_for_idle` step in `failure_recovery` (also added Phase 7a) is appropriate for apps with loading states — re-attempt verify after the app finishes its current operation. See the `wait_for_idle` verification type below.

### `registry/apps/{app_id}/shortcuts.json`

Array of atomic operations. Multiple entries per intent are allowed; agent picks based on metadata.

```json
{
  "schema_version": 1,
  "app_id": "vscode",
  "shortcuts": [
    {
      "id": "open-file-by-name",
      "intent": "Open a file by its name or path",
      "parameters": [
        { "name": "filename", "type": "string", "required": true }
      ],
      "platforms": ["macos", "windows", "linux"],
      "app_versions": ["1.85+"],
      "method": "shortcut",
      "actions": [
        {
          "type": "key_combo",
          "keys": { "macos": "cmd+p", "windows": "ctrl+p", "linux": "ctrl+p" }
        },
        { "type": "type_text", "text": "{filename}" },
        { "type": "key", "key": "enter" }
      ],
      "verification": {
        "type": "ax_tree_assertion",
        "rule": "active_editor_filename_contains",
        "value": "{filename}"
      },
      "metadata": {
        "contributor_id": "seed",
        "payment_destination": null,
        "token_cost_estimate": 30,
        "speed_estimate_ms": 400,
        "submitted_at": "2026-05-02"
      }
    }
  ]
}
```

The shortcut JSON only stores **immutable, contributor-declared** fields. Runtime stats (`use_count`, `success_rate`, `reliability_score`, `last_validated`) live in the backend Postgres database and are merged into the response by `registry.lookup`. This keeps the Git history clean (one commit per spec change, not per execution) and lets reliability data update in real time without churning the repo.

**Optional `produces` on a shortcut and `consumes` on a parameter (Phase 7a, 2026-05-03 — universal GUI-app-control infrastructure, parking-lot 4 partial activation):** complex chains pass state between steps (the user says "crop to the red girl, then color-shift the dress, then export") and the chat LLM benefits from a structured cue about what each step emits. `produces` declares an output (`{ type, key }`); `consumes` on a downstream parameter declares "fill this from `from_id`'s `key`." Schema-only in v0; the chat LLM is the interpreter. Type-checking and runtime validation stay parked.

```json
{
  "id": "crop-to-region",
  "intent": "Crop the canvas to a rectangular region",
  "parameters": [
    { "name": "x", "type": "number", "required": true },
    { "name": "y", "type": "number", "required": true },
    { "name": "width", "type": "number", "required": true },
    { "name": "height", "type": "number", "required": true }
  ],
  "produces": { "type": "region", "key": "crop_box" },
  "actions": [ /* ... */ ],
  "verification": { /* ... */ },
  "metadata": { /* ... */ }
}
```

A downstream shortcut can then declare a parameter as consuming that output:

```json
{
  "id": "fill-region-with-color",
  "parameters": [
    {
      "name": "region",
      "type": "string",
      "required": true,
      "consumes": { "from_id": "crop-to-region", "key": "crop_box" }
    },
    { "name": "color", "type": "string", "required": true }
  ]
}
```

## MCP server: tool surface

All tools live under one MCP server. TypeScript, packaged for `npx @rosetta-skills/mcp` install (final npm name TBD).

**Tool naming convention.** Tool names on the MCP wire use snake_case (e.g. `registry_list_apps`, `os_app_info`). Documentation prose below uses the dotted form (`registry.list_apps`, `os.app_info`) for readability. The two map 1:1 via underscore ↔ dot. New tools follow this convention.

### Registry tools

- `registry.list_apps()` → list of apps with metadata. Hits the backend (`GET /apps`) so the response includes per-app skill counts and aggregate health.
- `registry.lookup(app_id, intent, platform?, app_version?)` → ranked array of matching shortcuts. Hits the backend (`GET /lookup`), which fetches the matching specs from the GitHub-Pages-hosted JSON and joins them with live stats from Postgres (`use_count`, `success_rate`, `reliability_score`, `last_validated`). Ranking: highest `reliability_score` first, then lowest `token_cost_estimate`, then lowest `speed_estimate_ms`. Brand-new shortcuts with insufficient data are returned with a `cold_start: true` flag and ranked below shortcuts with established stats unless nothing else matches.
- `registry.get_workflow(app_id)` → the app's workflow.json (fetched directly from the Railway backend's static-asset endpoint; no DB join needed).
- `registry.submit(skill_spec, github_token)` → calls the backend (`POST /submit`). Backend runs the agent reviewer (LLM prompt-injection check), and on pass auto-creates a branch, commits the spec, opens a PR, and auto-merges it. Returns the PR URL and merged commit SHA. No human review in v0.
- `registry.report_execution({ shortcut_id, verification_result, error_class?, app_version, platform, install_id })` → calls the backend (`POST /report-execution`). Records the execution event in Postgres and triggers a rolling re-aggregation of the shortcut's stats. **No GitHub auth required.** The MCP includes its locally-minted `install_id` (a stable random UUID generated at first launch and stored in the MCP config) for sybil-resistance rate limiting. Called automatically by the use seed skill after each execution; the user does not see this happen.

### OS tools

- `os.app_info(app_name)` → `{ installed: bool, version, platform, bundle_id?, pid?, error? }`. The `error` field is populated when the platform probe is stubbed (Windows / Linux in v0) or fails non-fatally (e.g., `mdfind` missing or returning nothing).
- `os.screenshot({ region?, format? })` → returns a text block (`{path, bytes, region?, format}`) plus an MCP image content block carrying the actual image bytes via the multimodal channel. Default `format` is `"jpg"` (smaller payloads keep us under Claude Desktop's tool-result text-content limit). Pass `format: "png"` for pixel-stable comparisons (screenshot_diff verification).
- `os.read_ax_tree(window?)` → returns accessibility tree as structured JSON
- `os.action(spec)` — discriminated union:
  - `{ type: "key", key: "enter" }`
  - `{ type: "key_combo", keys: "cmd+p" }` (string with platform pre-resolved by MCP)
  - `{ type: "type_text", text: "..." }`
  - `{ type: "click", target: { x, y } | { ax_path: "..." } }`
  - `{ type: "menu", path: ["Image", "Adjustments", "Brightness/Contrast"] }`
  - `{ type: "open_app", app_id: "vscode" }`

### Verification tools

- `verify(spec, observation?)` — discriminated union of verification types:
  - `ax_tree_assertion` — match against an AX tree query
  - `dom_assertion` — match against a DOM selector + value
  - `screenshot_diff` — capture before/after, compare regions
  - `file_check` — file exists, hash matches, content matches
  - `value_compare` — compare two strings/numbers
  - `interpret_check` — capture a screenshot and return `passed: null` with `error_class: "agent_must_judge"` plus the image attached as MCP image content; the host agent answers the yes/no question with its own native vision. The standalone `interpret` tool remains available as a niche escape hatch for explicit server-side LLM calls but is no longer used on the use path.
  - `wait_for_idle` — poll responsiveness until the frontmost app is idle, or fail with `wait_for_idle_timeout` after `max_seconds`. Universal primitive added Phase 7a (2026-05-03) for apps with loading states (Photoshop filters / saves, AutoCAD renders, Excel heavy recalcs, Figma exports). Spec: `{ type: "wait_for_idle", max_seconds: number, idle_seconds?: number }`. Default `idle_seconds = 1`. Implementation polls a lightweight osascript probe every `idle_seconds`; the probe IS the rate limiter (each probe runs with that interval as its timeout). macOS-only in v0; Windows/Linux return `wait_for_idle_not_implemented`.

### Interpretation tool

- `interpret(media, question, model?)` — calls a vision/audio model on captured media. Configurable provider (Anthropic/OpenAI/Gemini), defaults to whatever is set in MCP config.

### Explore-session tools

The explore seed skill is durable and resumable. The MCP maintains a local session state file per app at `<config_dir>/sessions/{app_id}.json`, where `<config_dir>` is the user's MCP config directory (resolved per-platform; see `mcp/src/config.ts`):

- macOS:   `~/Library/Application Support/rosetta-mcp/sessions/{app_id}.json`
- Windows: `%APPDATA%/rosetta-mcp/sessions/{app_id}.json`
- Linux:   `$XDG_CONFIG_HOME/rosetta-mcp/sessions/{app_id}.json` (fall back to `~/.config/rosetta-mcp/sessions/{app_id}.json` if `XDG_CONFIG_HOME` is unset)

Sessions are wall-clock-budgeted; when the budget runs out the session auto-ends but state persists for resume.

- `explore.start_session({ app_id, budget_minutes, submission_reserve_minutes? })` — creates or resumes a session. If a session file already exists for this `app_id`, it loads prior state and returns `{ resumed: true, previously_completed_intents: [...], previously_abandoned_intents: [...], findings_count: N }`. If no prior file, it creates one and returns `{ resumed: false }`. `submission_reserve_minutes` defaults to 5.
- `explore.save_finding({ shortcut_spec, status, verification_log? })` — appends a draft to the session's findings array. `status` is one of `drafted` (not yet tested), `verified` (tested, verification passed), or `rejected_by_self` (tested, abandoning). Re-saving with the same `shortcut_spec.id` updates in place.
- `explore.budget_status()` — returns `{ minutes_used, minutes_remaining, submission_reserve_minutes, should_stop_discovering: boolean }`. The `should_stop_discovering` flag flips true once `minutes_remaining <= submission_reserve_minutes`. The explore-skill text instructs the agent to check this periodically and stop discovering when it flips.
- `explore.submit_findings({ app_id })` — iterates over all `verified` findings that haven't been submitted yet and calls `registry.submit` on each. Marks each finding's record with the resulting PR URL and merged commit SHA. Idempotent: re-running won't double-submit.

**Local session file shape:**

```json
{
  "schema_version": 1,
  "app_id": "autocad",
  "started_at": "2026-05-03T10:00:00Z",
  "last_active_at": "2026-05-03T10:25:00Z",
  "ended_at": null,
  "budget": {
    "duration_minutes": 30,
    "submission_reserve_minutes": 5
  },
  "findings": [
    {
      "shortcut_id": "draw-line-by-coordinates",
      "shortcut_spec": { /* full spec, ready for registry.submit */ },
      "status": "verified",
      "verification_log": ["passed AX assertion: line element exists"],
      "submitted_at": "2026-05-03T10:24:00Z",
      "submission_pr_url": "https://github.com/wesleyshe/Rosetta/pull/42",
      "submission_commit_sha": "abc123..."
    }
  ],
  "completed_intents": ["draw line by coordinates", "open file"],
  "abandoned_intents": [
    { "intent": "render 3D scene", "reason": "no clean keyboard or AX path discovered" }
  ]
}
```

**Session-end policy:** when `minutes_used >= duration_minutes`, the MCP marks the session ended (`ended_at` set), state persists. A subsequent `explore.start_session` for the same `app_id` resumes from this file unless the user explicitly passes `{ reset: true }` to start fresh. Old session files are not auto-deleted; the user can manage them as plain files.

## The two seed skills (canonical text)

These are the paste-into-your-agent blobs. Treat as the user-facing API.

### Use skill

```
You have access to the `rosetta` MCP server. When the user asks you to perform a
task on a desktop application or website, follow this protocol:

1. Identify the target app from the user's request. If unclear, ask.
2. Call `os.app_info(app_name)` to detect installed version and platform.
3. Call `registry.lookup(app_id, intent, platform, app_version)` to fetch matching
   shortcuts and the app's workflow.
4. If multiple shortcuts match, pick by ranking: highest reliability_score first,
   then lowest token_cost_estimate, then lowest speed_estimate_ms. Prefer
   shortcuts without a `cold_start: true` flag unless nothing else matches.
5. **Risk gate.** If the chosen shortcut declares a `risk` of `destructive`,
   `financial`, or `external_communication` (anything other than `safe` or
   absent), pause and confirm with the user before executing. State plainly
   what the shortcut will do and what's irreversible about it (e.g.
   "I'm about to flatten all layers — once you save, the layered structure
   is gone"). If the user declines, abort and report. Skip this gate when
   `risk` is `safe` or absent. Note: the chat history for this turn IS the
   confirmation — if the user's original request already named the
   destructive action explicitly (e.g. "flatten the image and save it as
   cat.png"), treat that as consent and proceed without re-asking.
6. Open the app via `os.action({ type: "open_app", ... })` if it isn't already.
7. Execute the chosen shortcut's actions in order via `os.action(...)`.
8. After the actions, run the shortcut's `verification` spec via `verify(...)`.
   Handle the result based on its shape:
   - 8a. If `passed: true`, treat the shortcut as successful and continue to
     step 9.
   - 8b. If `passed: null` with `error_class: "agent_must_judge"`
     (interpret_check verifications), the result includes an attached
     screenshot image and a yes/no question. Look at the image with your
     native vision. Answer the question. If your answer matches the
     `expected` value (typically "yes"), treat the shortcut as successful.
     If not, set `error_class: "interpret_mismatch"` for step 9 and proceed
     to step 10.
   - 8c. **AX-rule fallback (v0).** If `passed: false` with
     `error_class: "ax_rule_not_implemented"`, the rule is unimplemented on
     this platform; this is NOT a real verification failure. Inline, do not
     escalate to step 10: call `os.screenshot()` (the result includes the
     screenshot image itself via the multimodal channel). Look at it and
     answer a yes/no question synthesized from the shortcut's `intent`
     (e.g. "Looking at this screen, has [intent] just happened?"). If yes,
     treat as successful; if no, treat as a verification failure
     (`error_class: "interpret_mismatch"`) and proceed to step 10.
   - 8d. Any other `passed: false` outcome (e.g. `verification_mismatch`,
     `file_not_found`, etc.) is a real failure, go to step 10.
9. Immediately call `registry.report_execution` with the verification result,
   including pass/fail, error class on fail, app version, and platform. Do this
   regardless of outcome. When the 8b judgment ran, report success based on
   your yes/no answer; if no, set `error_class: "interpret_mismatch"`. When
   the 8c fallback ran, report success based on the yes/no answer; if it
   answered no, set `error_class: "interpret_mismatch"`. Reliability scores
   in the registry depend on this feedback loop. No GitHub authentication is
   required.
10. If verification fails, follow the workflow's `failure_recovery` list:
    first retry once (and report that attempt too), then try the next-ranked
    shortcut, then attempt vision-based discovery using `os.screenshot()` +
    reasoning, then surface the failure to the user with a clear question.
11. Report what you did and the verification result back to the user.

Never invent shortcuts not in the registry. If no shortcut matches, say so and
suggest the user run the explore skill first.
```

### Explore skill

```
You have access to the `rosetta` MCP server. The user wants you to map an
application's capabilities and contribute new shortcuts to the registry. Use
whatever methods are available to you to discover how the app works. Sessions
are budget-bounded and resumable; do not start over each time. Follow this
protocol:

1. Confirm the target app, the budget (in wall-clock minutes; default 30 if not
   given), and the GitHub account that will receive credit for submissions. The
   user must have a connected GitHub OAuth session.
2. Call `os.app_info(app_name)` to detect version and platform.
3. Call `explore.start_session({ app_id, budget_minutes })`. If `resumed: true`,
   read `previously_completed_intents` and `previously_abandoned_intents` from
   the response and DO NOT re-explore those areas. Continue where you left off.
4. Fetch `apps/{app_id}/skill.md` (the agent_primer + workflow + existing-shortcuts
   summary). Read it. This is your orientation document. **Best-effort:** if
   the fetch returns 404, network-errors, or times out, proceed without it.
   In that case you have no `agent_primer`; rely on step 5's wildcard lookup
   to learn what intent strings already exist for this app, and infer
   terminology from those strings plus your own knowledge of the app.
5. Call `registry.lookup(app_id, "*")` to confirm what's already mapped in the
   live registry. Don't re-submit existing shortcuts. If step 4 degraded
   (skill.md fetch failed), this doubles as your existing-capabilities
   orientation.
6. Research the app freely within your remaining budget. Use any combination of:
   - Web search for official documentation, keyboard shortcut cheat sheets,
     forum threads, and changelogs.
   - The app's own help system, command palette, or settings menus.
   - `os.screenshot()` to inspect UI state visually.
   - `os.read_ax_tree()` to inspect accessibility structure.
   - Manual menu walking to capture shortcuts shown next to menu items.
   - Official keyboard reference cards from the vendor's site.
7. For each candidate capability, draft a shortcut spec following the schema in
   this document. Required top-level fields: `id`, `intent`, `parameters`,
   `platforms`, `app_versions`, `method`, `actions`, `verification`, `metadata`.
   The `metadata` object MUST include all five required sub-fields: `contributor_id`
   (the user's GitHub username from step 1), `payment_destination` (always `null`
   in v0; the field is reserved for the future payment economy and must be
   present), `token_cost_estimate` (integer, your best guess of input+output
   tokens to run this shortcut), `speed_estimate_ms` (integer, wall-clock ms
   from action start to verification pass), and `submitted_at` (today's date
   in YYYY-MM-DD). Submissions that omit any of these fail ajv validation at
   `/submit` time.
8. Execute the draft shortcut once and run its verification. If `verify`
   returns `passed: null` with `error_class: "agent_must_judge"` (the
   interpret_check shape — see use-skill step 7b), the result carries an
   attached screenshot; look at it with your native vision and judge the
   yes/no question against the `expected` value. If `verify` returns
   `passed: false` with `error_class: "ax_rule_not_implemented"`, apply the
   same inline AX-rule fallback the use skill uses (step 7c in that skill):
   `os.screenshot()` and a yes/no question synthesized from the shortcut's
   intent, judged with your own vision. Treat the yes/no answer as the
   verification result for save_finding purposes. Save the finding locally
   via `explore.save_finding({ shortcut_spec, status })`:
   - `status: "verified"` if the shortcut ran and verification passed
     (including a yes-judgment outcome).
   - `status: "rejected_by_self"` if the shortcut failed verification — this
     covers (i) any real `passed: false` from `verify` (e.g.
     `verification_mismatch`, `file_not_found`, `interpret_mismatch`),
     (ii) a no-judgment from the agent_must_judge path,
     (iii) a no-judgment from the ax_rule_not_implemented fallback path,
     and (iv) candidates that have no clean keyboard or accessibility path
     at all. Capture the reason in `verification_log`. Do not submit
     rejected findings; record them so future resumes don't re-attempt the
     same dead ends.
   - `status: "drafted"` only as a transient state during reasoning. Always
     update to `verified` or `rejected_by_self` before moving on.
9. Periodically call `explore.budget_status()`. When `should_stop_discovering`
   flips to `true`, stop drafting new shortcuts and proceed to step 10.
10. Call `explore.submit_findings({ app_id })`. This batches all `verified`
    findings into `registry.submit` calls. Each becomes a PR that auto-merges
    once the backend's reviewer passes it. The local session file records the
    PR URL and merged commit SHA per finding.
11. Report a summary to the user: total findings, verified count, submitted
    count, PR links, abandoned intents with reasons, and remaining budget. If
    the session ended on budget exhaustion, note that the user can run the
    explore skill again on the same app and you'll resume from this point.

If a candidate capability has no clean keyboard or accessibility path, mark it
`rejected_by_self` with reason rather than submitting a fragile shortcut. Prefer
search-first methods (command palette, app search bars) when the app supports
them, since they are the most resistant to UI changes.
```

## Failure recovery flow

When verification fails inside a workflow, the chat LLM (host) is the orchestrator. It does not pick from a fixed menu, it reads the workflow's `failure_recovery` list and applies its own judgment within that menu. Defaults defined in `workflow.json`, overridable per-shortcut if needed.

Standard recovery list (from least to most expensive):

1. Retry same shortcut once (transient OS hiccups, focus issues)
2. `wait_for_idle` and re-verify (added Phase 7a) — when the app might still be processing the previous action; common for Photoshop saves, AutoCAD renders, etc.
3. Try next-ranked shortcut for the same intent
4. Open command palette / search bar and try natural-language search if the app supports it
5. Vision-based discovery: screenshot, reason about the UI, propose actions
6. Surface to user with a structured question

The schema enum is the source of truth for which steps an app supports; the prose order above is the typical ordering. Apps without loading states (VS Code) omit the `wait_for_idle` step.

## Versioning and platform fan-out

Within a single shortcut entry, `platforms` and `app_versions` are arrays. If the same key combo works across all macOS, Windows, Linux for Photoshop 24-27, it lives as one entry with all those values. If a version diverges, fork into a new entry.

The agent passes its detected platform and app_version into `registry.lookup`. The registry filters server-side and returns only matching entries, sorted by ranking metadata.

## Hosting and contribution flow

The repo (specs) and Postgres (stats) are both sources of truth, for different things. Specs are immutable contracts and live in Git with full version history. Stats are mutable telemetry and live in Postgres. Neither replaces the other. Both the static site and the API are served by a single Railway service deployed from the same repo.

- **Git repo** is the source of truth for `registry/apps/{app_id}/*.json`, `site/` source files, `backend/` code, and `mcp/` code.
- **Railway** runs the Fastify service (which serves the static site + spec JSON + generated `skill.md` + API endpoints) and the Postgres database. GitHub Pages is not used.
- **Submissions** go through the backend's `POST /submit` endpoint. The backend runs the agent prompt-injection reviewer (an LLM checking the spec for obviously-malicious patterns), and on pass uses the contributor's GitHub OAuth token to create a branch, commit the spec, open a PR, and immediately auto-merge it. The PR is preserved as an audit-trail artifact even though it merges instantly. On merge, Railway's GitHub integration auto-redeploys the service. The new spec is live in about a minute.
- **Executions** are reported through `POST /report-execution`. The MCP sends a small JSON event after every shortcut run. The backend writes the raw event and re-aggregates the shortcut's stats. No auth required; sybil resistance comes from per-`install_id` rate limits.
- **Anonymous submissions are not allowed.** Every shortcut has a `contributor_id` (GitHub username). Anonymous *executions* are allowed (no OAuth required to use the registry), since the rating signal is the deterministic verification result, not a user vote.

## The `skill.md` endpoint (agent-readable views, generated)

The website serves two kinds of routes for each app:

- `apps/{app_id}/` — the **human** view. Rendered HTML showing the app metadata, current shortcut list with reliability scores, and contributor stats.
- `apps/{app_id}/skill.md` — the **agent** view. A markdown file generated on the fly by the backend by combining `meta.json` (especially `agent_primer`), `workflow.json` (the execution harness), and a summary of `shortcuts.json` (intents + IDs, not full action specs). The agent fetches this once per session to orient itself before calling `registry.lookup` for a specific intent.

The JSON files are the source of truth. The `skill.md` is a generated read-only view, never authored directly. This keeps validation on a single shape (the JSON schema) while still giving agents the heartbeat-style markdown context endpoint.

`skill.md` template (rendered server-side):

```markdown
# {display_name} ({app_id})

{agent_primer}

## Workflow

Default dispatch strategy: {default_dispatch_strategy joined}
Default verification: {verification_default}
Failure recovery (in order): {failure_recovery joined}

## Intents available

- `{shortcut.id}` — {shortcut.intent}
- ...

Call `registry.lookup({app_id}, intent, platform, app_version)` for the full action spec and live reliability score on any intent.
```

## Stats DB (Postgres, on Railway)

Schema sketch (Prisma):

```prisma
model Execution {
  id                String   @id @default(cuid())
  shortcut_id       String   // matches registry/apps/{app_id}/shortcuts.json id
  app_id            String
  install_id        String   // stable random UUID minted by the MCP at first launch
  success           Boolean  // bundled verification result, not user opinion
  error_class       String?  // standardized: "verification_mismatch", "action_failed", "app_not_found", etc
  app_version       String
  platform          String   // "macos" | "windows" | "linux"
  created_at        DateTime @default(now())

  @@index([shortcut_id, app_version, platform])
  @@index([install_id, shortcut_id, created_at])  // for rate limiting
}

model ShortcutStats {
  shortcut_id       String
  app_id            String
  app_version       String
  platform          String
  use_count         Int      @default(0)
  success_count     Int      @default(0)
  success_rate      Float?   // null until use_count >= MIN_SAMPLES_FOR_SCORE
  reliability_score Float?   // success_rate adjusted for sample size
  last_validated    DateTime?
  updated_at        DateTime @updatedAt

  // app_id required: shortcut_id is unique only within an app
  @@id([shortcut_id, app_id, app_version, platform])
}

model Contributor {
  github_username   String   @id
  oauth_token_hash  String?  // hashed; raw token never stored
  submission_count  Int      @default(0)
  last_active_at    DateTime @updatedAt
}

model Submission {
  id                String   @id @default(cuid())
  contributor_id    String   // github_username
  app_id            String
  shortcut_id       String
  pr_url            String
  pr_commit_sha     String?
  reviewer_verdict  String   // "passed" | "rejected" | "needs_human"
  reviewer_reason   String?
  status            String   // "pending_review" | "merged" | "rejected"
  created_at        DateTime @default(now())
}
```

Aggregation rules:

- A shortcut needs at least `MIN_SAMPLES_FOR_SCORE` executions (start at 5, tune with usage data) before a `success_rate` is computed; below that, `cold_start: true` is set in the lookup response.
- `reliability_score` is `success_rate` adjusted by Wilson lower bound to avoid rewarding shortcuts that succeeded once and stopped. Formula stays simple in v0; refine later.
- Stats are scoped per `(shortcut_id, app_version, platform)`. A shortcut that's reliable on macOS-Photoshop-25 but broken on Windows-Photoshop-26 should rank accordingly per platform/version slice.

## Why these choices

- **Hybrid storage (Git for specs, Postgres for stats):** Specs are immutable contracts that benefit from version history and diff-based review. Stats change every execution and would drown a Git history if stored that way. The split takes the strengths of each. See `docs/design-rationale.md`.
- **Railway-everywhere hosting (no GitHub Pages):** Single host, single deploy, one place to look for "is the website up." Specs are still authored in Git; Railway just reads them off disk after each redeploy. GitHub Pages was the original plan but introduces a second host with its own deploy timing; consolidating to Railway removes that complexity.
- **JSON is source of truth, `skill.md` is generated:** Authoring happens against one shape, validated by JSON schema. `skill.md` is a heartbeat-style markdown view rendered server-side from `meta.json` + `workflow.json` + `shortcuts.json`. Agents read the markdown for orientation, then call `registry.lookup` for structured action specs.
- **Ratings are verification results, not user votes:** Removes auth friction on the use path and makes ratings hard to spoof — to fake a "success" you have to actually run the shortcut and pass its bundled verification.
- **Explore is budget-bounded and resumable:** Real apps need many hours of mapping. Forcing one continuous session would either limit coverage or burn budget on re-exploring known areas. Wall-clock budgets + persistent local session files lets exploration scale across days without redundant work.
- **Bundled MCP:** user installs one thing. Computer-control isn't that much code (wraps `nut.js` for input, native AX bindings, `mss` for screenshots).
- **TypeScript for the MCP and the backend:** ergonomic `npx` install on the MCP side, shared language with the backend, MCP SDK is mature in TS, Prisma plays well with TS.
- **Static site, no framework:** minimal surface, no build complexity, ages well.
- **Search-first interaction model:** many modern apps have a command palette (VS Code, Linear, Notion, Obsidian, Cursor). When available, this dramatically reduces skill rot.
- **Phase 7a additions are universal GUI-app-control infrastructure (2026-05-03):** `wait_for_idle`, `pre_step` modal dismissal, and minimal `produces`/`consumes` composition were authored in response to Photoshop's complexity but apply to every app with loading states (Excel, Figma, AutoCAD), surprise modals (any app with auth or unsaved-changes prompts), and chained operations. Photoshop is the first user, not the only one. Existing VS Code seed validates unchanged because the new fields are all optional. See `docs/design-rationale.md` § "Why the Phase 7a schema extensions are universal infrastructure" for the full framing.
