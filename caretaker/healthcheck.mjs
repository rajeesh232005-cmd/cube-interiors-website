import fs from 'node:fs';
import tls from 'node:tls';
import { delay, readJson, setOutput, writeJson } from './common.mjs';

const simulateArg = process.argv.find(arg => arg.startsWith('--simulate='));
const simulate = simulateArg?.split('=')[1] || process.env.CARETAKER_SIMULATE || '';
const config = readJson(process.env.CARETAKER_SITES || 'config/sites.json');
const outputFile = process.env.CARETAKER_REPORT || 'work/health-report.json';

function certificateDays(hostname) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(443, hostname, { servername: hostname, rejectUnauthorized: true }, () => {
      const certificate = socket.getPeerCertificate();
      socket.end();
      if (!certificate?.valid_to) return reject(new Error('TLS certificate expiry unavailable.'));
      resolve((Date.parse(certificate.valid_to) - Date.now()) / 86400000);
    });
    socket.setTimeout(10000, () => socket.destroy(new Error('TLS connection timed out.')));
    socket.on('error', reject);
  });
}

async function checkOnce(site) {
  if (simulate === 'down') return { ok: false, failureType: 'down', message: 'Simulated connection failure.', status: 0, durationMs: 0 };
  if (simulate === 'supabase') return { ok: false, failureType: 'supabase', message: 'Simulated backend failure.', status: 0, durationMs: 0 };
  const started = performance.now();
  let response;
  try {
    response = await fetch(site.url, { redirect: 'follow', signal: AbortSignal.timeout(site.timeoutMs) });
  } catch (error) {
    return { ok: false, failureType: 'down', message: error.message, status: 0, durationMs: Math.round(performance.now() - started) };
  }
  const durationMs = simulate === 'slow' ? site.slowMs + 1 : Math.round(performance.now() - started);
  const body = await response.text();
  if (!response.ok) return { ok: false, failureType: 'http', message: `HTTP ${response.status}`, status: response.status, durationMs };
  if (!body.includes(site.expectedText)) return { ok: false, failureType: 'content', message: `Expected text not found: ${site.expectedText}`, status: response.status, durationMs };
  if (durationMs > site.slowMs) return { ok: false, failureType: 'slow', message: `Response took ${durationMs}ms`, status: response.status, durationMs };
  let tlsDays;
  try { tlsDays = simulate === 'ssl' ? 7 : await certificateDays(new URL(site.url).hostname); }
  catch (error) { return { ok: false, failureType: 'ssl', message: error.message, status: response.status, durationMs }; }
  if (tlsDays < site.tlsWarningDays) return { ok: false, failureType: 'ssl', message: `TLS certificate expires in ${tlsDays.toFixed(1)} days`, status: response.status, durationMs, tlsDays };
  return { ok: true, failureType: null, message: 'Healthy', status: response.status, durationMs, tlsDays };
}

async function check(site) {
  const attempts = [];
  const retries = Number(process.env.CARETAKER_RETRIES || site.retries);
  const retryDelay = Number(process.env.CARETAKER_RETRY_DELAY_MS ?? site.retryDelayMs);
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await checkOnce(site);
    attempts.push({ attempt, checkedAt: new Date().toISOString(), ...result });
    if (result.ok) break;
    if (attempt < retries) await delay(retryDelay * (2 ** (attempt - 1)));
  }
  const final = attempts.at(-1);
  return { name: site.name, url: site.url, expectedText: site.expectedText, attempts, ...final };
}

const report = { checkedAt: new Date().toISOString(), simulate: simulate || null, results: [] };
for (const site of config.sites) report.results.push(await check(site));
report.ok = report.results.every(item => item.ok);
writeJson(outputFile, report);
setOutput('healthy', report.ok);
setOutput('report', outputFile);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
