// GET /apps/:app_id/skill.md — generated agent-context view.
//
// Per docs/architecture.md § "The skill.md endpoint", JSON is the source of
// truth and skill.md is rendered server-side from meta.json + workflow.json
// + a summary of shortcuts.json. Never authored directly.
//
// Template (mirrors the architecture.md sketch):
//
//   # {display_name} ({app_id})
//
//   {agent_primer}
//
//   ## Workflow
//
//   Default dispatch strategy: {default_dispatch_strategy joined}
//   Default verification: {verification_default}
//   Failure recovery (in order): {failure_recovery joined}
//
//   ## Intents available
//
//   - `{shortcut.id}` — {shortcut.intent} (reliability: {reliability_score or "unrated"})
//   - ...
//
//   Call `registry.lookup({app_id}, intent)` for the full action spec on any intent.
//
// Reliability score is "unrated" in v0; Phase 6b joins ShortcutStats here.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";

import { appDir } from "../paths.js";

interface MetaJson {
  display_name: string;
  agent_primer?: string;
}

interface WorkflowJson {
  default_dispatch_strategy?: string[];
  verification_default?: string;
  failure_recovery?: string[];
}

interface ShortcutJson {
  id: string;
  intent: string;
}

interface ShortcutsJson {
  shortcuts: ShortcutJson[];
}

const APP_ID_PATTERN = /^[a-z0-9_-]+$/;

export async function skillMdRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { app_id: string } }>(
    "/apps/:app_id/skill.md",
    async (req, reply) => {
      const { app_id } = req.params;
      if (!APP_ID_PATTERN.test(app_id)) {
        return reply.code(400).send({ error: "invalid app_id" });
      }

      const dir = appDir(app_id);
      let meta: MetaJson;
      let workflow: WorkflowJson;
      let shortcuts: ShortcutsJson;
      try {
        const [m, w, s] = await Promise.all([
          readFile(join(dir, "meta.json"), "utf8"),
          readFile(join(dir, "workflow.json"), "utf8"),
          readFile(join(dir, "shortcuts.json"), "utf8"),
        ]);
        meta = JSON.parse(m) as MetaJson;
        workflow = JSON.parse(w) as WorkflowJson;
        shortcuts = JSON.parse(s) as ShortcutsJson;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT") return reply.code(404).send({ error: `app not found: ${app_id}` });
        req.log.error({ err, app_id }, "skill.md read/parse failed");
        return reply.code(500).send({ error: "failed to read app spec files" });
      }

      const md = renderSkillMd(app_id, meta, workflow, shortcuts);
      reply.header("content-type", "text/markdown; charset=utf-8");
      return md;
    }
  );
}

export function renderSkillMd(
  app_id: string,
  meta: MetaJson,
  workflow: WorkflowJson,
  shortcuts: ShortcutsJson
): string {
  const dispatch = (workflow.default_dispatch_strategy ?? []).join(", ") || "—";
  const verification = workflow.verification_default ?? "—";
  const recovery = (workflow.failure_recovery ?? []).join(", ") || "—";

  const intentLines = shortcuts.shortcuts.map(
    (s) => `- \`${s.id}\` — ${s.intent} (reliability: unrated)`
  );

  return [
    `# ${meta.display_name} (${app_id})`,
    "",
    meta.agent_primer ?? "",
    "",
    "## Workflow",
    "",
    `Default dispatch strategy: ${dispatch}`,
    `Default verification: ${verification}`,
    `Failure recovery (in order): ${recovery}`,
    "",
    "## Intents available",
    "",
    ...intentLines,
    "",
    `Call \`registry.lookup(${app_id}, intent)\` for the full action spec on any intent.`,
    "",
  ].join("\n");
}
