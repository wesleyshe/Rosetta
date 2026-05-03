// GET /lookup — agent-facing endpoint that joins specs (on disk) with
// live ShortcutStats from Postgres. Phase 6b ranking per kickoff
// decision E:
//
//   non-cold-start group: reliability_score desc, then token_cost_estimate
//                          asc, then speed_estimate_ms asc
//   cold-start group:     token_cost_estimate asc only (no stats to use)
//   non-cold-start always sorts before cold-start
//   if no non-cold-start matches, return cold-start group as the result
//
// Token-overlap matching mirrors mcp/src/registry.ts so local-mode and
// hosted-mode behave the same. Wildcard "*" or empty intent → no
// scoring, returns all platform/version-compatible shortcuts.
//
// /lookup returns shortcuts only (decision I). workflow.json is served
// as a static asset under /registry/apps/{app_id}/workflow.json.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";

import { getPrisma } from "../db.js";
import { appDir } from "../paths.js";
import { minSamplesForScore } from "../stats.js";

const STOPWORDS = new Set([
  "a", "an", "the", "to", "of", "for", "in", "on", "at", "by",
  "and", "or", "with", "is", "this", "that", "be", "as", "it",
]);

interface ShortcutMetadata {
  contributor_id: string;
  payment_destination: string | null;
  token_cost_estimate: number;
  speed_estimate_ms: number;
  submitted_at: string;
}

interface ShortcutSpec {
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

interface ShortcutsFile {
  schema_version: number;
  app_id: string;
  shortcuts: ShortcutSpec[];
}

interface LookupQuery {
  app_id?: string;
  intent?: string;
  platform?: string;
  app_version?: string;
}

export async function lookupRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: LookupQuery }>("/lookup", async (req, reply) => {
    const app_id = req.query.app_id ?? "";
    const intent = req.query.intent ?? "";
    const platform = req.query.platform;
    const app_version = req.query.app_version;

    if (!app_id) {
      return reply.code(400).send({ error: "app_id is required" });
    }

    const dir = appDir(app_id);
    if (!existsSync(dir)) {
      return reply.code(404).send({ error: `app not found: ${app_id}` });
    }

    let file: ShortcutsFile;
    try {
      file = JSON.parse(readFileSync(join(dir, "shortcuts.json"), "utf8")) as ShortcutsFile;
    } catch (err) {
      req.log.error({ err, app_id }, "lookup: shortcuts.json read/parse failed");
      return reply.code(500).send({ error: "failed to read shortcuts" });
    }

    let candidates = file.shortcuts;
    if (platform) candidates = candidates.filter((s) => s.platforms.includes(platform));
    if (app_version) {
      candidates = candidates.filter((s) =>
        s.app_versions.some((v) => versionMatches(v, app_version))
      );
    }

    const wildcard = intent === "*" || intent.trim().length === 0;
    const queryTokens = wildcard ? null : tokenize(intent);

    const matched = candidates
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
      .map(({ s }) => s);

    // Attach stats. Cold-start when no row OR use_count < MIN_SAMPLES.
    const prisma = getPrisma();
    const minSamples = minSamplesForScore();

    const enriched = await Promise.all(
      matched.map(async (s) => {
        let stats = null as null | {
          use_count: number | null;
          success_rate: number | null;
          reliability_score: number | null;
          last_validated: string | null;
        };
        if (platform && app_version) {
          const row = await prisma.shortcutStats.findUnique({
            where: {
              shortcut_id_app_id_app_version_platform: {
                shortcut_id: s.id,
                app_id,
                app_version,
                platform,
              },
            },
          });
          if (row) {
            stats = {
              use_count: row.use_count,
              success_rate: row.success_rate,
              reliability_score: row.reliability_score,
              last_validated: row.last_validated ? row.last_validated.toISOString() : null,
            };
          }
        }
        const cold_start = !stats || stats.use_count === null || stats.use_count < minSamples;
        return {
          ...s,
          stats: stats ?? {
            use_count: null,
            success_rate: null,
            reliability_score: null,
            last_validated: null,
          },
          cold_start,
        };
      })
    );

    // Decision E ranking.
    const warm = enriched.filter((s) => !s.cold_start);
    const cold = enriched.filter((s) => s.cold_start);

    warm.sort((a, b) => {
      const ra = a.stats.reliability_score ?? 0;
      const rb = b.stats.reliability_score ?? 0;
      if (rb !== ra) return rb - ra;
      const ca = a.metadata.token_cost_estimate;
      const cb = b.metadata.token_cost_estimate;
      if (ca !== cb) return ca - cb;
      return a.metadata.speed_estimate_ms - b.metadata.speed_estimate_ms;
    });
    cold.sort((a, b) => a.metadata.token_cost_estimate - b.metadata.token_cost_estimate);

    const shortcuts = warm.length > 0 ? [...warm, ...cold] : cold;

    return reply.send({
      app_id,
      total_matched: shortcuts.length,
      cold_start_count: cold.length,
      shortcuts,
    });
  });
}

// ---------- token-overlap matching (mirrors mcp/src/registry.ts) ----------

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t))
  );
}

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
  return true;
}
