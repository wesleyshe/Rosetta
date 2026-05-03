// Aggregation for ShortcutStats. Re-runs synchronously after every
// /report-execution (kickoff decision G). v0 scale doesn't justify a
// job queue.
//
// Stats key (kickoff decision C, schema PK from the 6a closeout):
//   (shortcut_id, app_id, app_version, platform)
//
// reliability_score = Wilson lower bound at 95% confidence (z = 1.96)
// when use_count >= MIN_SAMPLES_FOR_SCORE. Otherwise null. Wilson is
// the right shape: 5/5 raw rate 100% → WLB ≈ 0.565, which deliberately
// punishes "succeeded once and stopped" — that's the safety property
// we want.

import type { PrismaClient } from "@prisma/client";

const Z_95 = 1.96;
const DEFAULT_MIN_SAMPLES = 5;

export interface StatsKey {
  shortcut_id: string;
  app_id: string;
  app_version: string;
  platform: string;
}

export interface StatsRow {
  shortcut_id: string;
  app_id: string;
  app_version: string;
  platform: string;
  use_count: number;
  success_count: number;
  success_rate: number | null;
  reliability_score: number | null;
  last_validated: Date | null;
  updated_at: Date;
}

export function minSamplesForScore(): number {
  const raw = process.env.MIN_SAMPLES_FOR_SCORE;
  if (!raw) return DEFAULT_MIN_SAMPLES;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MIN_SAMPLES;
}

export function wilsonLowerBound(success: number, total: number, z = Z_95): number {
  if (total <= 0) return 0;
  const p = success / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const half =
    (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denominator;
  return Math.max(0, center - half);
}

/**
 * Aggregate all Execution rows that share the given key, then upsert the
 * ShortcutStats row. Idempotent — re-running yields the same result.
 *
 * Returns the freshly-written row so callers can echo it in the response.
 */
export async function recomputeStats(
  prisma: PrismaClient,
  key: StatsKey
): Promise<StatsRow> {
  const where = {
    shortcut_id: key.shortcut_id,
    app_id: key.app_id,
    app_version: key.app_version,
    platform: key.platform,
  };

  const [use_count, success_count, mostRecentSuccess] = await Promise.all([
    prisma.execution.count({ where }),
    prisma.execution.count({ where: { ...where, success: true } }),
    prisma.execution.findFirst({
      where: { ...where, success: true },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    }),
  ]);

  const minSamples = minSamplesForScore();
  let success_rate: number | null = null;
  let reliability_score: number | null = null;
  if (use_count >= minSamples) {
    success_rate = success_count / use_count;
    reliability_score = wilsonLowerBound(success_count, use_count);
  }

  const data = {
    use_count,
    success_count,
    success_rate,
    reliability_score,
    last_validated: mostRecentSuccess?.created_at ?? null,
  };

  const row = await prisma.shortcutStats.upsert({
    where: {
      shortcut_id_app_id_app_version_platform: {
        shortcut_id: key.shortcut_id,
        app_id: key.app_id,
        app_version: key.app_version,
        platform: key.platform,
      },
    },
    update: data,
    create: { ...key, ...data },
  });

  return row as StatsRow;
}
