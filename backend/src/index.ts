// Fastify bootstrap for the Rosetta backend.
//
// Phase 6a/6b registers:
//   - GET  /healthz                       (liveness)
//   - GET  /apps/{app_id}/skill.md         (generated agent-context view)
//   - GET  /auth/github/login             (OAuth start)
//   - GET  /auth/github/callback          (OAuth finish)
//   - GET  /auth/github/token             (post-login: display the token + setup instructions)
//   - POST /submit                        (auth + reviewer + auto-merge)
//   - POST /report-execution              (telemetry; recomputes ShortcutStats inline)
//   - GET  /lookup                        (joins specs on disk with live stats; ranked)
//   - static handlers for site/ and registry/ (registerStatic, registered last
//     so explicit routes win)

import Fastify from "fastify";

import { registerStatic } from "./static.js";
import { skillMdRoute } from "./routes/skill_md.js";
import { oauthRoutes } from "./routes/oauth.js";
import { submitRoute } from "./routes/submit.js";
import { reportRoute } from "./routes/report.js";
import { lookupRoute } from "./routes/lookup.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = "0.0.0.0";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "*.token",
        "*.api_key",
        "*.client_secret",
        "*.oauth_token",
        "*.password",
      ],
      censor: "[REDACTED]",
    },
  },
  bodyLimit: 256 * 1024,
});

app.get("/healthz", async () => ({ ok: true, service: "rosetta-backend" }));

await app.register(skillMdRoute);
await app.register(oauthRoutes);
await app.register(submitRoute);
await app.register(reportRoute);
await app.register(lookupRoute);
await app.register(registerStatic);

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info({ port: PORT }, "rosetta backend listening");
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
