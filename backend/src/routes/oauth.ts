// Classic GitHub OAuth flow per kickoff decision E.
//
// GET /auth/github/login
//   Redirects to https://github.com/login/oauth/authorize with our
//   client_id, scope=public_repo (we need to author PRs as the user
//   against this public repo), and a CSRF state cookie.
//
// GET /auth/github/callback?code=...&state=...
//   Exchanges the code for an access_token, fetches the contributor's
//   GitHub username, sha256-hashes the raw token, upserts the
//   Contributor row keyed by github_username, then redirects back to /
//   with ?login=ok&user={username} (no UX polish — that's parking-lot 2).
//
// The raw token is returned to the user via a `rosetta_token` cookie
// (httpOnly, secure, SameSite=Lax) so the static site's submit-from-MCP
// flow can grab it via `document.cookie` if/when that's wired in. v0
// users mostly submit via the MCP and pass the token explicitly; the
// cookie is a convenience. Hashed-token-only is the Postgres-side rule;
// the cookie is client-side and ephemeral.

import { randomBytes } from "node:crypto";

import type { FastifyInstance, FastifyReply } from "fastify";

import { getPrisma } from "../db.js";
import { hashToken } from "../auth.js";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

interface GithubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GithubUserResponse {
  login: string;
  id: number;
}

export async function oauthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/github/login", async (req, reply) => {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) {
      return reply.code(500).send({ error: "GITHUB_OAUTH_CLIENT_ID not set" });
    }

    const state = randomBytes(16).toString("hex");
    setStateCookie(reply, state);

    const url = new URL(GITHUB_AUTHORIZE_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("scope", "public_repo");
    url.searchParams.set("state", state);
    const cb = process.env.GITHUB_OAUTH_REDIRECT_URI;
    if (cb) url.searchParams.set("redirect_uri", cb);

    return reply.redirect(url.toString());
  });

  app.get<{ Querystring: { code?: string; state?: string } }>(
    "/auth/github/callback",
    async (req, reply) => {
      const { code, state } = req.query;
      if (!code) return reply.code(400).send({ error: "missing code" });

      const expectedState = readStateCookie(req.headers.cookie);
      if (!state || !expectedState || state !== expectedState) {
        return reply.code(400).send({ error: "state mismatch" });
      }
      clearStateCookie(reply);

      const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return reply.code(500).send({ error: "GITHUB_OAUTH_* env not set" });
      }

      let tokenJson: GithubTokenResponse;
      try {
        const r = await fetch(GITHUB_TOKEN_URL, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, state }),
        });
        tokenJson = (await r.json()) as GithubTokenResponse;
      } catch (err) {
        req.log.error({ err }, "github token exchange failed");
        return reply.code(502).send({ error: "github token exchange failed" });
      }
      if (tokenJson.error || !tokenJson.access_token) {
        return reply.code(400).send({
          error: "github oauth rejected",
          detail: tokenJson.error_description ?? tokenJson.error ?? "no access_token",
        });
      }
      const rawToken = tokenJson.access_token;

      let user: GithubUserResponse;
      try {
        const r = await fetch(GITHUB_USER_URL, {
          headers: {
            authorization: `Bearer ${rawToken}`,
            "user-agent": "rosetta-backend",
            accept: "application/vnd.github+json",
          },
        });
        if (!r.ok) {
          return reply.code(502).send({ error: `github /user returned ${r.status}` });
        }
        user = (await r.json()) as GithubUserResponse;
      } catch (err) {
        req.log.error({ err }, "github /user fetch failed");
        return reply.code(502).send({ error: "github /user fetch failed" });
      }

      const tokenHash = hashToken(rawToken);
      const prisma = getPrisma();
      await prisma.contributor.upsert({
        where: { github_username: user.login },
        update: { oauth_token_hash: tokenHash },
        create: { github_username: user.login, oauth_token_hash: tokenHash },
      });

      setTokenCookie(reply, rawToken);
      return reply.redirect(`/?login=ok&user=${encodeURIComponent(user.login)}`);
    }
  );
}

// ---------- cookie plumbing ----------

const STATE_COOKIE = "rosetta_oauth_state";
const TOKEN_COOKIE = "rosetta_token";
const COOKIE_MAX_AGE_SECS = 60 * 60 * 24 * 30; // 30 days

function setStateCookie(reply: FastifyReply, state: string): void {
  reply.header(
    "set-cookie",
    `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );
}

function clearStateCookie(reply: FastifyReply): void {
  reply.header(
    "set-cookie",
    `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

function setTokenCookie(reply: FastifyReply, token: string): void {
  // Append (don't replace) so the state-cookie clear above survives.
  const existing = reply.getHeader("set-cookie");
  const next = `${TOKEN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECS}`;
  if (Array.isArray(existing)) {
    reply.header("set-cookie", [...existing, next]);
  } else if (typeof existing === "string") {
    reply.header("set-cookie", [existing, next]);
  } else {
    reply.header("set-cookie", next);
  }
}

function readStateCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const piece of cookieHeader.split(";")) {
    const [k, v] = piece.trim().split("=");
    if (k === STATE_COOKIE && v) return v;
  }
  return null;
}
