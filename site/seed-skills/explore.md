You have access to the `rosetta` MCP server. The user wants you to map an
application's capabilities and contribute new shortcuts to the registry. Use
whatever methods are available to you to discover how the app works. Sessions
are budget-bounded and resumable; do not start over each time. Follow this
protocol:

1. Confirm the target app, the budget (in wall-clock minutes; default 30 if not
   given), and the GitHub account that will receive credit for submissions. The
   user must have a connected GitHub OAuth session.
2. Call `os.app_info(app_name)` to detect version and platform.
3. Call `explore.start_session({ app_id, budget_minutes })`. If `resumed: true`,
   read `previously_completed_intents` and `previously_abandoned_intents` from
   the response and DO NOT re-explore those areas. Continue where you left off.
4. Fetch `apps/{app_id}/skill.md` (the agent_primer + workflow + existing-shortcuts
   summary). Read it. This is your orientation document. **Best-effort:** if
   the fetch returns 404, network-errors, or times out, proceed without it.
   In that case you have no `agent_primer`; rely on step 5's wildcard lookup
   to learn what intent strings already exist for this app, and infer
   terminology from those strings plus your own knowledge of the app.
5. Call `registry.lookup(app_id, "*")` to confirm what's already mapped in the
   live registry. Don't re-submit existing shortcuts. If step 4 degraded
   (skill.md fetch failed), this doubles as your existing-capabilities
   orientation.
6. Research the app freely within your remaining budget. Use any combination of:
   - Web search for official documentation, keyboard shortcut cheat sheets,
     forum threads, and changelogs.
   - The app's own help system, command palette, or settings menus.
   - `os.screenshot()` to inspect UI state visually. Pass `{ region: "frontmost_window" }` when only the target app's window matters — smaller payload, less noise from menubar / desktop / other apps.
   - `os.read_ax_tree()` to inspect accessibility structure.
   - Manual menu walking to capture shortcuts shown next to menu items.
   - Official keyboard reference cards from the vendor's site.
7. For each candidate capability, draft a shortcut spec following the schema in
   this document. Required top-level fields: `id`, `intent`, `parameters`,
   `platforms`, `app_versions`, `method`, `actions`, `verification`, `metadata`.
   The `metadata` object MUST include all five required sub-fields: `contributor_id`
   (the user's GitHub username from step 1), `payment_destination` (always `null`
   in v0; the field is reserved for the future payment economy and must be
   present), `token_cost_estimate` (integer, your best guess of input+output
   tokens to run this shortcut), `speed_estimate_ms` (integer, wall-clock ms
   from action start to verification pass), and `submitted_at` (today's date
   in YYYY-MM-DD). Submissions that omit any of these fail ajv validation at
   `/submit` time.
8. Execute the draft shortcut once and run its verification. If `verify`
   returns `passed: null` with `error_class: "agent_must_judge"` (the
   interpret_check shape — see use-skill step 7b), the result carries an
   attached screenshot; look at it with your native vision and judge the
   yes/no question against the `expected` value. If `verify` returns
   `passed: false` with `error_class: "ax_rule_not_implemented"`, apply the
   same inline AX-rule fallback the use skill uses (step 7c in that skill):
   `os.screenshot()` and a yes/no question synthesized from the shortcut's
   intent, judged with your own vision. Treat the yes/no answer as the
   verification result for save_finding purposes. Save the finding locally
   via `explore.save_finding({ shortcut_spec, status })`:
   - `status: "verified"` if the shortcut ran and verification passed
     (including a yes-judgment outcome).
   - `status: "rejected_by_self"` if the shortcut failed verification — this
     covers (i) any real `passed: false` from `verify` (e.g.
     `verification_mismatch`, `file_not_found`, `interpret_mismatch`),
     (ii) a no-judgment from the agent_must_judge path,
     (iii) a no-judgment from the ax_rule_not_implemented fallback path,
     and (iv) candidates that have no clean keyboard or accessibility path
     at all. Capture the reason in `verification_log`. Do not submit
     rejected findings; record them so future resumes don't re-attempt the
     same dead ends.
   - `status: "drafted"` only as a transient state during reasoning. Always
     update to `verified` or `rejected_by_self` before moving on.
9. Periodically call `explore.budget_status()`. When `should_stop_discovering`
   flips to `true`, stop drafting new shortcuts and proceed to step 10.
10. Call `explore.submit_findings({ app_id })`. This batches all `verified`
    findings into `registry.submit` calls. Each becomes a PR that auto-merges
    once the backend's reviewer passes it. The local session file records the
    PR URL and merged commit SHA per finding.
11. Report a summary to the user: total findings, verified count, submitted
    count, PR links, abandoned intents with reasons, and remaining budget. If
    the session ended on budget exhaustion, note that the user can run the
    explore skill again on the same app and you'll resume from this point.

If a candidate capability has no clean keyboard or accessibility path, mark it
`rejected_by_self` with reason rather than submitting a fragile shortcut. Prefer
search-first methods (command palette, app search bars) when the app supports
them, since they are the most resistant to UI changes.
