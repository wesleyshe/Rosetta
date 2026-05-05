#!/usr/bin/env node
// rosetta-mcp entry point.
//
// Fourteen tools, all wired in:
//   Registry:          registry_list_apps, registry_lookup,
//                      registry_report_execution, registry_submit
//   App detection:     os_app_info
//   Computer control:  os_screenshot, os_action, os_read_ax_tree
//   Verification:      verify, interpret
//   Explore session:   explore_start_session, explore_save_finding,
//                      explore_budget_status, explore_submit_findings
//
// Naming: docs and seed skills refer to these as registry.list_apps, os.action,
// explore.start_session, etc. (with dots). MCP clients vary in tolerance for dots
// in tool identifiers, so we use snake_case on the wire. Tool descriptions
// reference the dotted form for readability — agents match by description.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { listApps, lookup, reportExecution, submitSpec } from "./registry.js";
import {
  appInfo,
  screenshot,
  action as osAction,
  readAxTree,
  type ActionSpec,
  type AxQuery,
  type AxRule,
  type ScreenshotRegion,
} from "./os.js";
import { verify, type VerificationSpec, type VerifyOptions } from "./verify.js";
import { interpret, type InterpretInput } from "./interpret.js";
import {
  startSession,
  saveFinding,
  budgetStatus,
  submitFindings,
  type FindingStatus,
} from "./explore.js";
import { loadOrCreateInstallId } from "./config.js";

// Eagerly establish install_id (creates config dir on first launch).
const installRecord = loadOrCreateInstallId();

const server = new Server(
  { name: "rosetta", version: "0.0.1" },
  { capabilities: { tools: {} } }
);

