# Authoring a Skill

A skill in Rosetta is a single shortcut entry in `registry/apps/{app_id}/shortcuts.json` — an atomic, contributor-declared way to accomplish one intent in one app, with a built-in verification that proves the action worked.

This document covers how to author one by hand. The explore seed skill drafts these automatically once an app's `meta.json` and `workflow.json` are in place.

## File layout

Each app gets a folder under `registry/apps/`:

```
registry/apps/{app_id}/
├── meta.json       # identity, platform detection, agent_primer
├── workflow.json   # generic execution harness for the app
└── shortcuts.json  # the actual capability list
```

The folder name, `meta.id`, `workflow.app_id`, and `shortcuts.app_id` must all match exactly. The validator enforces this.

The app must also have a row in `registry/index.json`. Adding a new app means: create the folder, add the three files, and append an entry to `index.json`.

## Schemas live at `registry/schemas/`

Three files: `meta.schema.json`, `workflow.schema.json`, `shortcut.schema.json`. The canonical examples are in `docs/architecture.md`.

The schemas declare `schema_version: 1` at every top-level. Breaking changes bump the major version and live in a new schema directory; v0 has no migration framework yet (parking-lot item 7).

## The shortcut entry

A shortcut looks like:

```json
{
  "id": "open-file-by-name",
  "intent": "Open a file by its name or path using Quick Open",
  "parameters": [
    { "name": "filename", "type": "string", "required": true }
  ],
  "platforms": ["macos", "windows", "linux"],
  "app_versions": ["1.85+"],
  "method": "shortcut",
  "actions": [
    { "type": "key_combo", "keys": { "macos": "cmd+p", "windows": "ctrl+p", "linux": "ctrl+p" } },
    { "type": "type_text", "text": "{filename}" },
    { "type": "key", "key": "enter" }
  ],
  "verification": {
    "type": "ax_tree_assertion",
    "rule": "active_editor_filename_contains",
    "value": "{filename}"
  },
  "metadata": {
    "contributor_id": "your-github-handle",
    "payment_destination": null,
    "token_cost_estimate": 30,
    "speed_estimate_ms": 400,
    "submitted_at": "2026-05-03"
  }
}
```

### Required fields

- **`id`** — kebab-case, unique within this app's `shortcuts.json`.
- **`intent`** — plain-language statement of what the shortcut does. Used for fuzzy intent matching by `registry.lookup`.
- **`parameters`** — array of `{ name, type, required? }`. Empty array if none. `name` is snake_case and substituted as `{name}` in templates.
- **`platforms`** — at least one of `macos`, `windows`, `linux`. Multiple if the same actions work cross-platform.
- **`app_versions`** — version range strings (e.g. `["1.85+"]`, `["24-27"]`). Free-form for v0.
- **`method`** — one of `shortcut`, `search`, `menu`, `click`, `vision`. Lets ranking favor classes (e.g. search-first over raw key combos).
- **`actions`** — sequence of action objects. See _Action types_.
- **`verification`** — see _Verification types_. Required on every shortcut; no exceptions.
- **`metadata`** — exactly five fields: `contributor_id`, `payment_destination` (always `null` in v0), `token_cost_estimate`, `speed_estimate_ms`, `submitted_at` (`YYYY-MM-DD`). **Runtime stats live in Postgres and are NOT in this block.**

### Optional fields

- **`risk`** — `safe` (default), `destructive`, `financial`, `external_communication`. Hint to the use seed skill (parking-lot item 10).

### Forbidden in `metadata`

The following live in the Postgres `ShortcutStats` table and must never appear in JSON. The validator rejects them as `additionalProperties` violations:

- `use_count`
- `success_count`
- `success_rate`
- `reliability_score`
- `last_validated`

## Action types

| `type`       | Shape                                                                | Notes                                                                                                                             |
| ------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `key`        | `{ type, key }`                                                      | Single key (e.g. `enter`, `escape`, `F2`, `tab`).                                                                                 |
| `key_combo`  | `{ type, keys }`                                                     | `keys` is either a string (`"cmd+s"`) or a per-platform map (`{ macos, windows, linux }`).                                        |
| `type_text`  | `{ type, text }`                                                     | Supports `{parameter}` placeholders.                                                                                              |
| `click`      | `{ type, target: {x, y} \| {ax_path} }`                              | Coordinate clicks are fragile across resolutions; prefer `ax_path`.                                                               |
| `menu`       | `{ type, path: ["File", "New File", ...] }`                          | Walks the OS menu bar. Locale-dependent (parking-lot item 9).                                                                     |
| `open_app`   | `{ type, app_id }` **OR** `{ type, platform_specific: true }`        | First form for `shortcut.actions[]`; second form for `workflow.open[]`. Mutually exclusive — schema rejects both/neither present. |

The action `$defs` are byte-identical between `workflow.schema.json` and `shortcut.schema.json`. Any change to action types must touch both files — the validator lints this.

## Verification types

Verification is what turns a sequence of actions into a checkable claim. Pick the cheapest reliable check.

