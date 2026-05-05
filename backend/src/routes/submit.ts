// POST /submit — explorer-agent submission flow.
//
// Body shape:    { app_id: string, shortcut_spec: object }
// Auth:          Authorization: Bearer <github oauth token>
// Returns:       { pr_url, commit_sha } on success
// Error codes:   400 invalid body / unknown app_id / schema validation failed / reviewer rejected
//                401 missing or unrecognized bearer token
//                500 server-side configuration error
//                502 upstream (GitHub Contents API) error
//
// Pipeline (kickoff decision sequence):
//   1. Parse body, parse bearer token. 401 if no token.
//   2. Look up Contributor by sha256(token). 401 if no match.
//   3. Decision J guard: 400 if registry/apps/{app_id}/ doesn't exist.
//   4. Decision H: ajv-validate shortcut_spec against
//      registry/schemas/shortcut.schema.json. 400 with errors if invalid.
//   5. Run reviewer.ts. If verdict === "rejected", write Submission
//      row (status=rejected) and return 400 with reviewer_reason.
//      If verdict === "needs_human", same but with status=pending_review
//      and "queued for human review" reason.
//   6. If verdict === "passed", call github.submitShortcut. Squash-merges
//      immediately. Write Submission row (status=merged) with pr_url +
//      commit_sha. Increment Contributor.submission_count.
//
// New apps via /submit are out of scope for v0 (decision J). Adding a new
// app requires creating meta.json + workflow.json + shortcuts.json by
// hand. /submit returns 400 if registry/apps/{app_id}/ doesn't exist.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import _Ajv2020 from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";

// Ajv ships dual ESM/CJS exports. Under Node16 module resolution the default
// import points at the namespace, so unwrap to the concrete constructor.
type AjvCtor = typeof import("ajv/dist/2020.js").default;
type AddFormatsFn = typeof import("ajv-formats").default;
const Ajv2020 = ((_Ajv2020 as unknown) as { default?: AjvCtor }).default ?? (_Ajv2020 as unknown as AjvCtor);
const addFormats = ((_addFormats as unknown) as { default?: AddFormatsFn }).default ?? (_addFormats as unknown as AddFormatsFn);
import type { FastifyInstance } from "fastify";

import { hashToken, parseBearer } from "../auth.js";
import { getPrisma } from "../db.js";
import { appDir, REGISTRY_SCHEMAS_DIR } from "../paths.js";
import { reviewSpec } from "../reviewer.js";
import { submitShortcut } from "../github.js";

interface SubmitBody {
  app_id?: unknown;
  shortcut_spec?: unknown;
}

type ValidateFn = ((data: unknown) => boolean) & { errors?: unknown[] | null };

let validateShortcutSpec: ValidateFn | undefined;

function loadValidator(): ValidateFn {
  if (validateShortcutSpec) return validateShortcutSpec;
  // Load registry schemas from disk; do NOT duplicate them in code (decision H).
  // The file's root schema describes a whole shortcuts.json file
  // ({schema_version, app_id, shortcuts: [...]}); the per-entry schema lives
  // at $defs.shortcut and is what /submit's `shortcut_spec` body field must
  // satisfy. Add the whole document so $ref resolution still works, then
  // pull the sub-schema validator out by ref.
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajv);
  const schemaPath = join(REGISTRY_SCHEMAS_DIR, "shortcut.schema.json");
  const wholeSchema = JSON.parse(readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
  ajv.addSchema(wholeSchema, "shortcut.schema.json");
  const sub = ajv.getSchema("shortcut.schema.json#/$defs/shortcut");
  if (!sub) throw new Error("failed to compile shortcut.schema.json#/$defs/shortcut");
  validateShortcutSpec = sub as ValidateFn;
  return validateShortcutSpec;
}

