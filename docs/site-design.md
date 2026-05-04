# Site Design (v0)

Lightweight precursor to the Phase 7b UI/UX implementation pass. Records the design intent before HTML / CSS lands so the implementation has a target to hit.

Scope: human-facing pages only (`site/index.html`, `site/app.html`, `site/style.css`). Machine-readable surfaces are out of scope and untouched: registry JSON, the agent-facing `skill.md` endpoint, the seed-skill text files (`site/seed-skills/use.md` and `explore.md`), and the MCP tool surface.

Reference: [railway.com](https://railway.com) for color treatment, spacing, density, and overall feel. Editorial typography on top of that base distinguishes the registry without making it precious.

---

## Goals

1. **In 5 seconds:** confirm what Rosetta is to a sophisticated reader (AI engineer, AI-company evaluator, power user).
2. **In 30 seconds:** install command + paste-ready seed skills.
3. **Browseable:** the apps registry with per-shortcut reliability surfaced as a load-bearing UX signal.
4. **Linkable:** GitHub source, license, version.

Not in scope: onboarding non-technical audiences, SaaS-style sales copy, schema documentation (lives in `docs/`), search / filter on the registry (deferred), app icons (no contributor pipeline yet), analytics, cookie banners, i18n.

---

## Visual anchor

Light mode default. Dark mode auto via `prefers-color-scheme`. Single column, max-width ~760px, generous vertical rhythm. Confident, undecorated, evidence-led. Match the pitch deck's tone: short declarative sentences, no fluff, no apologetic hedging.

## Typography

Editorial split. Serif for headings, sans for body, modern monospace for code.

- **Headings:** [Newsreader](https://fonts.google.com/specimen/Newsreader) (Google Fonts, free, optical-sized). Warm, modern serif. Reads well from 14px (small caps in metadata) to 56px (hero).
- **Body:** [Inter](https://rsms.me/inter/) (free, ubiquitous). Neutral sans, weight range 400-600 covers everything.
- **Code:** [Geist Mono](https://vercel.com/font) (free). Pairs cleanly with Inter.
- **Fallback:** system font stack first to avoid FOIT (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` for body; `ui-monospace, SFMono-Regular, Menlo` for code). Web fonts load async via `font-display: swap`.

## Color palette

Inspired by Railway's accent treatment (deep violet on near-monochrome ground), with a small warm amber accent reserved for "new / cold-start" and other Rosetta-stone hints.

**Light mode (default):**
- `--bg`: `#FAFAF7` (warm near-white)
- `--surface`: `#FFFFFF`
- `--fg`: `#1A1A1A`
- `--muted`: `#6B6B6B`
- `--border`: `#E5E5E0`
- `--accent`: `#7C5BFF` (violet, Railway-adjacent)
- `--accent-hover`: `#6845E8`
- `--code-bg`: `#F5F5F2`
- `--success`: `#2F8F3F` (warm shortcuts, high reliability)
- `--cold`: `#B8860B` (cold-start "new" badge, warm amber)
- `--error`: `#C0392B`

**Dark mode (auto):**
- `--bg`: `#0F0F0E`
- `--surface`: `#16161A`
- `--fg`: `#F5F5F2`
- `--muted`: `#888888`
- `--border`: `#2A2A28`
- `--accent`: `#9B7FFF`
- `--accent-hover`: `#B59FFF`
- `--code-bg`: `#16161A`
- `--success`: `#4FB04F`
- `--cold`: `#D4A04F`

## Page layout: `index.html`

Single column. Sections, in order:

1. **Hero.** Rosetta wordmark (Newsreader, ~32px, accent color). Thesis line below in Newsreader ~44px: *"Make every software, every website, every desktop app agentic."* Sub in Inter ~18px muted: one-sentence elaboration ("Community registry of skills that lets any MCP-capable AI client drive desktop apps without per-app integration.").
2. **Install.** H2 "Install". Single-line code block with copy button: `npx @rosetta-skills/mcp`. Small status note below if pre-launch.
3. **Use skill.** H2 with subtitle "(no auth required)". Short prose paragraph. Copyable text block (full seed skill loaded from `/seed-skills/use.md`).
4. **Explore skill.** H2 with subtitle "(GitHub OAuth required to submit)". Short prose. Copyable text block from `/seed-skills/explore.md`.
5. **Apps in the registry.** H2. Card grid (2 columns on desktop, 1 on mobile). Each card: app display name (Newsreader), platform badges, skill count, last-updated date. Card is fully clickable, leads to `app.html?app=<id>`.
6. **Footer.** GitHub link, MIT, schema version.

## Page layout: `app.html`

1. **Back link** to home (small, muted).
2. **App header.** Display name in Newsreader ~36px. Meta line below in Inter muted: `app_id` · platforms · category · search-first marker.
3. **Tabs.** Human view (default) / Raw JSON. Tab styling: underline-active, no boxed pills.
4. **Human view:**
   - Agent primer (markdown-rendered, body type).
   - Workflow summary as key-value rows (default dispatch strategy, default verification, failure recovery in order).
   - Shortcut list. Each row:
     - Intent (Newsreader, ~18px).
     - Tag row: method (`shortcut`, `search`, `menu`), verification type, platforms.
     - Reliability cell (see below).
     - Footer line: `~Xms` · `~Y tokens` · contributor handle.
5. **Raw JSON view:** unchanged from today (collapsible code blocks per file).

## Reliability surfacing

Each shortcut on the app page gets a small reliability cell to the right of (or below) its intent.

- **Warm** (`reliability_score` not null): percentage rendered in `--success` next to a thin horizontal bar filled to that percentage. Underneath, small muted text: `n=<use_count>`.
- **Cold-start** (`reliability_score` null OR `cold_start: true`): a small "new" badge in `--cold` color, no percentage, no bar.

Sort the shortcut list: warm shortcuts first (by `reliability_score` desc), cold-start shortcuts after (in document order).

## Copy tone

Lift directly from the pitch deck. Confident, evidence-based, declarative. Examples:

- Hero subtitle: "Community registry of skills that lets any MCP-capable AI client drive desktop apps without per-app integration."
- Install section intro: "Run the MCP locally. One command."
- Use skill intro: "Paste this into your AI client. Your agent gains the ability to use shortcuts from the registry."
- Explore skill intro: "Paste this to give your agent the ability to map a new app and contribute shortcuts back."
- Apps section intro: "Apps in the registry, ordered by last update."

Avoid: "we plan to," "coming soon," "TBD," "v0 not yet published," and similar hedges. Status badges, when needed, go in small muted type below the relevant section, not in the hero.

## Mobile

Single column already scales. No mobile-specific layout needed at this max-width. Confirm `viewport` meta is set, body padding scales down (~1rem) below 600px. Tap targets 44px minimum.

## Accessibility

- WCAG AA contrast minimum on all foreground / background pairs.
- Focus indicators visible on all interactive elements (copy buttons, tabs, links).
- Semantic HTML: `<nav>`, `<main>`, `<article>` for app cards, `<footer>`. Skip-to-content link in the body's first child.
- ARIA labels on copy buttons that announce target ("Copy use-skill text to clipboard").
- Markdown rendering in `agent_primer` keeps heading semantics (h2/h3) so screen readers can navigate.

## Implementation notes

- `style.css` full rewrite, ~250-350 lines. CSS custom properties carry the palette. No preprocessor.
- `index.html` and `app.html` structure stays similar to current; class names rename to match the design vocabulary; markup gets minor restructure for the hero / card / reliability cell.
- Web fonts `@import`ed at the top of style.css. `font-display: swap` to prevent blocking.
- No build step, no JS framework.
- Keep the existing JS in `index.html` and `app.html` (dynamic loading of seed skills, app list, registry JSON). Restyle the rendered output, not the rendering logic.

## What does NOT change

- The seed skill text files (`use.md`, `explore.md`) are agent-facing canonical content. Untouched.
- The `skill.md` endpoint generation in `backend/`. Untouched.
- The registry JSON schemas and any app's authored data. Untouched.
- The MCP tool surface and behaviors. Untouched.
- The `agent_primer` content in any `meta.json`. Untouched.

## Out-of-scope follow-ups

- Search / filter on the apps list (when registry exceeds ~30 apps).
- App icons (needs contributor-side icon pipeline).
- Per-app reliability sparklines (when there's enough telemetry to be meaningful).
- Dark-mode toggle (auto via `prefers-color-scheme` is enough for v0).
- Animation beyond hover state transitions.
- Tracked under parking-lot 2 successors.
