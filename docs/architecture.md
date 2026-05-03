# Architecture

Full design for Rosetta. CLAUDE.md is the index; this file is the canonical depth.

## System overview

```
┌─────────────────────┐         ┌──────────────────────┐
│   User's desktop    │         │   Hosted (GitHub)    │
│                     │         │                      │
│  ┌───────────────┐  │  HTTPS  │  ┌────────────────┐  │
│  │ AI chat client│  │◄───────►│  │ Static website │  │
│  │ (Claude Desk) │  │         │  │ (Pages)        │  │
│  └──────┬────────┘  │         │  └────────────────┘  │
│         │ MCP       │         │                      │
│  ┌──────▼────────┐  │  HTTPS  │  ┌────────────────┐  │
│  │ Skills MCP    │◄─┼─────────┼─►│ Registry JSON  │  │
│  │ server (local)│  │         │  │ (Pages CDN)    │  │
│  └──────┬────────┘  │         │  └────────────────┘  │
│         │           │         │                      │
│  ┌──────▼────────┐  │  HTTPS  │  ┌────────────────┐  │
│  │ OS / app under│  │────────►│  │ Submission     │  │
│  │ control       │  │         │  │ Worker → PR    │  │
│  └───────────────┘  │         │  └────────────────┘  │
└─────────────────────┘         └──────────────────────┘
```

Three components:

1. **Registry** (hosted): static JSON, GitHub-as-database.
2. **MCP server** (local): bundled daemon exposing registry-lookup, computer-control, verification, submission tools.
3. **Website** (hosted): browse apps, copy seed skills, submit new skills.

User installs the MCP once, pastes one of the two seed skills into their AI chat client, and starts giving natural-language commands.

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
│   │   ├── registry.ts        # lookup, list_apps, submit
│   │   ├── os.ts              # action, screenshot, read_ax_tree, app_info
│   │   ├── verify.ts          # verification primitives
│   │   └── interpret.ts       # vision/audio interpretation
│   └── README.md
├── site/                      # static website (GitHub Pages)
│   ├── index.html
│   ├── app.html
│   ├── style.css
│   └── seed-skills/
│       ├── use.txt            # the use-skill text
│       └── explore.txt        # the explore-skill text
└── worker/                    # Cloudflare Worker for PR creation
    └── src/index.ts
```

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
  }
}
```

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
        "use_count": 0,
        "success_rate": null,
        "last_validated": "2026-05-02",
        "contributor_id": "seed",
        "payment_destination": null,
        "token_cost_estimate": 30,
        "speed_estimate_ms": 400,
        "reliability_score": null
      }
    }
  ]
}
```

## MCP server: tool surface

All tools live under one MCP server. TypeScript, packaged for `npx @rosetta-skills/mcp` install (final npm name TBD).

### Registry tools

- `registry.list_apps()` → list of apps with metadata
- `registry.lookup(app_id, intent, platform?, app_version?)` → ranked array of matching shortcuts
- `registry.get_workflow(app_id)` → the app's workflow.json
- `registry.submit(skill_spec, github_token)` → calls the submission worker, returns PR URL

### OS tools

- `os.app_info(app_name)` → `{ installed: bool, version, platform, bundle_id?, pid? }`
- `os.screenshot(region?)` → returns image (base64 or file path)
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
  - `interpret_check` — pass to `interpret()` and check the answer

### Interpretation tool

- `interpret(media, question, model?)` — calls a vision/audio model on captured media. Configurable provider (Anthropic/OpenAI/Gemini), defaults to whatever is set in MCP config.

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
   then lowest token_cost_estimate, then lowest speed_estimate_ms.
5. Open the app via `os.action({ type: "open_app", ... })` if it isn't already.
6. Execute the chosen shortcut's actions in order via `os.action(...)`.
7. After the actions, run the shortcut's `verification` spec via `verify(...)`.
8. If verification fails, follow the workflow's `failure_recovery` list:
   first retry once, then try the next-ranked shortcut, then attempt vision-based
   discovery using `os.screenshot()` + reasoning, then surface the failure to the
   user with a clear question.
9. Report what you did and the verification result back to the user.

Never invent shortcuts not in the registry. If no shortcut matches, say so and
suggest the user run the explore skill first.
```

