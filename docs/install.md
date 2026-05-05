# Install

How to get Rosetta running on your machine and use it from an MCP-capable AI client. macOS only in v0; Windows and Linux land later (CLAUDE.md change log tracks status).

The full install takes about 10 minutes the first time, less if you've used MCP before. Two outcomes once you finish:

- **Use skill (no auth required).** Your agent looks up shortcuts in the live registry and replays them deterministically.
- **Explore skill (GitHub auth, ~3 minutes to set up).** Your agent maps a new app within a wall-clock budget and contributes shortcut specs back as auto-merged PRs.

You only install once; both skills run off the same MCP server.

---

## Requirements

- **macOS 13 or newer.**
- **Node.js 18 or newer.** Check with `node -v`.
- **An MCP-capable AI client.** Tested against Claude Desktop. Should also work with Claude Code, Cursor, ChatGPT Desktop, and other MCP-compatible clients.
- **For the explore skill:** a GitHub account.

---

## Step 1: Clone and build

The MCP isn't on npm yet (planned post-launch). v0 install is from source.

```sh
git clone https://github.com/wesleyshe/Rosetta.git
cd Rosetta/mcp
npm install
npm run build
```

`npm run build` compiles to `dist/index.js`. That's the file your AI client launches.

Note your repo's absolute path; you'll need it in step 2:

```sh
cd ..
pwd
# e.g. /Users/your-username/Documents/Rosetta
```

---

## Step 2: Wire it into your AI client

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`. Create the file if it doesn't exist.

Add a `rosetta` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "rosetta": {
      "command": "node",
      "args": [
        "/full/path/to/Rosetta/mcp/dist/index.js"
      ],
      "env": {
        "ROSETTA_REGISTRY_PATH": "/full/path/to/Rosetta/registry",
        "ROSETTA_BACKEND_URL": "https://rosetta-production-e301.up.railway.app"
      }
    }
  }
}
```

Replace `/full/path/to/Rosetta` with the path you noted in step 1.

What each env var does:

- `ROSETTA_REGISTRY_PATH`: local fallback when the backend is unreachable. Your MCP reads from this disk path if backend lookups fail.
- `ROSETTA_BACKEND_URL`: live registry URL. Default points at the production Railway deploy. Comment out to force dry-run mode.
- `ROSETTA_GITHUB_TOKEN`: optional, set in step 4 below if you plan to submit shortcuts.

Quit Claude Desktop fully (Cmd+Q from the menu bar, not just close the window). Reopen.

### Other MCP clients

Claude Code, Cursor, ChatGPT Desktop, and others use similar config formats. Same shape applies: `command: node`, `args: [path to dist/index.js]`, `env` block with the variables above. Refer to your client's MCP documentation for the config file location.

---

## Step 3: Grant macOS permissions

Rosetta drives apps via Apple's automation infrastructure. macOS gates this behind two permission prompts the first time each fires.

### 3a. Accessibility (for keyboard input + AX queries)

The first time the MCP issues a keystroke or queries an app's accessibility tree, macOS prompts:

> "System Events.app would like to control this computer using accessibility features."

Click **OK** once. The grant persists. macOS attributes the request to System Events (a macOS daemon), not to Node, because Rosetta routes through `osascript`. See `docs/design-rationale.md` § "Why macOS action dispatch goes through AppleScript" for the full rationale.

If you previously denied this prompt, reset it:

1. Open **System Settings → Privacy & Security → Accessibility**.
2. Find **System Events** in the list. If absent, no apps have requested it yet.
3. Toggle the switch on.

### 3b. Automation (for app-specific control)

The first time the MCP drives a specific app (e.g., Photoshop, VS Code) via menu navigation, macOS prompts:

> "Claude wants to control [App Name]."

Click **OK** once per target app. The grant is per-source-app (Claude in this case) and per-target-app, so you'll see this prompt the first time the agent runs against each new app.

