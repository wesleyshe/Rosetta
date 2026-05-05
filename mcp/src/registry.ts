// Registry tools: list_apps + lookup, dual-mode (hosted backend or local
// registry/ checkout). The hosted backend's /lookup endpoint joins specs
// with live ShortcutStats; local mode returns cold_start: true on every
// shortcut with null stats since there's no telemetry source on disk.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { backendUrl, currentPlatform, loadOrCreateInstallId, localRegistryPath } from "./config.js";

// ---------- types ----------

export interface AppIndexEntry {
  id: string;
  display_name: string;
  platforms: string[];
  tracked_versions: string[];
  skill_count: number;
  last_updated: string;
}

interface RegistryIndex {
  schema_version: number;
  apps: AppIndexEntry[];
}

export interface ShortcutMetadata {
  contributor_id: string;
  payment_destination: string | null;
  token_cost_estimate: number;
  speed_estimate_ms: number;
  submitted_at: string;
}

export interface Shortcut {
  id: string;
  intent: string;
  parameters: unknown[];
  platforms: string[];
  app_versions: string[];
  method: string;
  actions: unknown[];
  verification: unknown;
  risk?: string;
  metadata: ShortcutMetadata;
}

export interface ShortcutStats {
  use_count: number | null;
  success_rate: number | null;
  reliability_score: number | null;
  last_validated: string | null;
}

export interface ShortcutWithStats extends Shortcut {
  stats: ShortcutStats;
  cold_start: boolean;
}

interface ShortcutsFile {
  schema_version: number;
  app_id: string;
  shortcuts: Shortcut[];
}

// ---------- public API ----------

export async function listApps(): Promise<AppIndexEntry[]> {
  const url = backendUrl();
  if (url) {
    const r = await fetch(`${url}/apps`);
    if (!r.ok) {
      throw new Error(`registry.list_apps: backend ${url}/apps returned HTTP ${r.status}`);
    }
    const data = (await r.json()) as { apps: AppIndexEntry[] };
    return data.apps;
  }
  const root = localRegistryPath();
  const index = JSON.parse(readFileSync(join(root, "index.json"), "utf8")) as RegistryIndex;
  return index.apps;
}

export async function lookup(
  app_id: string,
  intent: string,
  platform?: string,
  app_version?: string
): Promise<ShortcutWithStats[]> {
  const url = backendUrl();
  if (url) {
    const params = new URLSearchParams({ app_id, intent });
    if (platform) params.set("platform", platform);
    if (app_version) params.set("app_version", app_version);
    const r = await fetch(`${url}/lookup?${params.toString()}`);
    if (!r.ok) {
      throw new Error(`registry.lookup: backend ${url}/lookup returned HTTP ${r.status}`);
    }
    const data = (await r.json()) as { shortcuts: ShortcutWithStats[] };
    return data.shortcuts;
  }
  return localLookup(app_id, intent, platform, app_version);
}

// ---------- local-mode implementation ----------

/** Highest registry schema major version this MCP build understands. Bump
 *  when introducing breaking changes (parking-lot 13). The MCP refuses to
 *  load shortcuts with schema_version above this and asks the user to
 *  upgrade, rather than mis-executing under an old interpretation. */
const SUPPORTED_SCHEMA_VERSION = 1;

const STOPWORDS = new Set([
  "a", "an", "the", "to", "of", "for", "in", "on", "at", "by",
  "and", "or", "with", "is", "this", "that", "be", "as", "it"
]);

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t))
  );
}

/**
 * Permissive version-range match. v0 supports:
 *   - exact equality
 *   - "X+" suffix in the spec, where the user's version starts with X or is
 *     numerically ≥ X (split-on-dot integer compare)
 * Anything more complex returns false. Document the limitation in skills.md
 * if/when contributors hit it.
 */
function versionMatches(spec: string, requested: string): boolean {
  if (spec === requested) return true;
  if (spec.endsWith("+")) {
    const prefix = spec.slice(0, -1);
    if (requested.startsWith(prefix)) return true;
    if (versionGte(requested, prefix)) return true;
  }
  return false;
}

