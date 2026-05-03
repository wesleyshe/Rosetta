// Explore-session state for Phase 4 Part 2.
//
// Sessions are stored at <config_dir>/sessions/{app_id}.json (decision E).
// Atomic writes: write to .tmp, then rename. Budget is wall-clock minutes
// from session.started_at to now (decision F). registry.submit is stubbed
// (decision G) — real implementation lands in Phase 6a.
//
// In-memory state: a single `activeSession` set by explore.start_session and
// consumed by explore.save_finding / explore.budget_status. The MCP server
// is one process per Claude Desktop config entry, so there's no concurrency.
// If the MCP restarts mid-session, the agent re-calls start_session and the
// file is loaded back.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { backendUrl, configDir } from "./config.js";
import { submitSpec } from "./registry.js";

const SCHEMA_VERSION = 1;
const DEFAULT_BUDGET_MINUTES = 30;
const DEFAULT_RESERVE_MINUTES = 5;

// ---------- types ----------

export type FindingStatus = "drafted" | "verified" | "rejected_by_self";

export interface Finding {
  shortcut_id: string;
  shortcut_spec: Record<string, unknown>;
  status: FindingStatus;
  verification_log?: string[];
  saved_at: string;
  submitted_at: string | null;
  submission_pr_url: string | null;
  submission_commit_sha: string | null;
}

export interface SessionFile {
  schema_version: number;
  app_id: string;
  started_at: string;
  last_active_at: string;
  ended_at: string | null;
  budget: {
    duration_minutes: number;
    submission_reserve_minutes: number;
  };
  findings: Finding[];
  completed_intents: string[];
  abandoned_intents: { intent: string; reason: string }[];
}

// ---------- file ops ----------

export function sessionsDir(): string {
  const dir = join(configDir(), "sessions");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function sessionPath(app_id: string): string {
  return join(sessionsDir(), `${app_id}.json`);
}

function readSession(app_id: string): SessionFile | null {
  const p = sessionPath(app_id);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, "utf8")) as Partial<SessionFile>;
    if (data?.schema_version === SCHEMA_VERSION && data?.app_id === app_id) {
      return data as SessionFile;
    }
    return null;
  } catch {
    return null;
  }
}

function writeSessionAtomic(session: SessionFile): void {
  const p = sessionPath(session.app_id);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(session, null, 2) + "\n", "utf8");
  renameSync(tmp, p);
}

// ---------- in-memory active session ----------

let activeSession: SessionFile | null = null;

function requireActive(toolName: string): SessionFile {
  if (!activeSession) {
    throw new Error(`${toolName}: no active session — call explore.start_session first`);
  }
  return activeSession;
}

// ---------- start_session ----------

export interface StartSessionInput {
  app_id: string;
  budget_minutes?: number;
  submission_reserve_minutes?: number;
  reset?: boolean;
}

export interface StartSessionOutput {
  resumed: boolean;
  app_id: string;
  session_path: string;
  previously_completed_intents: string[];
  previously_abandoned_intents: { intent: string; reason: string }[];
  findings_count: number;
  budget: { duration_minutes: number; submission_reserve_minutes: number };
  started_at: string;
}

export function startSession(input: StartSessionInput): StartSessionOutput {
  const app_id = input.app_id;
  if (!app_id || typeof app_id !== "string") {
    throw new Error("explore.start_session: app_id is required");
  }

  const existing = input.reset ? null : readSession(app_id);
  const now = new Date().toISOString();

  // Budget precedence: explicit input > resumed session > defaults.
  const budget = {
    duration_minutes:
      input.budget_minutes ?? existing?.budget.duration_minutes ?? DEFAULT_BUDGET_MINUTES,
    submission_reserve_minutes:
      input.submission_reserve_minutes ??
      existing?.budget.submission_reserve_minutes ??
      DEFAULT_RESERVE_MINUTES,
  };

  let session: SessionFile;
  let resumed: boolean;
  if (existing) {
    // Resume: keep started_at, clear ended_at, refresh last_active.
    session = {
      ...existing,
      last_active_at: now,
      ended_at: null,
      budget,
    };
    resumed = true;
  } else {
    session = {
      schema_version: SCHEMA_VERSION,
      app_id,
      started_at: now,
      last_active_at: now,
      ended_at: null,
      budget,
      findings: [],
      completed_intents: [],
      abandoned_intents: [],
    };
    resumed = false;
  }

  writeSessionAtomic(session);
  activeSession = session;

  return {
    resumed,
    app_id,
    session_path: sessionPath(app_id),
    previously_completed_intents: [...session.completed_intents],
    previously_abandoned_intents: session.abandoned_intents.map((a) => ({ ...a })),
    findings_count: session.findings.length,
    budget,
    started_at: session.started_at,
  };
}

// ---------- save_finding ----------

export interface SaveFindingInput {
  shortcut_spec: Record<string, unknown>;
  status: FindingStatus;
  verification_log?: string[];
}

export interface SaveFindingOutput {
  saved: boolean;
  shortcut_id: string;
  status: FindingStatus;
  findings_count: number;
  updated_in_place: boolean;
}

