// Ad-hoc discovery proposals from use mode.
//
// Use-mode is anonymous (no GitHub auth). When the agent encounters a gap in
// the registry — either lookup returned nothing for the user's intent, or
// every ranked shortcut failed — and figures out a working method on the fly,
// it stashes the candidate here. The user can later opt to contribute it back
// to the registry, at which point GitHub OAuth is required (same auth the
// explore-skill uses, just deferred to submission time).
//
// File layout: <config_dir>/proposals/{app_id}.json. Atomic writes, schema
// versioned. Distinct from sessions/{app_id}.json because:
//   - no wall-clock budget (a use-mode discovery is a single shortcut)
//   - no completed_intents / abandoned_intents bookkeeping
//   - no in-memory active state (each propose call stands alone)
//
// Submission reuses registry.ts submitSpec() so the prompt-injection reviewer
// + auto-merge flow is identical to the explore path.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { backendUrl, configDir } from "./config.js";
import { submitSpec } from "./registry.js";

const SCHEMA_VERSION = 1;

// ---------- types ----------

export interface Proposal {
  proposal_id: string;
  shortcut_spec: Record<string, unknown>;
  origin_intent: string;
  drafted_at: string;
  verification_log: string[];
  submitted_at: string | null;
  submission_pr_url: string | null;
  submission_commit_sha: string | null;
}

interface ProposalsFile {
  schema_version: number;
  app_id: string;
  proposals: Proposal[];
}

// ---------- file ops ----------

function proposalsDir(): string {
  const dir = join(configDir(), "proposals");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function proposalsPath(app_id: string): string {
  return join(proposalsDir(), `${app_id}.json`);
}

function readProposals(app_id: string): ProposalsFile {
  const p = proposalsPath(app_id);
  if (!existsSync(p)) {
    return { schema_version: SCHEMA_VERSION, app_id, proposals: [] };
  }
  try {
    const data = JSON.parse(readFileSync(p, "utf8")) as Partial<ProposalsFile>;
    if (data?.schema_version === SCHEMA_VERSION && data?.app_id === app_id && Array.isArray(data?.proposals)) {
      return data as ProposalsFile;
    }
  } catch {
    // fall through and return empty
  }
  return { schema_version: SCHEMA_VERSION, app_id, proposals: [] };
}

function writeProposalsAtomic(file: ProposalsFile): void {
  const p = proposalsPath(file.app_id);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(file, null, 2) + "\n", "utf8");
  renameSync(tmp, p);
}

// ---------- propose ----------

export interface ProposeFindingInput {
  app_id: string;
  shortcut_spec: Record<string, unknown>;
  origin_intent: string;
  verification_log?: string[];
}

export interface ProposeFindingOutput {
  proposal_id: string;
  app_id: string;
  shortcut_id: string;
  proposals_count: number;
  updated_in_place: boolean;
  proposals_path: string;
}

export function proposeFinding(input: ProposeFindingInput): ProposeFindingOutput {
  if (!input.app_id) throw new Error("registry.propose_finding: app_id is required");
  const spec = input.shortcut_spec;
  if (!spec || typeof spec !== "object") {
    throw new Error("registry.propose_finding: shortcut_spec must be an object");
  }
  const sid = spec.id;
  if (typeof sid !== "string" || sid.length === 0) {
    throw new Error("registry.propose_finding: shortcut_spec.id is required");
  }
  if (!input.origin_intent || typeof input.origin_intent !== "string") {
    throw new Error(
      "registry.propose_finding: origin_intent is required (the user's original intent that led to this discovery)"
    );
  }

  const file = readProposals(input.app_id);
  const existingIdx = file.proposals.findIndex((p) => p.shortcut_spec.id === sid);
  const proposal: Proposal = {
    proposal_id: existingIdx >= 0 ? file.proposals[existingIdx].proposal_id : randomUUID(),
    shortcut_spec: spec,
    origin_intent: input.origin_intent,
    drafted_at: new Date().toISOString(),
    verification_log: input.verification_log ?? [],
    submitted_at: existingIdx >= 0 ? file.proposals[existingIdx].submitted_at : null,
    submission_pr_url: existingIdx >= 0 ? file.proposals[existingIdx].submission_pr_url : null,
    submission_commit_sha: existingIdx >= 0 ? file.proposals[existingIdx].submission_commit_sha : null,
  };

  if (existingIdx >= 0) {
    file.proposals[existingIdx] = proposal;
  } else {
    file.proposals.push(proposal);
  }
  writeProposalsAtomic(file);

  return {
    proposal_id: proposal.proposal_id,
    app_id: input.app_id,
    shortcut_id: sid,
    proposals_count: file.proposals.length,
    updated_in_place: existingIdx >= 0,
    proposals_path: proposalsPath(input.app_id),
  };
}

// ---------- list ----------

export interface ListProposalsInput {
  app_id: string;
  include_submitted?: boolean;
}

export interface ListProposalsOutput {
  app_id: string;
  proposals: Proposal[];
  count: number;
}

export function listProposals(input: ListProposalsInput): ListProposalsOutput {
  if (!input.app_id) throw new Error("registry.list_proposals: app_id is required");
  const file = readProposals(input.app_id);
  const filtered = input.include_submitted
    ? file.proposals
    : file.proposals.filter((p) => !p.submitted_at);
  return {
    app_id: input.app_id,
    proposals: filtered,
    count: filtered.length,
  };
}

// ---------- submit ----------

export interface SubmitProposalsInput {
  app_id: string;
  proposal_ids?: string[];
  contributor_token?: string;
}

export interface SubmitProposalsResult {
  proposal_id: string;
  shortcut_id: string;
  pr_url: string;
  commit_sha: string | null;
  error?: string;
}

export interface SubmitProposalsOutput {
  app_id: string;
  attempted_count: number;
  submitted_count: number;
  results: SubmitProposalsResult[];
  dry_run: boolean;
}

export async function submitProposals(
  input: SubmitProposalsInput
): Promise<SubmitProposalsOutput> {
  if (!input.app_id) throw new Error("registry.submit_proposals: app_id is required");

  const file = readProposals(input.app_id);
  const dryRun = backendUrl() === undefined;

  let candidates = file.proposals.filter((p) => !p.submitted_at);
  if (input.proposal_ids && input.proposal_ids.length > 0) {
    const wanted = new Set(input.proposal_ids);
    candidates = candidates.filter((p) => wanted.has(p.proposal_id));
  }

  const results: SubmitProposalsResult[] = [];
  for (const p of candidates) {
    const sid = String(p.shortcut_spec.id);
    try {
      const sub = await submitSpec({
        app_id: input.app_id,
        shortcut_spec: p.shortcut_spec,
        contributor_token: input.contributor_token,
      });
      p.submitted_at = new Date().toISOString();
      p.submission_pr_url = sub.pr_url;
      p.submission_commit_sha = sub.commit_sha;
      results.push({
        proposal_id: p.proposal_id,
        shortcut_id: sid,
        pr_url: sub.pr_url,
        commit_sha: sub.commit_sha,
      });
    } catch (e) {
      results.push({
        proposal_id: p.proposal_id,
        shortcut_id: sid,
        pr_url: "",
        commit_sha: null,
        error: (e as Error).message,
      });
    }
  }

  writeProposalsAtomic(file);

  return {
    app_id: input.app_id,
    attempted_count: candidates.length,
    submitted_count: results.filter((r) => !r.error && r.pr_url).length,
    results,
    dry_run: dryRun,
  };
}
