// POST /report-execution — telemetry from the use seed skill.
//
// Body shape (mirrors mcp/src/registry.ts reportExecution event):
//   {
//     shortcut_id: string,
//     app_id: string,
//     install_id: string,
//     success: boolean,
//     error_class?: string,
//     app_version: string,
//     platform: "macos" | "windows" | "linux",
//     timestamp: ISO string  (ignored — server time is authoritative)
//   }
//
// Auth: NONE (kickoff decision F). Use is anonymous; install_id is the
// anti-sybil token, generated locally by the MCP at first launch. The
// backend rate-limits per (install_id, shortcut_id, UTC-day) — kickoff
// decision D.
//
// Side effects (decision G): write Execution row, then recomputeStats
// inside a single Prisma $transaction. v0 scale; no job queue.

import type { FastifyInstance } from "fastify";

import { getPrisma } from "../db.js";
import { recomputeStats } from "../stats.js";

const RATE_LIMIT_PER_DAY = 100;

interface ReportBody {
  shortcut_id?: unknown;
  app_id?: unknown;
  install_id?: unknown;
  success?: unknown;
  error_class?: unknown;
  app_version?: unknown;
  platform?: unknown;
  timestamp?: unknown;
}

const PLATFORM_ENUM = new Set(["macos", "windows", "linux"]);

export async function reportRoute(app: FastifyInstance): Promise<void> {
  app.post("/report-execution", async (req, reply) => {
    const body = (req.body ?? {}) as ReportBody;

    const shortcut_id = typeof body.shortcut_id === "string" ? body.shortcut_id : "";
    const app_id = typeof body.app_id === "string" ? body.app_id : "";
    const install_id = typeof body.install_id === "string" ? body.install_id : "";
    const success = typeof body.success === "boolean" ? body.success : null;
    const app_version = typeof body.app_version === "string" ? body.app_version : "";
    const platform = typeof body.platform === "string" ? body.platform : "";
    const error_class =
      typeof body.error_class === "string" && body.error_class.length > 0
        ? body.error_class
        : null;

    if (
      !shortcut_id ||
      !app_id ||
      !install_id ||
      success === null ||
      !app_version ||
      !PLATFORM_ENUM.has(platform)
    ) {
      return reply.code(400).send({
        error: "invalid body",
        detail:
          "expected { shortcut_id, app_id, install_id, success, app_version, platform } " +
          "with platform ∈ {macos, windows, linux}",
      });
    }

    const prisma = getPrisma();

    // Rate limit (decision D): UTC-day window, 100 events per
    // (install_id, shortcut_id) pair.
    const startOfUtcDay = new Date();
    startOfUtcDay.setUTCHours(0, 0, 0, 0);
    const todayCount = await prisma.execution.count({
      where: { install_id, shortcut_id, created_at: { gte: startOfUtcDay } },
    });
    if (todayCount >= RATE_LIMIT_PER_DAY) {
      const nextMidnightMs = startOfUtcDay.getTime() + 24 * 60 * 60 * 1000;
      const retry_after_seconds = Math.max(1, Math.ceil((nextMidnightMs - Date.now()) / 1000));
      return reply.code(429).send({
        error: "rate_limit_exceeded",
        limit: RATE_LIMIT_PER_DAY,
        retry_after_seconds,
      });
    }

    try {
      const stats = await prisma.$transaction(async (tx) => {
        await tx.execution.create({
          data: {
            shortcut_id,
            app_id,
            install_id,
            success,
            error_class,
            app_version,
            platform,
          },
        });
        // recomputeStats accepts the full PrismaClient surface; the
        // transaction client exposes the same models.
        return await recomputeStats(tx as unknown as typeof prisma, {
          shortcut_id,
          app_id,
          app_version,
          platform,
        });
      });
      return reply.send({ ok: true, current_stats: stats });
    } catch (err) {
      req.log.error({ err, shortcut_id, app_id }, "report-execution write failed");
      return reply.code(500).send({ error: "internal", detail: (err as Error).message.slice(0, 300) });
    }
  });
}
