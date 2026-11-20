# CUBE Website Manager setup

The private manager is available at:

<https://cube-interiors-website.pages.dev/manage.html>

It uses Discord sign-in and grants access only when the signed-in member has the
configured `site management` role. The manager never reads Discord messages or
channels. It requests only identity and the member record needed to verify roles.

Never paste client secrets, GitHub tokens, session secrets, or webhook URLs into a
chat, issue, repository file, or screenshot.

## 1. Create the Discord role

1. Open the CUBE Discord server settings.
2. Open **Roles** and create a role named `site management`.
3. Assign it only to team members who may edit the website.
4. Enable Discord **Developer Mode** in your personal settings.
5. Copy the server ID and the `site management` role ID. These IDs are not
   passwords, but keep them with the project settings.

## 2. Create the Discord application

1. Open <https://discord.com/developers/applications>.
2. Create an application named `CUBE Website Manager`.
3. In **OAuth2**, add this exact redirect URL:
   `https://cube-interiors-website.pages.dev/api/auth/callback`
4. Copy the Client ID.
5. Create or reset the Client Secret. Treat this value as a password.

No bot and no message-reading permission are required.

## 3. Create a restricted GitHub token

Create a fine-grained personal access token for only the
`cube-interiors-website` repository. Grant:

- Repository contents: Read and write
- Metadata: Read

Use an expiry date and record a reminder to rotate it before it expires. The token
is used only by the Cloudflare server function; it is never sent to browsers.

## 4. Add Cloudflare variables and secrets

Open Cloudflare **Workers & Pages**, select the CUBE Pages project, then open
**Settings → Variables and Secrets**. Add these values to the production
environment:

| Name | Type | Value |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | Plain text | Discord application Client ID |
| `DISCORD_GUILD_ID` | Plain text | CUBE Discord server ID |
| `DISCORD_MANAGER_ROLE_ID` | Plain text | `site management` role ID |
| `DISCORD_CLIENT_SECRET` | Encrypted secret | Discord Client Secret |
| `GITHUB_TOKEN` | Encrypted secret | Restricted GitHub token |
| `SESSION_SECRET` | Encrypted secret | A new random value of at least 32 characters |
| `WEB3FORMS_ACCESS_KEY` | Encrypted secret | Web3Forms access key for the enquiry recipient |

Optional settings:

| Name | Type | Purpose |
| --- | --- | --- |
| `DISCORD_PUBLISHER_ROLE_ID` | Plain text | If set, only this second role may publish, archive or restore projects |
| `DISCORD_WEBHOOK_URL` | Encrypted secret | Sends a Discord notice after website changes |
| `GITHUB_OWNER` | Plain text | Defaults to `rajeesh232005-cmd` |
| `GITHUB_REPO` | Plain text | Defaults to `cube-interiors-website` |
| `GITHUB_BRANCH` | Plain text | Defaults to `main` |

After saving the settings, redeploy the latest Cloudflare Pages deployment so the
new secrets are available to the server function.

## 5. Test access

1. Open the manager URL in a private/incognito browser window.
2. Sign in with a Discord account that does not have the role. Access must be
   denied.
3. Assign the role, sign out, and sign in again. The manager should open.
4. Create a draft project, upload one test image and edit its description.
5. Publish it and confirm it appears in the public gallery after Cloudflare deploys.
6. Archive the test project and confirm it disappears but remains restorable.

## Safety behavior

- Images are resized in the browser and must be below 800 KB after compression.
- Projects are drafted before publication.
- Archive is used instead of permanent deletion, allowing recovery.
- Every change creates a named GitHub commit, providing an audit history.
- Session cookies are cryptographically signed, Secure, HttpOnly and expire after
  four hours.
- OAuth state checking protects the Discord sign-in flow.
- GitHub and Discord credentials remain only in encrypted Cloudflare secrets.
- The contact recipient and Web3Forms access key are hidden from website visitors.