function versionGte(a: string, b: string): boolean {
  const ap = a.split(".").map((p) => parseInt(p, 10));
  const bp = b.split(".").map((p) => parseInt(p, 10));
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i++) {
    const x = ap[i] ?? 0;
    const y = bp[i] ?? 0;
    if (Number.isNaN(x) || Number.isNaN(y)) return false;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true; // equal
}

function localLookup(
  app_id: string,
  intent: string,
  platform?: string,
  app_version?: string
): ShortcutWithStats[] {
  const root = localRegistryPath();
  let file: ShortcutsFile;
  try {
    file = JSON.parse(
      readFileSync(join(root, "apps", app_id, "shortcuts.json"), "utf8")
    ) as ShortcutsFile;
  } catch (e) {
    throw new Error(
      `registry.lookup: cannot read shortcuts for app "${app_id}" at ${root}/apps/${app_id}/shortcuts.json: ${(e as Error).message}`
    );
  }

  if (typeof file.schema_version !== "number" || file.schema_version > SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `registry.lookup: shortcuts.json for "${app_id}" declares schema_version ${file.schema_version}, ` +
        `but this MCP build only understands up to schema_version ${SUPPORTED_SCHEMA_VERSION}. ` +
        `Upgrade the MCP (rebuild from source: cd mcp && git pull && npm install && npm run build) ` +
        `or pin to an older registry checkout.`
    );
  }

  let candidates = file.shortcuts;

  if (platform) {
    candidates = candidates.filter((s) => s.platforms.includes(platform));
  }
  if (app_version) {
    candidates = candidates.filter((s) =>
      s.app_versions.some((v) => versionMatches(v, app_version))
    );
  }

  const wildcard = intent === "*" || intent.trim().length === 0;
  const queryTokens = wildcard ? null : tokenize(intent);

  const ranked = candidates
    .map((s) => {
      let score = 1;
      if (queryTokens) {
        if (queryTokens.size === 0) {
          score = 0;
        } else {
          const intentTokens = tokenize(s.intent);
          let matches = 0;
          for (const t of queryTokens) if (intentTokens.has(t)) matches++;
          score = matches / queryTokens.size;
        }
      }
      return { s, score };
    })
    .filter(({ score }) => wildcard || score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.s.metadata.token_cost_estimate - b.s.metadata.token_cost_estimate;
    })
    .map(({ s }) => withColdStart(s));

  return ranked;
}

function withColdStart(s: Shortcut): ShortcutWithStats {
  return {
    ...s,
    stats: {
      use_count: null,
      success_rate: null,
      reliability_score: null,
      last_validated: null,
    },
    cold_start: true,
  };
}

// ---------- report_execution (Phase 5 stub; Phase 6b wires Postgres) ----------

export interface ReportExecutionInput {
  shortcut_id: string;
  app_id: string;
  success: boolean;
  error_class?: string;
  app_version: string;
  /** Optional override; defaults to currentPlatform(). */
  platform?: "macos" | "windows" | "linux";
}

export interface ReportExecutionOutput {
  ok: boolean;
  /** True when ROSETTA_BACKEND_URL is unset and the call ran in dry-run mode. */
  dry_run: boolean;
}

