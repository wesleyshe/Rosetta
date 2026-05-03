#!/usr/bin/env node
// rosetta-mcp Phase 3 entry point.
//
// Exposes exactly three tools:
//   - registry_list_apps
//   - registry_lookup
//   - os_app_info
//
// Note on naming: docs/architecture.md and the seed-skill text refer to
// these conceptually as `registry.list_apps`, `registry.lookup`, and
// `os.app_info` (with dots). MCP clients vary in tolerance for dots in tool
// identifiers; underscore form is the safer cross-client choice. The agent's
// chat client reads the tool list at session start and matches by description,
// so the dotted mentions in the seed skill remain readable.
//
// report_execution / explore.* / verify / screenshot / action / ax_tree /
// interpret are deferred to Phase 4 / 6b per Phase 3 decision E. Don't
// pre-implement.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { listApps, lookup } from "./registry.js";
import { appInfo } from "./os.js";
import { loadOrCreateInstallId } from "./config.js";

// Eagerly establish install_id (creates config dir on first launch).
const installRecord = loadOrCreateInstallId();

const server = new Server(
  { name: "rosetta", version: "0.0.1" },
  { capabilities: { tools: {} } }
);

const tools = [
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
      "Look up shortcuts in the Rosetta registry that match an intent for a given app. Returns a ranked array of shortcuts. In Phase 3 (no backend wired) all results carry `cold_start: true` and null stats; ranking falls back to token-overlap on intent and `token_cost_estimate` ascending. (Conceptually `registry.lookup`.)",
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
    name: "os_app_info",
    description:
      "Detect whether an app is installed on this machine. Reads the registry's per-app `detection` block and probes the local OS. macOS is fully implemented in Phase 3; Windows and Linux return `installed: false` with `error: \"... not yet implemented (Phase 4)\"`. (Conceptually `os.app_info`.)",
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
      case "os_app_info": {
        const app_name = String(args.app_name ?? "");
        if (!app_name) throw new Error("os_app_info: app_name is required");
        result = await appInfo(app_name);
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
