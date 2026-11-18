# CUBE website runbook

## Public website

Current URL: https://cube-interiors-website.pages.dev/

Expected text: `CUBE`

## Safe scope

The caretaker may automatically revert a recent commit only when that commit changes files under `dist/` and all rollback conditions pass. It must escalate every other change.

## Contacts

Discord alerts are delivered through the `DISCORD_WEBHOOK_URL` repository secret. Telegram remains an optional fallback. Do not put webhook URLs, bot tokens, chat IDs or API keys in this file.

## Temporary form test

The enquiry form currently sends to `zestyneo@gmail.com` for testing. Restore it to `cubeinteriorsukl@gmail.com` only after the owner confirms testing is finished.
