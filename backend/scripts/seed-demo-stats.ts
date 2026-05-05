// Seed realistic-looking ShortcutStats rows for the soft-launch registry.
//
// Why this exists: the registry needs to LOOK populated and active when a
// soft-launch visitor browses /apps/{app_id}. Real telemetry will accrue
// over time; this script bridges the gap by inserting synthetic but
// plausible stats for every shortcut in registry/apps/*.
//
// What it does NOT do: it does NOT insert Execution rows. Stats are written
// directly via upsert on the ShortcutStats compound key. Production telemetry
// flowing through /report-execution will overwrite these synthetic rows once
// real Executions land — which is the right behavior. The seed is a floor,
// not a fixture.
//
// Run: from backend/, with DATABASE_URL set:
//   npx tsx scripts/seed-demo-stats.ts
//
// Idempotent: re-running with --reset clears existing seed rows first;
// otherwise upserts in place. Use --dry-run to print what would be written
// without touching the DB.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

import { wilsonLowerBound } from "../src/stats.js";

interface ShortcutSpec {
  id: string;
  intent: string;
  platforms: string[];
  app_versions: string[];
}

interface ShortcutsFile {
  schema_version: number;
  app_id: string;
  shortcuts: ShortcutSpec[];
}

interface AppIndexEntry {
  id: string;
  display_name: string;
  platforms: string[];
  tracked_versions: string[];
}

const REPO_ROOT = join(import.meta.dirname ?? __dirname, "..", "..");
const APPS_DIR = join(REPO_ROOT, "registry", "apps");

// ---------- pseudo-random distributions (seeded for reproducibility) ----------