To audit or reset these grants:

1. Open **System Settings → Privacy & Security → Automation**.
2. Find **Claude** in the list. Expand to see which apps it's allowed to control.
3. Toggle individual apps on or off as needed.

### 3c. Screen Recording (only if screenshots fail)

Rosetta's `os_screenshot` shells to `screencapture`, which usually works without explicit Screen Recording permission for full-desktop captures. If you hit a "screencapture failed" error or get black images, grant it:

1. **System Settings → Privacy & Security → Screen Recording**.
2. Add **Claude** (or whichever app spawns the MCP). On macOS this typically requires the app to restart.

---

## Step 4: Verify the install

In Claude Desktop, open a new chat and trigger the slash menu by typing `/`. Tools from the rosetta MCP appear with a `rosetta:` prefix. You should see 19:

- `rosetta:registry_list_apps`, `registry_lookup`, `registry_submit`, `registry_report_execution`, `registry_chain_state`, `registry_propose_finding`, `registry_list_proposals`, `registry_submit_proposals`
- `rosetta:os_app_info`, `os_screenshot`, `os_action`, `os_list_windows`, `os_read_ax_tree`
- `rosetta:verify`, `interpret`
- `rosetta:explore_start_session`, `explore_save_finding`, `explore_budget_status`, `explore_submit_findings`

If they don't appear, see Troubleshooting below.

---

## Step 5: Try the use skill

Visit https://rosetta-production-e301.up.railway.app. Click **Copy** under "Use skill". Paste into a fresh Claude Desktop chat as your first message. The agent acknowledges.

Then give it a task:

```
Open /Users/your-username/Desktop/some-image.jpg in Photoshop.
```

(Substitute a real image path you have on disk.)

The agent calls `os_app_info`, `registry_lookup`, brings Photoshop forward via `os_action open_app`, runs the open-file shortcut's keystrokes, verifies, and reports.

Other intents tested against the seed:

- `Open <path> in Photoshop.`
- `In Photoshop, increase brightness by 15.`
- `In Photoshop, convert to grayscale.`
- `In Photoshop, select the Brush tool.`
- `In Photoshop, zoom to fit screen.`

For VS Code: `Open README.md in VS Code`, `Run the test suite from the command palette`, etc.

---

## Step 6: Set up GitHub auth (for the explore skill)

The explore skill submits findings back to the registry as auto-merged PRs. That requires a GitHub identity.

Three steps:

1. Visit `https://rosetta-production-e301.up.railway.app/auth/github/login` in your browser. Complete the OAuth flow (authorize the Rosetta app with `public_repo` scope).
2. After the redirect back, visit `https://rosetta-production-e301.up.railway.app/auth/github/token`. The page shows your token and the exact config snippet to paste.
3. Add `ROSETTA_GITHUB_TOKEN` to your MCP config's rosetta env block. Restart Claude Desktop.

Treat the token like a password. Anyone with it can submit shortcuts as you. To revoke, visit https://github.com/settings/applications and remove the Rosetta authorization.

If you'd rather try the explorer without auth first: comment out `ROSETTA_BACKEND_URL` in your config to force dry-run mode. Findings still save locally to `~/Library/Application Support/rosetta-mcp/sessions/{app_id}.json`. The submit step returns fake PR URLs. Useful for a first exploration where you want to see what the agent finds before committing to PR'ing it.

---

## Step 7: Run the explore skill

Visit the site, copy the "Explore skill" text, paste into a fresh chat. Then ask:

```
Explore Photoshop for 30 minutes. Map any feature you can verify.
```

The agent calls `explore_start_session`, reads what's already in the registry (so it doesn't re-explore the seed), then probes the app for novel shortcuts. Verified findings save to the local session file as it goes. When wall-clock budget runs low, it batches verified findings into submission calls.

Resume works automatically: re-run the explore skill on the same app and the agent picks up where it left off, skipping previously-completed and previously-abandoned intents.

