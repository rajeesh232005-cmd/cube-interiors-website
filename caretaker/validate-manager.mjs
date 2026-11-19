import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('../functions/api/[[path]].js', import.meta.url), 'utf8');
const manager = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const configured = {
  DISCORD_CLIENT_ID: 'test', DISCORD_CLIENT_SECRET: 'test', DISCORD_GUILD_ID: 'test',
  DISCORD_MANAGER_ROLE_ID: 'test', GITHUB_TOKEN: 'test', SESSION_SECRET: 'a'.repeat(40)
};

const call = (path, method = 'GET', env = configured, headers = {}) => manager.onRequest({
  request: new Request(`https://example.com/api/${path.join('/')}`, { method, headers, body: method === 'GET' ? undefined : '{}' }),
  env,
  params: { path }
});

const missing = await call(['session'], 'GET', {});
if (missing.status !== 503) throw new Error(`Expected missing setup 503, got ${missing.status}`);
const anonymous = await call(['session']);
if (anonymous.status !== 401) throw new Error(`Expected anonymous 401, got ${anonymous.status}`);
const rejectedWrite = await call(['projects'], 'POST');
if (rejectedWrite.status !== 403) throw new Error(`Expected missing-origin 403, got ${rejectedWrite.status}`);
const unauthenticatedWrite = await call(['projects'], 'POST', configured, { Origin: 'https://example.com' });
if (unauthenticatedWrite.status !== 401) throw new Error(`Expected unauthenticated 401, got ${unauthenticatedWrite.status}`);
console.log('Manager security checks passed.');