### Explore skill

```
You have access to the `rosetta` MCP server. The user wants you to map an
application's capabilities and contribute new shortcuts to the registry. Use
whatever methods are available to you to discover how the app works. Follow this
protocol:

1. Confirm the target app and the GitHub account that will receive credit for
   submissions. The user must have a connected GitHub OAuth session.
2. Call `os.app_info(app_name)` to detect version and platform.
3. Call `registry.lookup(app_id, "*")` to see what's already mapped. Don't
   re-submit existing shortcuts.
4. Research the app freely. Use any combination of:
   - Web search for official documentation, keyboard shortcut cheat sheets,
     forum threads, and changelogs.
   - The app's own help system, command palette, or settings menus.
   - `os.screenshot()` to inspect UI state visually.
   - `os.read_ax_tree()` to inspect accessibility structure.
   - Manual menu walking to capture shortcuts shown next to menu items.
   - Official keyboard reference cards from the vendor's site.
5. For each candidate capability, draft a shortcut spec following the schema
   in `docs/architecture.md`. Required fields: id, intent, parameters, platforms,
   app_versions, method, actions, verification, metadata.
6. Before submitting, execute the draft shortcut once and run its verification.
   Only submit shortcuts whose verification passes.
7. Submit each verified shortcut via `registry.submit(spec, github_token)`. The
   submission opens a PR for review.
8. Report a summary: shortcuts attempted, verified, submitted, with PR links.

If a candidate capability has no clean keyboard or accessibility path, document
it and skip it rather than submitting a fragile shortcut. Prefer search-first
methods (command palette, app search bars) when the app supports them, since
they are the most resistant to UI changes.
```

## Failure recovery flow

When verification fails inside a workflow, the chat LLM (host) is the orchestrator. It does not pick from a fixed menu, it reads the workflow's `failure_recovery` list and applies its own judgment within that menu. Defaults defined in `workflow.json`, overridable per-shortcut if needed.

Standard recovery list (from least to most expensive):

1. Retry same shortcut once (transient OS hiccups, focus issues)
2. Try next-ranked shortcut for the same intent
3. Open command palette / search bar and try natural-language search if the app supports it
4. Vision-based discovery: screenshot, reason about the UI, propose actions
5. Surface to user with a structured question

## Versioning and platform fan-out

Within a single shortcut entry, `platforms` and `app_versions` are arrays. If the same key combo works across all macOS, Windows, Linux for Photoshop 24-27, it lives as one entry with all those values. If a version diverges, fork into a new entry.

The agent passes its detected platform and app_version into `registry.lookup`. The registry filters server-side and returns only matching entries, sorted by ranking metadata.

## Hosting and contribution flow

- Repo is the source of truth. JSON files live in Git, full version history.
- GitHub Pages serves `site/` and the `registry/` files at a stable URL (e.g., `https://{user}.github.io/rosetta/registry/index.json`).
- Contributions go through PR. Web upload form on the site posts to a Cloudflare Worker, which uses the user's GitHub OAuth token to open a PR against the repo.
- Anonymous submissions are not allowed. Every shortcut has a `contributor_id` (GitHub username).

## Why these choices

- **GitHub-as-database**: zero hosting cost, full audit trail, free PR-based moderation, easy rollback. Good enough for v0; can graduate to a real DB when the economy ships.
- **Bundled MCP**: user installs one thing. Computer-control isn't that much code (wraps `nut.js` for input, native AX bindings, `mss` for screenshots).
- **TypeScript for the MCP**: ergonomic `npx` install, single binary distribution via `pkg` if needed, MCP SDK is mature in TS.
- **Static site, no framework**: minimal surface, no build complexity, ages well.
- **Search-first interaction model**: many modern apps have a command palette (VS Code, Linear, Notion, Obsidian, Cursor). When available, this dramatically reduces skill rot.
