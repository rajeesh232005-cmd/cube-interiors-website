# CUBE Innovative Interior Solution

Static website and zero-cost caretaker configuration for CUBE Interiors.

## Owner guides

- [How to update website images](docs/IMAGE-UPDATES.md)
- [Set up the Discord website manager](docs/WEBSITE-MANAGER-SETUP.md)
- [Production readiness check](docs/PRODUCTION-CHECKLIST.md)

## One-time setup

1. Create a GitHub repository and push this project.
2. Create a Cloudflare Pages project connected to that repository. Use no build command and set the output directory to `dist`.
3. In GitHub **Settings → Secrets and variables → Actions**, add:
   - `DISCORD_WEBHOOK_URL`
   - `GEMINI_API_KEY`
   - Optional Telegram fallback: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
4. Optionally add the repository variable `GEMINI_MODEL`; the default is `gemini-2.5-flash-lite`.
5. In **Actions**, run **Validate caretaker**.
6. Run **Website caretaker** with each simulation. Leave **dry_run** enabled.
   To verify notifications without creating an incident, enable **send_test_alert**.
7. After Cloudflare Pages is live, replace the URL in `config/sites.json` and `RUNBOOK.md` with the Cloudflare or custom-domain URL.
8. Disable the existing ChatGPT Site only after the replacement has passed all checks.

## Monthly check (about 10 minutes)

- Confirm the scheduled workflow ran during the last 24 hours.
- Run one dry-run `down` simulation.
- Confirm Discord alerts and Gemini free-tier quotas remain available.
- Review open incidents and dependency updates.

## Known limits

- GitHub scheduled workflows can be delayed or dropped during high load.
- Public-repository schedules are disabled after 60 days without repository activity.
- Gemini free-tier prompts and responses may be used by Google to improve its products; only sanitized public website information is sent.
- Automatic repair is currently limited to safe rollback. AI-generated code changes are not auto-merged.
