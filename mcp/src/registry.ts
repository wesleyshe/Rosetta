// Registry tools: list_apps + lookup, dual-mode (hosted backend OR local
// registry/ checkout) per Phase 3 decision B.
//
// Local mode returns cold_start: true on every shortcut and null stats —
// there's no telemetry source available locally. Phase 6a / 6b populate
// real stats via the Railway backend's /lookup endpoint.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { backendUrl, localRegistryPath } from "./config.js";

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
