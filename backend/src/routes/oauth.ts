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
// GET /auth/github/token
//   Reads the rosetta_token cookie set by the callback, validates that
//   sha256(token) matches an existing Contributor row, and renders an
//   HTML page that displays the token plus setup instructions for
//   ROSETTA_GITHUB_TOKEN in the user's MCP config. Closes task #10:
//   without this, the OAuth-flow token sits in an httpOnly cookie that
//   the MCP can't read, so explorer-skill submissions fail 401.
//
// The raw token is returned to the user via a `rosetta_token` cookie
// (httpOnly, secure, SameSite=Lax). Hashed-token-only is the
// Postgres-side rule; the cookie is client-side and ephemeral.

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

  app.get("/auth/github/token", async (req, reply) => {
    const token = readTokenCookie(req.headers.cookie);
    if (!token) {
      reply.type("text/html");
      return reply.send(renderLoginRequiredPage());
    }
    const tokenHash = hashToken(token);
    const prisma = getPrisma();
    const contributor = await prisma.contributor.findFirst({
      where: { oauth_token_hash: tokenHash },
    });
    if (!contributor) {
      reply.type("text/html");
      return reply.send(renderInvalidTokenPage());
    }
    reply.type("text/html");
    return reply.send(renderTokenPage(token, contributor.github_username));
  });
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

function readTokenCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const piece of cookieHeader.split(";")) {
    const [k, ...rest] = piece.trim().split("=");
    if (k === TOKEN_COOKIE && rest.length > 0) {
      const value = rest.join("=");
      return value || null;
    }
  }
  return null;
}

// ---------- /auth/github/token HTML pages ----------

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}

function pageShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} — Rosetta</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="hero">
    <a href="/" class="wordmark">Rosetta</a>
    <h1 class="thesis" style="font-size: 2rem;">${escapeHtml(title)}</h1>
  </header>
  <main id="main">
${bodyHtml}
  </main>
  <footer>
    <p>Source: <a href="https://github.com/wesleyshe/Rosetta">github.com/wesleyshe/Rosetta</a> &middot; MIT</p>
  </footer>
</body>
</html>`;
}

function renderTokenPage(rawToken: string, username: string): string {
  const safeToken = escapeHtml(rawToken);
  const safeUser = escapeHtml(username);
  const body = `
    <section>
      <h2>Logged in as ${safeUser}</h2>
      <p>This is your GitHub OAuth token. The Rosetta MCP needs this in its
      env block to submit shortcuts on your behalf. Copy it and add it to
      your AI client's MCP config.</p>
    </section>

    <section>
      <h2>Your token</h2>
      <div class="copy-row">
        <button class="copy-btn" data-target="rosetta-token" aria-label="Copy token to clipboard" type="button">Copy</button>
      </div>
      <pre><code id="rosetta-token">${safeToken}</code></pre>
      <p class="status-note">Treat this like a password. Anyone with this token can submit shortcuts as you.</p>
    </section>

    <section>
      <h2>Set up your MCP config</h2>
      <p>Edit <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>
      (or your client's equivalent) and add <code>ROSETTA_GITHUB_TOKEN</code>
      to the rosetta env block:</p>
      <pre><code>"rosetta": {
  "command": "node",
  "args": ["/path/to/Rosetta/mcp/dist/index.js"],
  "env": {
    "ROSETTA_REGISTRY_PATH": "/path/to/Rosetta/registry",
    "ROSETTA_BACKEND_URL": "https://rosetta-production-e301.up.railway.app",
    "ROSETTA_GITHUB_TOKEN": "${safeToken}"
  }
}</code></pre>
      <p>Restart your AI client. The explorer skill's submission step will now
      land real PRs instead of dry-runs.</p>
    </section>

    <section>
      <h2>Done?</h2>
      <p>You can close this tab. The token stays valid until you revoke the
      Rosetta OAuth grant on
      <a href="https://github.com/settings/applications">github.com/settings/applications</a>.</p>
    </section>
  </main>
  <script>
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const target = document.getElementById(btn.dataset.target);
        try {
          await navigator.clipboard.writeText(target.textContent);
          const original = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(() => { btn.textContent = original; }, 1500);
        } catch {
          btn.textContent = "Copy failed";
        }
      });
    });
  </script>
  <footer style="display:none">`;
  return pageShell("Your GitHub Token", body);
}

function renderLoginRequiredPage(): string {
  const body = `
    <section>
      <h2>You need to log in first</h2>
      <p>This page shows you the GitHub OAuth token Rosetta uses to submit
      shortcuts on your behalf. To see it, log in via GitHub:</p>
      <p><a class="copy-btn" href="/auth/github/login" style="display: inline-block; text-decoration: none;">Log in with GitHub</a></p>
      <p>After GitHub redirects you back, return to
      <code>/auth/github/token</code> in this browser.</p>
    </section>`;
  return pageShell("Log In Required", body);
}

function renderInvalidTokenPage(): string {
  const body = `
    <section>
      <h2>Token mismatch</h2>
      <p>Your browser has a <code>rosetta_token</code> cookie, but it doesn't
      match any contributor record. This usually means the token was rotated
      after you last logged in, or the cookie is stale.</p>
      <p><a class="copy-btn" href="/auth/github/login" style="display: inline-block; text-decoration: none;">Log in with GitHub again</a></p>
    </section>`;
  return pageShell("Token Mismatch", body);
}
