# CUBE website caretaker architecture

The current public site remains online while the GitHub and Cloudflare Pages copy is prepared. The intended production path is:

1. GitHub stores this repository and runs validation and scheduled health checks.
2. Cloudflare Pages deploys `dist/` whenever `main` changes.
3. The caretaker checks HTTP status, expected content, response time and TLS expiry.
4. A confirmed failure creates one GitHub incident and sends one Telegram alert.
5. Gemini supplies a sanitized diagnosis when its free API is available.
6. A rollback is permitted only after three confirmed failures, for a commit under 24 hours old, when every changed path is inside `dist/`, no pause label exists and the six-hour cooldown is clear.
7. Recovery closes the incident and sends a recovery message.

AI does not receive secrets and cannot change DNS, billing, databases, GitHub workflows or caretaker policy. Code-fix pull requests are intentionally deferred until the rollback and alert path has been proven reliable.

## Safety controls

- Add `pause-agent` to any open issue to stop diagnosis and repair actions while health checks continue.
- The workflow never force-pushes or disables checks.
- The current release opens fix work for review; it does not auto-merge AI patches.
- Workflow dispatch simulations default to dry-run mode.