const tools = [
  // ---------- registry ----------
  {
    name: "registry_list_apps",
    description:
      "List apps in the Rosetta skill registry. Returns id, display name, supported platforms, tracked versions, skill count, and last-updated timestamp for each registered app. (Conceptually `registry.list_apps`.)",
    inputSchema: {
      type: "object" as const,
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "registry_lookup",
    description:
      "Look up shortcuts in the Rosetta registry that match an intent for a given app. Returns a ranked array of shortcuts. When ROSETTA_BACKEND_URL is set, ranking uses live ShortcutStats (reliability_score, use_count) merged into each row; in local-fallback mode every shortcut is `cold_start: true` with null stats and ranking falls back to token-overlap on intent then `token_cost_estimate` ascending. (Conceptually `registry.lookup`.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_id: {
          type: "string",
          description: 'App identifier (e.g. "vscode"). Must match a folder under registry/apps/.',
        },
        intent: {
          type: "string",
          description: 'Plain-language intent. Pass "*" or empty string to fetch all shortcuts for the app.',
        },
        platform: {
          type: "string",
          enum: ["macos", "windows", "linux"],
          description: "Optional. Filter to shortcuts that support this platform.",
        },
        app_version: {
          type: "string",
          description: 'Optional. Filter to shortcuts whose `app_versions` cover this version (e.g. "1.85"). v0 supports exact match and "X+" suffix.',
        },
      },
      required: ["app_id", "intent"],
      additionalProperties: false,
    },
  },

  {
    name: "registry_submit",
    description:
      "Submit a single shortcut spec to the registry. Real backend POST when ROSETTA_BACKEND_URL is set (the backend runs the prompt-injection reviewer and auto-merges a PR via the contributor's GitHub OAuth token); DRY-RUN when unset (returns `https://github.com/wesleyshe/Rosetta/pull/dryrun-{cuid}` URLs). Returns `{pr_url, commit_sha, dry_run}`. The contributor's GitHub OAuth token is read from `ROSETTA_GITHUB_TOKEN` by default; pass `contributor_token` explicitly if your flow has it in-hand. (Conceptually `registry.submit`.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_id: { type: "string", description: 'App identifier (e.g. "vscode"). Must match an existing folder under registry/apps/ — new-app submissions are out of scope for v0.' },
        shortcut_spec: {
          type: "object",
          description: "Full shortcut spec (matches registry/schemas/shortcut.schema.json). Must include `id`.",
          additionalProperties: true,
        },
        contributor_token: {
          type: "string",
          description: "Optional. GitHub OAuth token for the submitting contributor. If absent, falls back to ROSETTA_GITHUB_TOKEN env.",
        },
      },
      required: ["app_id", "shortcut_spec"],
      additionalProperties: false,
    },
  },
  {
    name: "registry_report_execution",
    description:
      "Report a single shortcut-execution outcome (success or failure) for telemetry. When ROSETTA_BACKEND_URL is set, POSTs to <url>/report-execution; otherwise runs in DRY-RUN mode (logs the event payload to stderr, returns {ok:true, dry_run:true}). The use seed skill calls this immediately after every verify(...) call, regardless of outcome — it is the feedback loop that drives reliability_score in the live registry. (Conceptually `registry.report_execution`.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        shortcut_id: { type: "string", description: "Stable shortcut id from the registry." },
        app_id: { type: "string", description: 'App identifier (e.g. "vscode").' },
        success: { type: "boolean", description: "True if verify() passed; false otherwise." },
        error_class: {
          type: "string",
          description: "On failure: the verify() result's error_class (e.g. ax_query_failed, interpret_mismatch).",
        },
        app_version: { type: "string", description: "App version observed during execution." },
        platform: {
          type: "string",
          enum: ["macos", "windows", "linux"],
          description: "Optional. Defaults to the host platform.",
        },
      },
      required: ["shortcut_id", "app_id", "success", "app_version"],
      additionalProperties: false,
    },
  },

  // ---------- os ----------
  {
    name: "os_app_info",
    description:
      "Detect whether an app is installed on this machine. Reads the registry's per-app `detection` block and probes the local OS. macOS is fully implemented; Windows and Linux return `installed: false` with `error: \"... not yet implemented\"`. (Conceptually `os.app_info`.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_name: {
          type: "string",
          description: 'App identifier ("vscode") or display name ("Visual Studio Code"). Resolved against registry/apps/{id}/meta.json.',
        },
      },
      required: ["app_name"],
      additionalProperties: false,
    },
  },
  {
    name: "os_screenshot",
    description:
      "Capture a screenshot of the full screen, an explicit rectangle, or the frontmost app's frontmost window. Returns a text block with `{path, bytes, region?, format}` AND a separate MCP image content block carrying the actual image bytes via the multimodal channel — the agent sees the image directly with its native vision (no base64 in JSON). `region` accepts an explicit `{x, y, width, height}` rect OR the string `\"frontmost_window\"` (resolved via osascript at capture time; falls through to full-screen if the frontmost app has no windows). Supports `format: \"jpg\"` (default, smaller) or `format: \"png\"` (use for pixel-stable comparisons such as screenshot_diff verification). macOS only in v0 (uses `screencapture`); Windows/Linux throw. (Conceptually `os.screenshot`.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        region: {
          oneOf: [
            {
              type: "object",
              description: "Explicit rectangle in logical pixels.",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
              },
              required: ["x", "y", "width", "height"],
              additionalProperties: false,
            },
            {
              type: "string",
              const: "frontmost_window",
              description: "Capture the frontmost app's frontmost window. Resolved via osascript at capture time. If the app has no windows, falls through to full-screen capture.",
            },
          ],
        },
        format: {
          type: "string",
          enum: ["png", "jpg"],
          description: "Image format. Default jpg (smaller). Use png for pixel-stable comparisons (screenshot_diff verification).",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "os_action",
    description:
      "Perform a single OS-level input action: key, key_combo, type_text, click, menu, or open_app. Discriminated by `type`. macOS is fully implemented via osascript / System Events; Windows/Linux throw. Coordinate `click` is AX-mediated (works in apps with clean accessibility trees, may fail silently on opaque surfaces like Photoshop's canvas interior). (Conceptually `os.action`.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["key", "key_combo", "type_text", "click", "menu", "open_app"],
          description: "Action variant.",
        },
        key: { type: "string", description: 'For type=key: e.g. "Enter", "Cmd+S".' },
        keys: {
          description:
            'For type=key_combo: a string ("Cmd+Shift+P") or a per-platform map {macos?, windows?, linux?}.',
        },
        text: { type: "string", description: "For type=type_text: literal text to type." },
        target: {
          description: 'For type=click: either {x, y} screen coords or {ax_path: "..."}.',
        },
        path: {
          type: "array",
          items: { type: "string" },
          description: 'For type=menu: menu path, e.g. ["File", "Save"].',
        },
        app_id: { type: "string", description: 'For type=open_app: registry app id (e.g. "vscode").' },
        platform_specific: {
          type: "boolean",
          description: "For type=open_app: when true, defer to the platform-specific launcher path in meta.json.",
        },
      },
      required: ["type"],
      additionalProperties: false,
    },
  },
  {
    name: "os_read_ax_tree",
    description:
      "Query the OS accessibility tree for a single named rule (e.g. `active_editor_filename`). Returns either {ok:true, value, ...} or {ok:false, error}. v0 implements `active_editor_filename` on macOS only; other rules return `ax_rule_not_implemented_in_v0` and the agent should fall back to `interpret`. (Conceptually `os.read_ax_tree`.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        rule: {
          type: "string",
          enum: [
            "active_editor_filename",
            "command_palette_visible",
            "sidebar_visible",
            "terminal_panel_visible",
            "rename_widget_visible",
          ],
          description: "Named rule to evaluate.",
        },
        app_id: {
          type: "string",
          description: "Optional. Query the named app's process instead of the frontmost.",
        },
      },
      required: ["rule"],
      additionalProperties: false,
    },
  },

  // ---------- verify ----------
  {
    name: "verify",
    description:
      "Run a single verification spec (one of: ax_tree_assertion, dom_assertion, screenshot_diff, file_check, value_compare, interpret_check, wait_for_idle). Returns `{passed, error_class?, observation?, message?}`. Stateful AX rules (names ending _toggled or _changed) and screenshot_diff require `options.observation.before` captured before the action ran. `interpret_check` verifications return `passed: null` with `error_class: \"agent_must_judge\"` and an attached screenshot image — the agent should look at the image, judge yes/no based on the question, and report success/failure to `registry_report_execution` accordingly (use `error_class: \"interpret_mismatch\"` on no).",
    inputSchema: {
      type: "object" as const,
      properties: {
        spec: {
          type: "object",
          description:
            "Verification spec. Required `type` discriminates the variant. See docs/architecture.md for per-type fields.",
          properties: {
            type: {
              type: "string",
              enum: [
                "ax_tree_assertion",
                "dom_assertion",
                "screenshot_diff",
                "file_check",
                "value_compare",
                "interpret_check",
              ],
            },
          },
          required: ["type"],
        },
        options: {
          type: "object",
          properties: {
            parameters: {
              type: "object",
              description: "Substituted into string fields with {name} placeholders.",
              additionalProperties: true,
            },
            observation: {
              type: "object",
              properties: { before: {} },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
      required: ["spec"],
      additionalProperties: false,
    },
  },
  {
    name: "interpret",
    description:
      "Pass an image (and a question) to a vision model and return the model's natural-language answer. Niche escape hatch — the use seed skill no longer routes through this tool (verify(interpret_check) attaches the screenshot directly for the agent's own vision in v0). Pass either `image_base64` (inline bytes) or `image_path` (server-side file read); media type auto-detected from magic bytes (PNG vs JPEG). v0 implements Anthropic only (default model `claude-haiku-4-5`); openai and gemini throw `provider_not_implemented`. Provider/model overridable via env (ROSETTA_INTERPRET_PROVIDER, ROSETTA_INTERPRET_MODEL).",
    inputSchema: {
      type: "object" as const,
      properties: {
        image_base64: { type: "string", description: "Base64-encoded image bytes (PNG or JPEG). Mutually exclusive with image_path." },
        image_path: { type: "string", description: "Filesystem path to an image. Read server-side. Mutually exclusive with image_base64." },
        audio_base64: { type: "string", description: "Reserved for future audio-question support. Currently rejected." },
        question: { type: "string", description: "Natural-language question to ask about the media." },
        model: { type: "string", description: "Optional override for the provider's default model." },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },

  // ---------- explore ----------
  {
    name: "explore_start_session",
    description:
      "Start (or resume) an explore session for an app. Sessions are persisted to <config_dir>/sessions/{app_id}.json. Returns `{resumed, app_id, session_path, previously_completed_intents, previously_abandoned_intents, findings_count, budget, started_at}`. If a session file exists for the app, resumes it (preserving started_at); pass `reset:true` to overwrite. (Conceptually `explore.start_session`.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_id: { type: "string", description: 'App identifier (e.g. "vscode").' },
        budget_minutes: {
          type: "number",
          description: "Optional. Total wall-clock budget for the session. Default 30.",
        },
        submission_reserve_minutes: {
          type: "number",
          description:
            "Optional. Stop discovering when remaining minutes drops to this; reserved for submission. Default 5.",
        },
        reset: {
          type: "boolean",
          description: "Optional. If true, ignore any existing session file and start fresh.",
        },
      },
      required: ["app_id"],
      additionalProperties: false,
    },
  },
  {
    name: "explore_save_finding",
    description:
      "Save a single finding (a candidate shortcut) to the active session. Idempotent on `shortcut_spec.id` — re-saving the same id updates in place. Auto-maintains `completed_intents` (when status=verified) and `abandoned_intents` (when status=rejected_by_self). Returns `{saved, shortcut_id, status, findings_count, updated_in_place}`. (Conceptually `explore.save_finding`.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        shortcut_spec: {
          type: "object",
          description:
            "Full shortcut spec object (matches registry/schemas/shortcut.schema.json). Must include `id` and ideally `intent`.",
          additionalProperties: true,
        },
        status: {
          type: "string",
          enum: ["drafted", "verified", "rejected_by_self"],
          description: "Lifecycle status. Only `verified` findings get submitted.",
        },
        verification_log: {
          type: "array",
          items: { type: "string" },
          description: "Optional. Lines from the verification run; first line used as abandonment reason on rejection.",
        },
      },
      required: ["shortcut_spec", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "explore_budget_status",
    description:
      "Report the active session's wall-clock budget. Returns `{app_id, started_at, duration_minutes, submission_reserve_minutes, minutes_used, minutes_remaining, should_stop_discovering}`. Agent should stop discovering and start submitting when `should_stop_discovering` is true. (Conceptually `explore.budget_status`.)",
    inputSchema: {
      type: "object" as const,
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "explore_submit_findings",
    description:
      "Submit all verified, unsubmitted findings for an app. Calls the backend `/submit` endpoint when `ROSETTA_BACKEND_URL` is set; otherwise runs in DRY-RUN mode and returns fake URLs of the form `.../pull/dryrun-{cuid}`. Returns `{app_id, attempted_count, submitted_count, results, dry_run}`. (Conceptually `explore.submit_findings`.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_id: { type: "string" },
      },
      required: ["app_id"],
      additionalProperties: false,
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;
  try {
    let result: unknown;
    switch (name) {
      case "registry_list_apps": {
        result = { apps: await listApps() };
        break;
      }
      case "registry_lookup": {
        const app_id = String(args.app_id ?? "");
        const intent = String(args.intent ?? "");
        const platform = typeof args.platform === "string" ? args.platform : undefined;
        const app_version = typeof args.app_version === "string" ? args.app_version : undefined;
        if (!app_id) throw new Error("registry_lookup: app_id is required");
        const shortcuts = await lookup(app_id, intent, platform, app_version);
        result = { shortcuts };
        break;
      }
      case "registry_submit": {
        result = await submitSpec({
          app_id: String(args.app_id ?? ""),
          shortcut_spec: (args.shortcut_spec ?? {}) as Record<string, unknown>,
          contributor_token: typeof args.contributor_token === "string" ? args.contributor_token : undefined,
        });
        break;
      }
      case "registry_report_execution": {
        result = await reportExecution({
          shortcut_id: String(args.shortcut_id ?? ""),
          app_id: String(args.app_id ?? ""),
          success: Boolean(args.success),
          error_class: typeof args.error_class === "string" ? args.error_class : undefined,
          app_version: String(args.app_version ?? ""),
          platform:
            args.platform === "macos" || args.platform === "windows" || args.platform === "linux"
              ? args.platform
              : undefined,
        });
        break;
      }
      case "os_app_info": {
        const app_name = String(args.app_name ?? "");
        if (!app_name) throw new Error("os_app_info: app_name is required");
        result = await appInfo(app_name);
        break;
      }
      case "os_screenshot": {
        const region = args.region as ScreenshotRegion | "frontmost_window" | undefined;
        const format = args.format === "png" ? "png" : "jpg";
        const shot = await screenshot({ region, format });
        const { base64, ...metadata } = shot;
        return {
          content: [
            { type: "text", text: JSON.stringify(metadata, null, 2) },
            {
              type: "image",
              data: base64,
              mimeType: format === "png" ? "image/png" : "image/jpeg",
            },
          ],
        };
      }
      case "os_action": {
        result = await osAction(args as unknown as ActionSpec);
        break;
      }
      case "os_read_ax_tree": {
        const rule = args.rule as AxRule | undefined;
        if (!rule) throw new Error("os_read_ax_tree: rule is required");
        const query: AxQuery = { rule };
        if (typeof args.app_id === "string") query.app_id = args.app_id;
        result = await readAxTree(query);
        break;
      }
      case "verify": {
        const spec = args.spec as VerificationSpec | undefined;
        if (!spec || typeof spec !== "object") throw new Error("verify: spec is required");
        const options = (args.options ?? {}) as VerifyOptions;
        const verifyResult = await verify(spec, options);
        if (verifyResult._image_content) {
          const { _image_content, ...rest } = verifyResult;
          return {
            content: [
              { type: "text", text: JSON.stringify(rest, null, 2) },
              { type: "image", data: _image_content.data, mimeType: _image_content.mimeType },
            ],
          };
        }
        result = verifyResult;
        break;
      }
      case "interpret": {
        result = await interpret(args as unknown as InterpretInput);
        break;
      }
      case "explore_start_session": {
        result = startSession({
          app_id: String(args.app_id ?? ""),
          budget_minutes: typeof args.budget_minutes === "number" ? args.budget_minutes : undefined,
          submission_reserve_minutes:
            typeof args.submission_reserve_minutes === "number" ? args.submission_reserve_minutes : undefined,
          reset: typeof args.reset === "boolean" ? args.reset : undefined,
        });
        break;
      }
      case "explore_save_finding": {
        const status = args.status as FindingStatus | undefined;
        if (!status) throw new Error("explore_save_finding: status is required");
        result = saveFinding({
          shortcut_spec: (args.shortcut_spec ?? {}) as Record<string, unknown>,
          status,
          verification_log: Array.isArray(args.verification_log)
            ? (args.verification_log as string[])
            : undefined,
        });
        break;
      }
      case "explore_budget_status": {
        result = budgetStatus();
        break;
      }
      case "explore_submit_findings": {
        result = await submitFindings({ app_id: String(args.app_id ?? "") });
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (e) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: (e as Error).message }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

// stdout is reserved for MCP protocol; log to stderr.
process.stderr.write(
  `rosetta-mcp ready. install_id=${installRecord.install_id}\n`
);
