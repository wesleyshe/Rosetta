// Static-file serving for Rosetta. Replicates the layout that
// scripts/dev-server.mjs already uses (site/ at /, registry/ at /registry/),
// so the website's absolute-path fetches keep working in production.
//
// Mounted via two @fastify/static registrations:
//   1. /registry/* → <repo>/registry/*  (raw spec JSON, served verbatim)
//   2. /*          → <repo>/site/*      (HTML, CSS, JS, seed-skill markdown)
//
// The second registration uses `decorateReply: false` because Fastify
// disallows double-decorating reply.sendFile.
//
// Dynamic routes (e.g. GET /apps/:app_id/skill.md) are registered separately
// in routes/* and take precedence — Fastify matches explicit routes before
// the static wildcard.

import staticPlugin from "@fastify/static";
import type { FastifyInstance } from "fastify";

import { REGISTRY_DIR, SITE_DIR } from "./paths.js";

export async function registerStatic(app: FastifyInstance): Promise<void> {
  await app.register(staticPlugin, {
    root: REGISTRY_DIR,
    prefix: "/registry/",
  });

  await app.register(staticPlugin, {
    root: SITE_DIR,
    prefix: "/",
    decorateReply: false,
    index: ["index.html"],
  });
}
