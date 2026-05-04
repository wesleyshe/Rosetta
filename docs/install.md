# Install

How to get Rosetta running on your machine and use it from an MCP-capable AI client.

v0 supports macOS only. Windows and Linux land later (see CLAUDE.md change log for status). All commands below assume macOS.

---

## What you'll have at the end

Two ways to use Rosetta, two seed skills you paste into your AI client:

- **Use skill (no auth required).** Your agent looks up shortcuts in the registry and replays them deterministically. The fastest path to "let me see this work."
- **Explore skill (GitHub auth, with a v0 caveat — see below).** Your agent maps a new app within a wall-clock budget, drafts shortcut specs, and submits them back to the registry. This is how the registry grows.

You only need to install once; both skills work off the same MCP server.

---

## Requirements

- macOS 13 or newer.
- Node.js 18 or newer. Check with `node -v`.
- An MCP-capable AI client. Tested against Claude Desktop. Should work with Claude Code, Cursor, ChatGPT Desktop, and any client supporting the Model Context Protocol.
- For the explore skill submission flow: a GitHub account. Caveat in step 7.

---

## Step 1: Clone and build

The MCP isn't on npm yet (planned post-launch). v0 install is from source.

```sh
git clone https://github.com/wesleyshe/Rosetta.git
cd Rosetta/mcp
npm install
npm run build
```

`npm run build` produces `dist/index.js`. That file is what your AI client launches.

Note the absolute path. You'll need it in step 2:

```sh
pwd
# /Users/your-username/path/to/Rosetta/mcp
```

The path you want is the parent (`/Users/your-username/path/to/Rosetta`).

---

## Step 2: Configure your AI client

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`. If the file or its parent doesn't exist, create them.

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

Replace `/full/path/to/Rosetta` with your actual repo path.

`ROSETTA_REGISTRY_PATH` is read when the backend is unreachable; it's a fallback. `ROSETTA_BACKEND_URL` is the live registry. Both can stay set without conflict.

Restart Claude Desktop fully (Cmd+Q, then reopen). The 14 rosetta tools should appear in a new chat. Confirm via the slash menu (`/`) or by asking the agent to list its rosetta tools.

### Other clients

Claude Code, Cursor, etc. all support MCP via similar config. Refer to your client's docs and follow the same shape: `command: node`, `args: [path to dist/index.js]`, `env` block with the two variables above.

---

## Step 3: Grant macOS Accessibility permission

The first time the MCP fires a synthetic keystroke or queries the accessibility tree, macOS prompts for permission. Click "OK" once.

Under the hood, the MCP routes input through AppleScript / System Events, which already holds Accessibility entitlement on macOS. You're not granting permission to Node directly. See `docs/design-rationale.md` § "Why macOS action dispatch goes through AppleScript" for the technical context.

If you've previously denied permission and want to reset: System Settings → Privacy & Security → Accessibility, find System Events, toggle on.

---

## Step 4: Try the use skill (no auth)

Open a fresh chat in Claude Desktop.

Visit the live site at https://rosetta-production-e301.up.railway.app. Click the "Copy" button under "Use skill" to copy the seed skill text.

Paste it into the chat as your first message. The agent acknowledges. Now ask it to do something:

```
Open ~/Desktop/some-image.jpg in Photoshop.
```

The agent looks up the photoshop `open-file` shortcut, brings Photoshop forward, runs the keystrokes, verifies, and reports.

Tested intents (Photoshop seed):
- `Open <path> in Photoshop.`
- `In Photoshop, increase brightness by <N>.`
- `In Photoshop, undo.`
- `Convert the active document to grayscale in Photoshop.`

VS Code seed shortcuts also work (open file by name, command palette, format, toggle sidebar, run command, etc.).

---

## Step 5: Use the explore skill (with a v0 auth caveat)

The explore skill does two things:

1. Map an app's capabilities within a wall-clock time budget.
2. Submit verified shortcut specs back to the registry.

Step 1 needs no auth. Step 2 needs a Contributor row in the backend's Postgres, created by a GitHub OAuth login.

### v0 submission auth caveat

The submission flow has a rough edge in v0:

- The backend at `/auth/github/login` runs an OAuth App flow, gets a GitHub token, hashes it (sha256), and stores the hash in the `Contributor` table.
- The backend's `/submit` endpoint matches incoming bearer tokens against `Contributor.oauth_token_hash`.
- The MCP reads its bearer token from `ROSETTA_GITHUB_TOKEN` env var (or an explicit `contributor_token` param).
- There is no clean v0 path for the OAuth-flow token to reach the MCP's env. The httpOnly cookie blocks browser-side reading; we haven't built a user-facing "copy your token" page yet.

Two practical workarounds for v0 exploration:

**Option A: dry-run submissions.** Run the explorer with `ROSETTA_BACKEND_URL` temporarily unset (comment it out of the MCP env). The MCP submits in dry-run mode, returning fake PR URLs. Findings still save to the local session file at `~/Library/Application Support/rosetta-mcp/sessions/{app_id}.json`. You can review the findings later and PR them by hand if any are worth landing.

**Option B: real submission via manual cookie extraction.** Visit `https://rosetta-production-e301.up.railway.app/auth/github/login` in a browser. Complete the OAuth flow. Open browser dev tools, find the `rosetta_token` cookie, copy its value. Set it as `ROSETTA_GITHUB_TOKEN` in your Claude Desktop config's rosetta env block. Restart Claude Desktop. Submissions now land for real.

Option B is awkward and not the long-term answer. Tracked as a launch follow-up.

### Run the explore skill

Visit the live site, copy the "Explore skill" text, paste into a fresh chat. Then ask:

```
Explore Photoshop for 30 minutes. Map any feature you can verify.
```

The agent calls `explore_start_session`, fetches what's already mapped, then probes the app, drafts shortcut specs, runs each one to verify, and saves findings. When budget runs low, it batches verified findings into submission calls.

Resume works: re-run the explore skill on the same app and the agent picks up where it left off (skipping completed and abandoned intents).

---

## Step 6: Troubleshooting

**"Tool result is too large. Maximum size is 1MB" error.** Should not occur on the use path after the verify(interpret_check) refactor (commit `c9bba4c`). If it does, you're on a stale build. Re-run `npm run build` from `mcp/` and restart Claude Desktop.

**Keystrokes don't land in the target app.** Most common cause: the target app isn't focused. The seed skill calls `os_action open_app` to bring it forward; if it's still not landing, verify your meta.json entry has a correct `bundle_id` for macOS. The MCP uses `open -b <bundle_id>` which is version-stable across app updates.

**"Unable to find application named X."** Bundle name doesn't match LaunchServices. The fix is in the registry's meta.json, not your config. File an issue or PR with the correct bundle_id.

**14 rosetta tools don't appear in Claude Desktop.** Path in `args` is wrong, or `dist/index.js` doesn't exist (missed `npm run build`). Check Claude Desktop's MCP logs (Settings → Developer in newer builds).

**Explore skill submission returns 401.** Bearer token doesn't match any Contributor row. See "v0 submission auth caveat" above for the workaround.

---

## What's next after install

- Try a few use-skill prompts to feel the flow.
- Run the explorer against an app you use daily (Photoshop, Excel, Figma). Even with the v0 submission caveat, dry-run findings are useful.
- Read `docs/skills.md` if you want to author a shortcut by hand.
- Read `docs/architecture.md` for the full design.
- File issues at https://github.com/wesleyshe/Rosetta/issues for shortcuts that don't work, apps you want covered, or v0 rough edges (the explore submission auth is the biggest one we know about).
