# site/

Static website source. Vanilla HTML/CSS/JS, no framework. Served by the Railway backend at https://rosetta-production-e301.up.railway.app — the backend exposes this folder as static assets alongside the API.

Two views per app (human-readable + raw JSON), two copy-to-clipboard boxes for the seed skills (use + explore). Seed-skill text files live under `seed-skills/use.md` and `seed-skills/explore.md`. Design notes live in [`../docs/site-design.md`](../docs/site-design.md).

To preview locally:

```sh
python3 -m http.server 8123
# open http://localhost:8123
```

Some fetches assume backend-served absolute paths (`/registry/...`, `/auth/github/...`); those won't resolve under a plain static server. Run the backend locally if you need full fidelity.
