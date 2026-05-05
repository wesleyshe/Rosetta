# Railway setup

One-page user guide for provisioning the Rosetta backend on [Railway](https://railway.com). Read top to bottom; do each step in order. The agent does not click around in Railway — that's why this exists. Once Postgres is up and the env vars are set, push to `main` and Railway redeploys automatically.

## 1. Create the project

1. Sign in at https://railway.com.
2. **New Project → Deploy from GitHub repo**, pick `wesleyshe/Rosetta`.
3. **Leave Root Directory empty** (or explicitly set to repo root). Do NOT set it to `backend/`. Railway reads the repo-root `railway.json` to find the Dockerfile, and the build context spans the whole repo so `site/` and `registry/` end up in the runtime image as siblings of `backend/dist/`.
4. As of 2026-05-05 the build uses a hand-written `Dockerfile` (parking-lot 7) instead of Nixpacks. The Dockerfile accepts NO secrets at build time — Nixpacks previously baked every project env var into image layers as ARG/ENV directives. Runtime secrets are injected to the running container at deploy time, the way they should be.
5. Wait for the first deploy. It will fail until step 2 is done — that's expected; Prisma needs `DATABASE_URL`.

## 2. Add the Postgres add-on

1. In the project, **+ New → Database → PostgreSQL**.
2. Once provisioned, open the Postgres service's **Variables** tab and copy the value of `DATABASE_URL` (the internal one is fine for the backend; the public one is what you'll use from your laptop in step 4).
3. In the **backend** service's **Variables** tab, click **+ New Variable** and reference Postgres directly: name `DATABASE_URL`, value `${{Postgres.DATABASE_URL}}` (Railway resolves this at deploy time). Cross-service references are stable across redeploys.

## 3. Set the rest of the env vars

In the **backend** service's **Variables** tab, add (see `.env.example` for descriptions):

| Variable                        | Where to get it                                                                                            |
|---------------------------------|------------------------------------------------------------------------------------------------------------|
| `DATABASE_URL`                  | Step 2 above (`${{Postgres.DATABASE_URL}}`).                                                               |
| `GITHUB_OAUTH_CLIENT_ID`        | github.com → Settings → Developer settings → OAuth Apps → New OAuth App. Callback URL: `https://<your-railway-domain>/auth/github/callback`. |
| `GITHUB_OAUTH_CLIENT_SECRET`    | Same OAuth App page; click **Generate a new client secret**.                                               |
| `GITHUB_REPO_OWNER`             | `wesleyshe` (the org/user that owns the spec repo).                                                        |
| `GITHUB_REPO_NAME`              | `Rosetta`.                                                                                                 |
| `ANTHROPIC_API_KEY`             | console.anthropic.com → API keys.                                                                          |
| `ROSETTA_REVIEWER_MODEL`        | Optional. Defaults to `claude-sonnet-4-6` (decision G).                                                     |
| `PORT`                          | Railway sets this automatically. Don't set it yourself.                                                    |

## 4. Use the same Postgres in local dev (decision D)

Single source of truth, no parity issues. From the Postgres service's **Variables** tab, copy the public `DATABASE_URL` (the one with the proxy host, not `*.railway.internal`) and put it in `backend/.env` locally:

```
DATABASE_URL=postgresql://postgres:...@<proxy-host>.railway.app:<port>/railway
```

Then:

```
cd backend
npm install
npm run prisma:deploy      # creates / syncs tables with schema (prisma db push)
npm run dev                # starts Fastify on http://localhost:3000
```

`prisma:deploy` runs `prisma migrate resolve --applied 20260505_init; prisma migrate deploy`. As of 2026-05-05 the backend uses versioned migrations (parking-lot 12). The first half of the script is the cutover baseline — it marks the initial migration as already-applied without running it, since the live tables already exist from the pre-cutover `db push` era. After the first deploy that includes this script, the resolve call becomes a no-op (it errors "already applied", stderr is suppressed, the `;` chains forward to `migrate deploy`).

For schema changes going forward, edit `prisma/schema.prisma`, then from `backend/`:

```
DATABASE_URL=postgresql://... npx prisma migrate dev --name <description>
```

This creates a new migration directory under `prisma/migrations/`, applies it to your local DB, and writes the SQL. Commit the migration directory. The next deploy runs `prisma migrate deploy` which applies it on Railway's Postgres in order.

Local writes go to the same Postgres the deployed backend uses. Acceptable in v0; revisit if local dev needs to be safely isolated.

## 5. Auto-deploy on push to `main`

Already on by default when Railway is connected to GitHub. Verify under the backend service's **Settings → Source → Auto Deploy → Branches → `main`**. Every merge to `main` triggers a redeploy in about a minute.

After the 2026-05-05 Dockerfile cutover, the first deploy on a fresh Railway service may still show the old Nixpacks build cached. Clear it with **Settings → Source → Redeploy** if you see Nixpacks in the build logs after the cutover. Builds should now show `[+] Building ...` (BuildKit) and zero `SecretsUsedInArgOrEnv` warnings.

## 6. Smoke check

Once the first successful deploy lands:

- `https://<your-railway-domain>/healthz` → `{ "ok": true, "service": "rosetta-backend" }`
- `https://<your-railway-domain>/` → the static landing page from `site/index.html`.
- `https://<your-railway-domain>/registry/index.json` → the registry index served from `registry/`.
- `https://<your-railway-domain>/apps/vscode/skill.md` → the generated VS Code skill.md (markdown content-type).

The same domain handles GitHub login and shortcut submissions; no further Railway config needed beyond steps 1-3 above.

## Constraints / caveats

- **New apps via `/submit` are out of scope for v0** (decision J). Submissions append to an existing app's `shortcuts.json`. Adding a new app (creating `meta.json` + `workflow.json` + `shortcuts.json`) requires a manual PR. `/submit` returns 400 if the target `app_id` has no folder under `registry/apps/`.
- **OAuth is classic GitHub OAuth App, not GitHub App** (decision E). The contributor authorises the backend to act on their behalf; the backend uses their token to author PRs as them.
- **Auto-merge is an explicit API call** (decision F), not GitHub's "auto-merge when checks pass" feature. The reviewer's verdict is treated as authoritative; merge is immediate, squash-style.
- **Reviewer is shallow by design** (parking-lot 6). Phase 6a defends against the obvious; it does not sandbox or sign skills. Full defense suite remains parked until ~100 contributors / 1,000 skills, or the first incident.
