import fs from 'node:fs';
import path from 'node:path';

export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export const setOutput = (name, value) => {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value).replaceAll('\n', '%0A')}\n`);
};
export const sanitize = value => String(value)
  .replace(/(?:AIza|gh[pousr]_)[A-Za-z0-9_-]{15,}/g, '[REDACTED]')
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]')
  .replace(/[A-Za-z0-9+/]{32,}={0,2}/g, '[REDACTED_TOKEN]');

export async function githubRequest(apiPath, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) throw new Error('GitHub context is unavailable.');
  const response = await fetch(`https://api.github.com/repos/${repository}${apiPath}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

export async function telegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: sanitize(message), disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error(`Telegram delivery failed with status ${response.status}.`);
  return true;
}

export async function discord(message) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return false;
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: sanitize(message).slice(0, 2000),
      allowed_mentions: { parse: [] }
    })
  });
  if (!response.ok) throw new Error(`Discord delivery failed with status ${response.status}.`);
  return true;
}

export async function notify(message) {
  const results = await Promise.allSettled([discord(message), telegram(message)]);
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  return results.some(result => result.status === 'fulfilled' && result.value);
}

export function failureSummary(report) {
  return report.results.filter(item => !item.ok)
    .map(item => `${item.name}: ${item.failureType} — ${item.message}`).join('\n');
}
