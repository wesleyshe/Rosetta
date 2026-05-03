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
   the fetch returns 404, network-errors, or times out, proceed without it —
   the endpoint is a Phase 6a deliverable and may not exist yet. In that case
   you have no `agent_primer`; rely on step 5's wildcard lookup to learn what
   intent strings already exist for this app, and infer terminology from those
   strings plus your own knowledge of the app. (v0 limitation; Phase 6a
   graduates this.)
5. Call `registry.lookup(app_id, "*")` to confirm what's already mapped in the
   live registry. Don't re-submit existing shortcuts. In pre-backend mode this
   doubles as your existing-capabilities orientation when step 4 degraded.
6. Research the app freely within your remaining budget. Use any combination of:
   - Web search for official documentation, keyboard shortcut cheat sheets,
     forum threads, and changelogs.
   - The app's own help system, command palette, or settings menus.
   - `os.screenshot()` to inspect UI state visually.
   - `os.read_ax_tree()` to inspect accessibility structure.
   - Manual menu walking to capture shortcuts shown next to menu items.
   - Official keyboard reference cards from the vendor's site.
7. For each candidate capability, draft a shortcut spec following the schema in
   this document. Required fields: id, intent, parameters, platforms,
   app_versions, method, actions, verification, metadata.
8. Execute the draft shortcut once and run its verification. If `verify`
   returns `error_class: "ax_rule_not_implemented"`, apply the same inline
   fallback the use skill uses (step 7b in that skill): screenshot +
   `interpret` with a yes/no question synthesized from the shortcut's intent.
   Treat the yes/no answer as the verification result for save_finding
   purposes. Save the finding locally via `explore.save_finding({
   shortcut_spec, status })`:
   - `status: "verified"` if the shortcut ran and verification passed
     (including a fallback-yes outcome).
   - `status: "rejected_by_self"` if the shortcut failed verification — this
     covers (i) any real `passed: false` from `verify` (e.g.
     `verification_mismatch`, `file_not_found`, `interpret_mismatch`),
     (ii) a fallback-no outcome from the ax_rule_not_implemented path, and
     (iii) candidates that have no clean keyboard or accessibility path at
     all. Capture the reason in `verification_log`. Do not submit rejected
     findings; record them so future resumes don't re-attempt the same dead
     ends.
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
