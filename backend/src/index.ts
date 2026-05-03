// Fastify bootstrap for the Rosetta backend.
//
// Phase 6a Part A registers:
//   - GET /healthz                       (liveness)
//   - GET /apps/{app_id}/skill.md         (generated agent-context view)
//   - static handlers for site/ and registry/ (registerStatic)
//
// Phase 6a Part B will register: GET/POST /auth/github/* (OAuth) and POST /submit.
// Phase 6b will register: POST /report-execution and GET /lookup.

import Fastify from "fastify";

import { registerStatic } from "./static.js";
import { skillMdRoute } from "./routes/skill_md.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = "0.0.0.0";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

app.get("/healthz", async () => ({ ok: true, service: "rosetta-backend" }));

await app.register(registerStatic);
await app.register(skillMdRoute);

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info({ port: PORT }, "rosetta backend listening");
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