export async function submitRoute(app: FastifyInstance): Promise<void> {
  app.post("/submit", async (req, reply) => {
    const body = (req.body ?? {}) as SubmitBody;
    const app_id = typeof body.app_id === "string" ? body.app_id : "";
    const shortcut_spec = body.shortcut_spec;

    if (
      !app_id ||
      shortcut_spec === null ||
      shortcut_spec === undefined ||
      typeof shortcut_spec !== "object" ||
      Array.isArray(shortcut_spec)
    ) {
      return reply.code(400).send({
        error: "invalid body",
        detail: "expected { app_id: string, shortcut_spec: object }",
      });
    }

    const token = parseBearer(req.headers.authorization);
    if (!token) {
      return reply.code(401).send({
        error: "missing bearer token",
        detail: "Set ROSETTA_GITHUB_TOKEN in your MCP config. Get the token by completing the OAuth flow at /auth/github/login and visiting /auth/github/token.",
      });
    }

    const tokenHash = hashToken(token);
    const prisma = getPrisma();
    const contributor = await prisma.contributor.findFirst({ where: { oauth_token_hash: tokenHash } });
    if (!contributor) {
      return reply.code(401).send({
        error: "unknown bearer token",
        detail: "Token doesn't match any Contributor row. Either the OAuth login wasn't completed, or the token was rotated. Re-fetch from /auth/github/token.",
      });
    }

    // Decision J: new apps not allowed via /submit. Point contributors at the
    // standard-PR path (CONTRIBUTING.md path C) instead of leaving them stuck.
    if (!existsSync(appDir(app_id))) {
      return reply.code(400).send({
        error: "unknown app_id",
        detail: `registry/apps/${app_id}/ does not exist. /submit only adds shortcuts to existing apps; to add a new app, open a PR with meta.json + workflow.json + shortcuts.json + an index.json entry. See CONTRIBUTING.md § "Adding a new app".`,
      });
    }

    // Decision H: schema validation BEFORE reviewer.
    const validate = loadValidator();
    const ok = validate(shortcut_spec);
    if (!ok) {
      return reply.code(400).send({
        error: "schema validation failed",
        errors: validate.errors ?? [],
      });
    }

    // Reviewer.
    const review = await reviewSpec(shortcut_spec);
    const shortcutId = String((shortcut_spec as Record<string, unknown>).id ?? "unknown");
    if (review.verdict !== "passed") {
      const status = review.verdict === "rejected" ? "rejected" : "pending_review";
      await prisma.submission.create({
        data: {
          contributor_id: contributor.github_username,
          app_id,
          shortcut_id: shortcutId,
          pr_url: "",
          reviewer_verdict: review.verdict,
          reviewer_reason: review.reason,
          status,
        },
      });
      const code = review.verdict === "rejected" ? 400 : 202;
      return reply.code(code).send({
        verdict: review.verdict,
        reason: review.reason,
      });
    }

    // Reviewer passed → push the spec to GitHub and squash-merge.
    let pr;
    try {
      pr = await submitShortcut({
        app_id,
        shortcut_spec: shortcut_spec as Record<string, unknown>,
        contributor_token: token,
        contributor_username: contributor.github_username,
        reviewer_verdict: review.verdict,
        reviewer_reason: review.reason,
      });
    } catch (err) {
      const e = err as { status?: number; message?: string };
      req.log.error({ err }, "github.submitShortcut failed");
      // 422 = duplicate shortcut id; surface as a 409 to the contributor since
      // the conflict is on the resource state (the shortcut id already exists).
      if (e.status === 422) {
        return reply.code(409).send({
          error: "duplicate shortcut id",
          detail: e.message?.slice(0, 300),
        });
      }
      return reply.code(502).send({
        error: "github write failed",
        detail: (err as Error).message.slice(0, 300),
      });
    }

    await prisma.submission.create({
      data: {
        contributor_id: contributor.github_username,
        app_id,
        shortcut_id: shortcutId,
        pr_url: pr.pr_url,
        pr_commit_sha: pr.pr_commit_sha,
        reviewer_verdict: review.verdict,
        reviewer_reason: review.reason,
        status: "merged",
      },
    });
    await prisma.contributor.update({
      where: { github_username: contributor.github_username },
      data: { submission_count: { increment: 1 } },
    });

    return reply.send({
      pr_url: pr.pr_url,
      commit_sha: pr.pr_commit_sha,
    });
  });
}
