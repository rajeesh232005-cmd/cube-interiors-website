import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('../functions/api/[[path]].js', import.meta.url), 'utf8');
const manager = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const configured = {
  DISCORD_CLIENT_ID: 'test', DISCORD_CLIENT_SECRET: 'test', DISCORD_GUILD_ID: 'test',
  DISCORD_MANAGER_ROLE_ID: 'test', GITHUB_TOKEN: 'test', SESSION_SECRET: 'a'.repeat(40)
};

const call = (path, method = 'GET', env = configured, headers = {}, body = '{}') => manager.onRequest({
  request: new Request(`https://example.com/api/${path.join('/')}`, { method, headers, body: method === 'GET' ? undefined : body }),
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
const rejectedEnquiry = await call(['enquiry'], 'POST');
if (rejectedEnquiry.status !== 403) throw new Error(`Expected enquiry missing-origin 403, got ${rejectedEnquiry.status}`);
const unconfiguredEnquiry = await call(['enquiry'], 'POST', configured, { Origin: 'https://example.com' });
if (unconfiguredEnquiry.status !== 503) throw new Error(`Expected missing recipient 503, got ${unconfiguredEnquiry.status}`);
const honeypotEnquiry = await call(
  ['enquiry'],
  'POST',
  { ...configured, WEB3FORMS_ACCESS_KEY: 'test-access-key' },
  { Origin: 'https://example.com', 'Content-Type': 'application/json' },
  JSON.stringify({ _honey: 'spam' })
);
if (honeypotEnquiry.status !== 200) throw new Error(`Expected honeypot success 200, got ${honeypotEnquiry.status}`);

const originalFetch = globalThis.fetch;
let forwardedEnquiry;
globalThis.fetch = async (url, options) => {
  if (url !== 'https://api.web3forms.com/submit') throw new Error(`Unexpected enquiry destination: ${url}`);
  forwardedEnquiry = JSON.parse(options.body);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const deliveredEnquiry = await call(
  ['enquiry'],
  'POST',
  { ...configured, WEB3FORMS_ACCESS_KEY: 'test-access-key' },
  { Origin: 'https://example.com', 'Content-Type': 'application/json' },
  JSON.stringify({
    name: 'Test User', phone: '+91 98765 43210', alternative_phone: '', email: 'test@example.com',
    project_location: 'Kannur', service: 'Residential interiors', message: 'Test enquiry', contact_consent: 'Agreed'
  })
);
globalThis.fetch = originalFetch;
if (deliveredEnquiry.status !== 200) throw new Error(`Expected delivered enquiry 200, got ${deliveredEnquiry.status}`);
if (forwardedEnquiry.access_key !== 'test-access-key' || forwardedEnquiry.subject !== 'New CUBE website project enquiry') {
  throw new Error('Web3Forms payload was not forwarded correctly.');
}
console.log('Manager security checks passed.');