To start a session over from scratch, ask the agent to call `explore_start_session` with `reset: true`.

---

## Troubleshooting

### Permissions

**No keystrokes land in any app.** macOS Accessibility permission for System Events isn't granted. Open System Settings → Privacy & Security → Accessibility, ensure System Events is listed and toggled on.

**Keystrokes land in Claude Desktop instead of the target app.** The target app wasn't focused when the keystroke fired. Common cause: the seed skill's step that brings the app to the front (`os_action open_app`) didn't run, or the agent skipped it because `os_app_info` reported the app as already running. Tell the agent explicitly: "First call `os_action` with `{type: 'open_app', app_id: '<app>'}`, then run the shortcut."

**"Claude wants to control [App]" prompt appears repeatedly.** You're declining or it's not persisting. Open System Settings → Privacy & Security → Automation, find Claude, toggle the target app on.

### Tool discovery

**16 rosetta tools don't appear in the slash menu.** Three common causes:

1. Wrong path in `args`. Run `ls /full/path/to/Rosetta/mcp/dist/index.js` to confirm the file exists.
2. Built artifact is stale. From `Rosetta/mcp/`, run `npm run build`, then restart Claude Desktop.
3. JSON syntax error in `claude_desktop_config.json`. Validate with `cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python3 -m json.tool`. A missing comma or stray bracket breaks the whole file.

**MCP starts but errors immediately.** Check the MCP log (see Logs below).

### Submission and lookup

**Explore skill submission returns 401.** Your `ROSETTA_GITHUB_TOKEN` doesn't match any Contributor row in the backend. Either you didn't complete step 6 (no Contributor row exists), or your token was rotated since you logged in. Visit `/auth/github/token` again to fetch the current value.

**`/lookup` returns no shortcuts for an app you know is registered.** Check the `app_id` casing. The registry expects lowercase kebab-case (e.g., `photoshop`, `vscode`). Visit https://rosetta-production-e301.up.railway.app for the canonical list.

**"Unable to find application named X" on `os_action open_app`.** The registry's meta.json `display_name` doesn't match LaunchServices for that app. Rosetta uses bundle_id when present, which is version-stable, so this usually only hits apps where meta.json doesn't declare a bundle_id. File an issue or PR with the correct bundle_id.

### Screenshots and verify

**"Tool result is too large. Maximum size is 1MB" on `os_screenshot` or `verify`.** Should not happen after commit `e4e2fbf` (JPEG resize fix). If it does, your MCP build is stale. From `Rosetta/mcp/`, run `git pull && npm run build` and restart Claude Desktop.

**Verify always returns "agent_must_judge" and the agent doesn't seem to look at the image.** Expected for `interpret_check` verifications post-commit `c9bba4c`. The agent should be looking at the attached screenshot in the tool result and judging yes/no. If your client isn't multimodal, this won't work; switch to a vision-capable model.

### Logs

The MCP writes stderr to:

```
~/Library/Logs/Claude/mcp-server-rosetta.log
```

Tail it with:

```sh
tail -f ~/Library/Logs/Claude/mcp-server-rosetta.log
```

Useful when debugging tool calls, permission denials, or osascript errors. The log shows every JSON-RPC request and response with timestamps. Errors usually have an obvious "Failed to..." or "Permission denied..." line.

---

## What's next after install

- Try a few use-skill prompts to feel the flow.
- Run the explorer against an app you use daily. Even short 15-minute sessions surface ~5-10 useful new shortcuts.
- Read `docs/skills.md` to author a shortcut by hand.
- Read `docs/architecture.md` for the full system design.
- File issues at https://github.com/wesleyshe/Rosetta/issues. Most useful kinds: shortcuts that don't work on your specific app version, apps you want covered, schema gaps you ran into authoring a shortcut, install steps that broke for you on a fresh machine.