| `type`               | Use when                                                              | Shape                                                            |
| -------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `ax_tree_assertion`  | Action puts a known widget on screen (modal, palette, focus change). | `{ type, rule, value? }` — `rule` is a named predicate `verify()` recognizes. |
| `dom_assertion`      | Web-app contexts.                                                     | `{ type, selector, value? }`                                     |
| `screenshot_diff`    | Action should (or should NOT) cause visible change in a region.       | `{ type, region?, max_pixel_diff_ratio? }`                       |
| `file_check`         | Action persists state to disk.                                        | `{ type, path, exists?, hash?, content_contains? }`              |
| `value_compare`      | Expected post-state is computable from inputs.                        | `{ type, left, right, comparator? }`                             |
| `interpret_check`    | Nothing else fits — fall back to asking a vision model.               | `{ type, question, expected }`                                   |

If you have no clean way to verify, the shortcut is too fragile to ship — find a different action sequence. Skills with weak verifications generate noisy reliability stats and get downranked in lookups.

## Method choice

The `method` field is a coarse classification:

- **`shortcut`** — keyboard shortcut. Fastest, most reliable when the keybinding is stable across versions.
- **`search`** — through a command palette / fuzzy action search. Most resistant to UI redesigns; preferred for apps where `meta.search_first_supported: true`.
- **`menu`** — OS menu bar walk. Works almost everywhere but slow and locale-sensitive.
- **`click`** — coordinate or AX-path click. Fragile; use only when nothing better exists.
- **`vision`** — vision-model-driven action selection. The escape hatch.

Multiple methods can share the same intent. **Don't deduplicate** — let the live `reliability_score` decide which the agent actually uses. See `docs/design-rationale.md` § "Why one workflow per app, with searchable shortcuts."

## Placeholders

Any string field in `actions[]` (`type_text.text`, `key_combo.keys` strings, `menu.path[]`) or `verification` (`ax_tree_assertion.value`, `file_check.path`, `value_compare.left/right`, `interpret_check.expected`) can contain `{parameter_name}` placeholders that the MCP substitutes from the agent's input.

Every placeholder must correspond to a declared parameter in the same shortcut. The validator catches typos like `{filename}` when the parameter is named `file_path`.

## Validating before submission

Run the registry validator before opening a PR (or before letting the explore seed skill auto-submit):

```bash
npm install            # first time only
npm run validate-registry
```

The validator performs:

1. **JSON Schema validity** for `meta.json`, `workflow.json`, `shortcuts.json` against `registry/schemas/`.
2. **Action `$defs` byte-identical** between `workflow.schema.json` and `shortcut.schema.json`.
3. **Shortcut `id` uniqueness** within each `shortcuts.json`.
4. **Cross-file consistency:** folder name == `meta.id` == `workflow.app_id` == `shortcuts.app_id`.
5. **Placeholder coverage:** every `{placeholder}` used in actions/verification is declared in the shortcut's `parameters[]`.
6. **`registry/index.json` consistency:** every app folder is listed and every listing has a folder.

If validation fails, fix the issue before submitting. The backend's `/submit` endpoint runs the same checks.

## What lives in JSON, what lives in Postgres

Specs in JSON are immutable contracts: actions, verification rules, contributor identity, hand-estimated cost/speed. They live forever in Git, fully diffable.

Runtime stats (`use_count`, `success_count`, `success_rate`, `reliability_score`, `last_validated`) live in the Postgres `ShortcutStats` table on Railway. They populate from `registry.report_execution` calls and update on every shortcut run. **Never put these fields in `shortcut.json`** — the validator rejects them.

If a shortcut decays (drops below the registry's effective reliability threshold over time), the lookup endpoint naturally downranks it. To "fix" a decayed shortcut: submit an updated version. The new entry starts at zero stats and competes with the old one on hit-rate. See `docs/design-rationale.md` § "Why ratings are verification results, not user votes."

## Search-first preference

If the target app has a command palette (`meta.search_first_supported: true`), prefer authoring a `method: "search"` shortcut over a `method: "shortcut"` one for the same intent. The search-first form is more resistant to keybinding changes between versions.

You can ship both forms for the same intent — let the reliability score decide which gets picked. Don't pre-deduplicate.

## What good looks like

A worked example: VS Code's eight seed shortcuts at `registry/apps/vscode/shortcuts.json` exercise three verification types (`ax_tree_assertion`, `file_check`, `interpret_check`), two methods (`shortcut`, `search`), and span keystroke-only actions, parameterized actions, and palette-driven search flows. Read it before authoring your first skill.

## Where to look next

- `docs/architecture.md` — full schema reference, MCP tool surface, hosting flow.
- `registry/apps/vscode/` — v0 hand-curated reference app.
- `docs/design-rationale.md` — why each design choice was made; many alternatives were considered and rejected with reasons.
- `docs/parking-lot.md` — features deferred from v0 (locale variants, sensitive-action gating, multi-window targeting, etc.). If your shortcut needs one of these, flag it in the PR description.
