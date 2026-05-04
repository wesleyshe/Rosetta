// GitHub Contents API wrapper for /submit (kickoff decision K).
//
// We don't git-clone. Read shortcuts.json via the Contents API, append the
// new spec, write back via Contents API, open a PR, and squash-merge it
// immediately via the merge endpoint (decision F: explicit auto-merge call,
// not GitHub's "auto-merge when checks pass" feature).
//
// Race condition handling: the Contents API returns a `sha` for the file
// at read time and requires that sha on write. If two submissions arrive
// concurrently, the second's write returns 409. We retry once after
// re-fetching the latest sha. More than two concurrent writers is rare in
// v0; if it becomes a real problem, queue submissions in Postgres.
//
// Operates against the repo identified by GITHUB_REPO_OWNER + GITHUB_REPO_NAME.
// Uses the contributor's OAuth token so commits are authored as them.

import { Octokit } from "@octokit/rest";

import type { ReviewerVerdict } from "./reviewer.js";

const DEFAULT_BASE_BRANCH = "main";
const SUBMIT_BRANCH_PREFIX = "submit/";

interface RepoCoords {
  owner: string;
  repo: string;
}

function repoCoords(): RepoCoords {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  if (!owner || !repo) {
    throw new Error("GITHUB_REPO_OWNER and GITHUB_REPO_NAME must be set");
  }
  return { owner, repo };
}

export interface SubmitParams {
  app_id: string;
  shortcut_spec: Record<string, unknown>;
  contributor_token: string;
  contributor_username: string;
  reviewer_verdict: ReviewerVerdict;
  reviewer_reason: string;
}

export interface SubmitResult {
  pr_url: string;
  pr_number: number;
  pr_commit_sha: string;
  branch: string;
}

/**
 * Append `shortcut_spec` to registry/apps/{app_id}/shortcuts.json on a new
 * branch, open a PR, and squash-merge it. Returns PR URL + merged commit SHA.
 *
 * Caller is responsible for ajv validation and reviewer verdict — this
 * function trusts both have already passed.
 */
export async function submitShortcut(params: SubmitParams): Promise<SubmitResult> {
  const { owner, repo } = repoCoords();
  const octo = new Octokit({ auth: params.contributor_token, userAgent: "rosetta-backend" });

  const shortcutId = String(params.shortcut_spec.id ?? "unknown");
  const slug = shortcutId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const branch = `${SUBMIT_BRANCH_PREFIX}${params.app_id}/${slug}-${Date.now()}`;
  const path = `registry/apps/${params.app_id}/shortcuts.json`;
  const baseBranch = process.env.GITHUB_BASE_BRANCH ?? DEFAULT_BASE_BRANCH;

  // 1. Get the current head of base.
  const baseRef = await octo.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
  const baseSha = baseRef.data.object.sha;

  // 2. Create the submit branch from base.
  await octo.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseSha });

  // 3. Append the spec to shortcuts.json on the new branch (with one retry on 409).
  const commitSha = await appendShortcutWithRetry(octo, {
    owner,
    repo,
    branch,
    path,
    new_shortcut: params.shortcut_spec,
    contributor_username: params.contributor_username,
    app_id: params.app_id,
    shortcut_id: shortcutId,
  });

  // 4. Open the PR.
  const prTitle = `[rosetta-mcp] ${params.app_id} / ${shortcutId} from ${params.contributor_username}`;
  const prBody = renderPrBody({
    app_id: params.app_id,
    shortcut_id: shortcutId,
    contributor: params.contributor_username,
    reviewer_verdict: params.reviewer_verdict,
    reviewer_reason: params.reviewer_reason,
    spec: params.shortcut_spec,
  });
  const pr = await octo.pulls.create({
    owner,
    repo,
    title: prTitle,
    head: branch,
    base: baseBranch,
    body: prBody,
  });

  // 5. Squash-merge immediately (decision F).
  const merge = await octo.pulls.merge({
    owner,
    repo,
    pull_number: pr.data.number,
    merge_method: "squash",
    commit_title: prTitle,
  });

  return {
    pr_url: pr.data.html_url,
    pr_number: pr.data.number,
    pr_commit_sha: merge.data.sha ?? commitSha,
    branch,
  };
}

interface AppendArgs {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  new_shortcut: Record<string, unknown>;
  contributor_username: string;
  app_id: string;
  shortcut_id: string;
}

async function appendShortcutWithRetry(
  octo: Octokit,
  args: AppendArgs
): Promise<string> {
  try {
    return await appendShortcutOnce(octo, args);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status !== 409) throw err;
    // Stale SHA; one retry per kickoff decision K.
    return await appendShortcutOnce(octo, args);
  }
}

async function appendShortcutOnce(octo: Octokit, args: AppendArgs): Promise<string> {
  const r = await octo.repos.getContent({
    owner: args.owner,
    repo: args.repo,
    path: args.path,
    ref: args.branch,
  });
  if (Array.isArray(r.data) || r.data.type !== "file") {
    throw new Error(`expected file at ${args.path}; got ${"type" in r.data ? r.data.type : "directory"}`);
  }
  const decoded = Buffer.from(r.data.content, r.data.encoding as BufferEncoding).toString("utf8");
  const parsed = JSON.parse(decoded) as { schema_version: number; app_id: string; shortcuts: unknown[] };
  parsed.shortcuts.push(args.new_shortcut);
  const updated = JSON.stringify(parsed, null, 2) + "\n";

  const commitMessage = `Add ${args.shortcut_id} shortcut to ${args.app_id} (via rosetta-mcp)`;
  const write = await octo.repos.createOrUpdateFileContents({
    owner: args.owner,
    repo: args.repo,
    path: args.path,
    branch: args.branch,
    message: commitMessage,
    content: Buffer.from(updated, "utf8").toString("base64"),
    sha: r.data.sha,
    committer: { name: args.contributor_username, email: `${args.contributor_username}@users.noreply.github.com` },
    author: { name: args.contributor_username, email: `${args.contributor_username}@users.noreply.github.com` },
  });
  return write.data.commit.sha ?? "";
}

interface PrBodyArgs {
  app_id: string;
  shortcut_id: string;
  contributor: string;
  reviewer_verdict: ReviewerVerdict;
  reviewer_reason: string;
  spec: Record<string, unknown>;
}

function renderPrBody(a: PrBodyArgs): string {
  const specBlock = "```json\n" + JSON.stringify(a.spec, null, 2) + "\n```";
  return [
    `## Reviewer verdict`,
    "",
    `- **Verdict:** \`${a.reviewer_verdict}\``,
    `- **Reason:** ${a.reviewer_reason}`,
    "",
    `## Spec being added`,
    "",
    `App: \`${a.app_id}\` · Shortcut id: \`${a.shortcut_id}\` · Contributor: \`${a.contributor}\``,
    "",
    specBlock,
    "",
    `---`,
    `_Auto-merged after passing the prompt-injection reviewer. PR is preserved as audit trail._`,
    "",
  ].join("\n");
}