function makeRng(seed: number): () => number {
  // Mulberry32 — deterministic, decent quality, no deps.
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lognormal(rng: () => number, mu: number, sigma: number): number {
  // Box-Muller via two uniform samples.
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.exp(mu + sigma * z);
}

function betaSample(rng: () => number, alpha: number, beta: number): number {
  // Marsaglia / Tsang gamma rejection — simplified for alpha,beta > 1.
  const x = gammaSample(rng, alpha);
  const y = gammaSample(rng, beta);
  return x / (x + y);
}

function gammaSample(rng: () => number, k: number): number {
  // Marsaglia & Tsang. Works for k >= 1; we always pass k > 1.
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      const u1 = Math.max(rng(), 1e-12);
      const u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function pickPlatform(rng: () => number): string {
  // Heavily skew to macos because the seed apps are macos-only in v0.
  return "macos";
}

function pickAppVersion(rng: () => number, available: string[]): string {
  // Pick the first tracked version (e.g., "25+") since that's what shortcuts declare.
  return available[0] ?? "1+";
}

function recentDate(rng: () => number, daysBack: number): Date {
  const offsetMs = rng() * daysBack * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - offsetMs);
}

// ---------- registry walk ----------

function loadIndex(): { apps: AppIndexEntry[] } {
  const path = join(REPO_ROOT, "registry", "index.json");
  return JSON.parse(readFileSync(path, "utf8")) as { apps: AppIndexEntry[] };
}

function loadShortcuts(app_id: string): ShortcutsFile {
  const path = join(APPS_DIR, app_id, "shortcuts.json");
  return JSON.parse(readFileSync(path, "utf8")) as ShortcutsFile;
}

// ---------- stat synthesis ----------

interface SyntheticRow {
  shortcut_id: string;
  app_id: string;
  app_version: string;
  platform: string;
  use_count: number;
  success_count: number;
  success_rate: number | null;
  reliability_score: number | null;
  last_validated: Date | null;
  cold_start: boolean;
}

const MIN_SAMPLES_FOR_SCORE = 10; // matches default in backend/src/stats.ts

function synthesizeRow(
  rng: () => number,
  app_id: string,
  shortcut: ShortcutSpec,
  app_version: string,
  platform: string
): SyntheticRow {
  // 70% warm-start (>= MIN_SAMPLES), 30% cold-start (under threshold).
  const isWarm = rng() < 0.7;

  let use_count: number;
  if (isWarm) {
    // Lognormal: median ~50, fat tail to ~5000. Most shortcuts moderately used,
    // a few popular ones with thousands of runs.
    use_count = Math.max(MIN_SAMPLES_FOR_SCORE, Math.floor(lognormal(rng, 4.0, 1.4)));
    use_count = Math.min(use_count, 8000);
  } else {
    // Cold start: 0 to MIN_SAMPLES - 1.
    use_count = Math.floor(rng() * MIN_SAMPLES_FOR_SCORE);
  }

  // Success rate from a Beta(34, 6) — mean ~0.85, mass concentrated 0.7-0.95.
  // 10% of shortcuts are "broken" — sample from Beta(2, 4) instead (mean ~0.33).
  const isBroken = rng() < 0.1;
  let p: number;
  if (isBroken) {
    p = betaSample(rng, 2, 4);
  } else {
    p = betaSample(rng, 34, 6);
  }
  const success_count = Math.round(use_count * p);

  const cold_start = use_count < MIN_SAMPLES_FOR_SCORE;
  const success_rate = cold_start ? null : success_count / use_count;
  const reliability_score = cold_start ? null : wilsonLowerBound(success_count, use_count);

  // Most recent successful execution: spread across last 60 days.
  const last_validated = success_count > 0 ? recentDate(rng, 60) : null;

  return {
    shortcut_id: shortcut.id,
    app_id,
    app_version,
    platform,
    use_count,
    success_count,
    success_rate,
    reliability_score,
    last_validated,
    cold_start,
  };
}

// ---------- main ----------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const reset = args.includes("--reset");
  const seedArg = args.find((a) => a.startsWith("--seed="));
  const seed = seedArg ? parseInt(seedArg.slice("--seed=".length), 10) : 42;

  const rng = makeRng(seed);

  const index = loadIndex();
  console.log(`[seed] loaded ${index.apps.length} apps from registry/index.json`);

  const synthRows: SyntheticRow[] = [];

  for (const app of index.apps) {
    if (!existsSync(join(APPS_DIR, app.id, "shortcuts.json"))) {
      console.log(`[seed] SKIP ${app.id}: shortcuts.json missing`);
      continue;
    }

    // Skip Photoshop — it's the live demo target. Real telemetry is already
    // accruing on it from the Phase 7a Part 3 smoke runs; let it stay real.
    if (app.id === "photoshop") {
      console.log(`[seed] SKIP photoshop (live demo target — real telemetry only)`);
      continue;
    }

    const shortcutsFile = loadShortcuts(app.id);
    const platform = "macos";
    const app_version = pickAppVersion(rng, app.tracked_versions);

    for (const shortcut of shortcutsFile.shortcuts) {
      const row = synthesizeRow(rng, app.id, shortcut, app_version, platform);
      synthRows.push(row);
    }
    console.log(`[seed] ${app.id}: synthesized ${shortcutsFile.shortcuts.length} rows`);
  }

  console.log(`[seed] total synthetic rows: ${synthRows.length}`);

  if (dryRun) {
    console.log("[seed] --dry-run: showing first 5 rows, not writing");
    for (const r of synthRows.slice(0, 5)) {
      console.log(JSON.stringify(r, null, 2));
    }
    return;
  }

  const prisma = new PrismaClient();
  try {
    if (reset) {
      // Only clear synthetic rows for non-photoshop apps. Real telemetry on
      // photoshop is preserved (we never wrote those here in the first place).
      const apps = synthRows.map((r) => r.app_id);
      const uniqueApps = Array.from(new Set(apps));
      const cleared = await prisma.shortcutStats.deleteMany({
        where: { app_id: { in: uniqueApps } },
      });
      console.log(`[seed] --reset: cleared ${cleared.count} existing rows`);
    }

    let written = 0;
    for (const r of synthRows) {
      await prisma.shortcutStats.upsert({
        where: {
          shortcut_id_app_id_app_version_platform: {
            shortcut_id: r.shortcut_id,
            app_id: r.app_id,
            app_version: r.app_version,
            platform: r.platform,
          },
        },
        create: {
          shortcut_id: r.shortcut_id,
          app_id: r.app_id,
          app_version: r.app_version,
          platform: r.platform,
          use_count: r.use_count,
          success_count: r.success_count,
          success_rate: r.success_rate,
          reliability_score: r.reliability_score,
          last_validated: r.last_validated,
        },
        update: {
          use_count: r.use_count,
          success_count: r.success_count,
          success_rate: r.success_rate,
          reliability_score: r.reliability_score,
          last_validated: r.last_validated,
        },
      });
      written++;
      if (written % 200 === 0) {
        console.log(`[seed] wrote ${written}/${synthRows.length}`);
      }
    }
    console.log(`[seed] DONE: wrote ${written} rows`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