export async function reportExecution(
  input: ReportExecutionInput
): Promise<ReportExecutionOutput> {
  if (!input.shortcut_id) throw new Error("registry.report_execution: shortcut_id is required");
  if (!input.app_id) throw new Error("registry.report_execution: app_id is required");
  if (typeof input.success !== "boolean") {
    throw new Error("registry.report_execution: success must be a boolean");
  }
  if (!input.app_version) throw new Error("registry.report_execution: app_version is required");

  const event = {
    shortcut_id: input.shortcut_id,
    app_id: input.app_id,
    install_id: loadOrCreateInstallId().install_id,
    success: input.success,
    error_class: input.error_class,
    app_version: input.app_version,
    platform: input.platform ?? currentPlatform(),
    timestamp: new Date().toISOString(),
  };

  const url = backendUrl();
  if (url) {
    const r = await fetch(`${url}/report-execution`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!r.ok) {
      throw new Error(
        `backend POST ${url}/report-execution returned HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`
      );
    }
    return { ok: true, dry_run: false };
  }

  process.stderr.write(
    `\n[rosetta-mcp DRY RUN] registry.report_execution: ROSETTA_BACKEND_URL is unset. ` +
      `Event: ${JSON.stringify(event)}\n`
  );
  return { ok: true, dry_run: true };
}

// ---------- submit (Phase 6a) ----------
//
// Shared submitter used by the registry_submit MCP tool AND by
// explore.submit_findings. Real backend POST when ROSETTA_BACKEND_URL is
// set, dry-run fallback otherwise (matches the report_execution stub
// shape so the rest of the agent doesn't have to special-case offline
// mode).
//
// Auth: when calling the real backend, the contributor's GitHub OAuth
// token must be passed via ROSETTA_GITHUB_TOKEN (or via the input param
// for explore-skill flows that have it in-hand). The backend verifies
// the token's sha256 matches a Contributor row.

import { randomBytes } from "node:crypto";

export interface SubmitInput {
  app_id: string;
  shortcut_spec: Record<string, unknown>;
  /** Optional override; otherwise read from ROSETTA_GITHUB_TOKEN. */
  contributor_token?: string;
}

export interface SubmitOutput {
  pr_url: string;
  commit_sha: string | null;
  /** True when ROSETTA_BACKEND_URL is unset and submission ran in dry-run mode. */
  dry_run: boolean;
}

export async function submitSpec(input: SubmitInput): Promise<SubmitOutput> {
  if (!input.app_id) throw new Error("registry.submit: app_id is required");
  if (!input.shortcut_spec || typeof input.shortcut_spec !== "object") {
    throw new Error("registry.submit: shortcut_spec must be an object");
  }
  const sid = input.shortcut_spec.id;
  if (typeof sid !== "string" || sid.length === 0) {
    throw new Error("registry.submit: shortcut_spec.id is required");
  }

  const url = backendUrl();
  if (url) {
    const token = input.contributor_token ?? process.env.ROSETTA_GITHUB_TOKEN;
    if (!token) {
      throw new Error(
        "registry.submit: ROSETTA_GITHUB_TOKEN is required when ROSETTA_BACKEND_URL is set " +
          "(or pass contributor_token in the call)"
      );
    }
    const r = await fetch(`${url}/submit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ app_id: input.app_id, shortcut_spec: input.shortcut_spec }),
    });
    if (!r.ok) {
      const text = (await r.text()).slice(0, 500);
      throw new Error(`backend POST ${url}/submit returned HTTP ${r.status}: ${text}`);
    }
    const data = (await r.json()) as { pr_url?: string; commit_sha?: string | null };
    if (!data.pr_url) throw new Error("backend response missing pr_url");
    return { pr_url: data.pr_url, commit_sha: data.commit_sha ?? null, dry_run: false };
  }

  // Dry-run mode (kickoff decision G from Phase 4).
  const cuid = randomBytes(8).toString("hex");
  const fakeUrl = `https://github.com/wesleyshe/Rosetta/pull/dryrun-${cuid}`;
  const intent = typeof input.shortcut_spec.intent === "string" ? input.shortcut_spec.intent : "?";
  process.stderr.write(
    `\n[rosetta-mcp DRY RUN] registry.submit: ROSETTA_BACKEND_URL is unset. ` +
      `Skipping real submission for shortcut "${sid}" (app: "${input.app_id}", intent: "${intent}"). ` +
      `Returning fake PR URL: ${fakeUrl}\n`
  );
  return { pr_url: fakeUrl, commit_sha: null, dry_run: true };
}