export function saveFinding(input: SaveFindingInput): SaveFindingOutput {
  const session = requireActive("explore.save_finding");

  const spec = input.shortcut_spec;
  if (!spec || typeof spec !== "object") {
    throw new Error("explore.save_finding: shortcut_spec is required and must be an object");
  }
  const sid = spec.id;
  if (typeof sid !== "string" || sid.length === 0) {
    throw new Error("explore.save_finding: shortcut_spec.id is required");
  }
  if (!["drafted", "verified", "rejected_by_self"].includes(input.status)) {
    throw new Error(
      `explore.save_finding: status must be one of "drafted" | "verified" | "rejected_by_self"`
    );
  }

  const existingIdx = session.findings.findIndex((f) => f.shortcut_id === sid);
  const existing = existingIdx >= 0 ? session.findings[existingIdx] : null;

  const finding: Finding = {
    shortcut_id: sid,
    shortcut_spec: spec,
    status: input.status,
    verification_log: input.verification_log,
    saved_at: new Date().toISOString(),
    submitted_at: existing?.submitted_at ?? null,
    submission_pr_url: existing?.submission_pr_url ?? null,
    submission_commit_sha: existing?.submission_commit_sha ?? null,
  };

  if (existingIdx >= 0) {
    session.findings[existingIdx] = finding;
  } else {
    session.findings.push(finding);
  }

  const intent = typeof spec.intent === "string" ? spec.intent : "";
  if (intent) {
    if (input.status === "verified") {
      if (!session.completed_intents.includes(intent)) {
        session.completed_intents.push(intent);
      }
      // If we previously abandoned this intent, remove it now that we have a verified finding.
      session.abandoned_intents = session.abandoned_intents.filter((a) => a.intent !== intent);
    } else if (input.status === "rejected_by_self") {
      const reason = input.verification_log?.[0] ?? "no reason given";
      if (!session.abandoned_intents.some((a) => a.intent === intent)) {
        session.abandoned_intents.push({ intent, reason });
      }
    }
  }

  session.last_active_at = new Date().toISOString();
  writeSessionAtomic(session);

  return {
    saved: true,
    shortcut_id: sid,
    status: input.status,
    findings_count: session.findings.length,
    updated_in_place: existingIdx >= 0,
  };
}

// ---------- budget_status ----------

export interface BudgetStatusOutput {
  app_id: string;
  started_at: string;
  duration_minutes: number;
  submission_reserve_minutes: number;
  minutes_used: number;
  minutes_remaining: number;
  should_stop_discovering: boolean;
}

export function budgetStatus(): BudgetStatusOutput {
  const session = requireActive("explore.budget_status");
  const startMs = Date.parse(session.started_at);
  const elapsedMin = (Date.now() - startMs) / 60_000;
  const used = Math.max(0, elapsedMin);
  const total = session.budget.duration_minutes;
  const reserve = session.budget.submission_reserve_minutes;
  const remaining = Math.max(0, total - used);
  return {
    app_id: session.app_id,
    started_at: session.started_at,
    duration_minutes: total,
    submission_reserve_minutes: reserve,
    minutes_used: round2(used),
    minutes_remaining: round2(remaining),
    should_stop_discovering: remaining <= reserve,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- submit_findings ----------

export interface SubmitFindingsInput {
  app_id: string;
}

export interface SubmitFindingsResult {
  shortcut_id: string;
  pr_url: string;
  commit_sha: string | null;
  error?: string;
}

export interface SubmitFindingsOutput {
  app_id: string;
  attempted_count: number;
  submitted_count: number;
  results: SubmitFindingsResult[];
  /** True when ROSETTA_BACKEND_URL is unset and the submitter ran in dry-run
   *  mode (returning fake PR URLs of the form .../pull/dryrun-{cuid}). */
  dry_run: boolean;
}

export async function submitFindings(input: SubmitFindingsInput): Promise<SubmitFindingsOutput> {
  if (!input.app_id) throw new Error("explore.submit_findings: app_id is required");

  // Allow either active session or fresh-load from file (in case of MCP
  // restart between start_session and submit_findings).
  let session: SessionFile | null =
    activeSession?.app_id === input.app_id ? activeSession : readSession(input.app_id);
  if (!session) {
    throw new Error(`explore.submit_findings: no session found for app "${input.app_id}"`);
  }

  const dryRun = backendUrl() === undefined;
  const candidates = session.findings.filter(
    (f) => f.status === "verified" && !f.submitted_at
  );

  const results: SubmitFindingsResult[] = [];
  for (const f of candidates) {
    try {
      const sub = await submitSpec({
        app_id: input.app_id,
        shortcut_spec: f.shortcut_spec,
      });
      f.submitted_at = new Date().toISOString();
      f.submission_pr_url = sub.pr_url;
      f.submission_commit_sha = sub.commit_sha;
      results.push({
        shortcut_id: f.shortcut_id,
        pr_url: sub.pr_url,
        commit_sha: sub.commit_sha,
      });
    } catch (e) {
      results.push({
        shortcut_id: f.shortcut_id,
        pr_url: "",
        commit_sha: null,
        error: (e as Error).message,
      });
    }
  }

  session.last_active_at = new Date().toISOString();
  writeSessionAtomic(session);
  if (activeSession?.app_id === input.app_id) activeSession = session;

  return {
    app_id: input.app_id,
    attempted_count: candidates.length,
    submitted_count: results.filter((r) => !r.error && r.pr_url).length,
    results,
    dry_run: dryRun,
  };
}

// Real submission + dry-run fallback both live in registry.ts as submitSpec().
// explore.submit_findings calls that shared function directly so the
// behavior is identical across the explore-flow path and the standalone
// registry_submit MCP tool.
