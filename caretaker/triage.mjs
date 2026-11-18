import { execFileSync } from 'node:child_process';
import { failureSummary, githubRequest, readJson, sanitize, setOutput, telegram, writeJson } from './common.mjs';

const report = readJson(process.env.CARETAKER_REPORT || 'work/health-report.json');
const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
const allowed = new Set(['none', 'alert_only', 'rollback', 'open_fix_pr', 'escalate']);
const recent = execFileSync('git', ['log', '-10', '--pretty=format:%h %cs %s', '--name-only'], { encoding: 'utf8' });
const failure = report.results.find(item => !item.ok);
let result;

function fallback(reason) {
  const headAge = Date.now() - Date.parse(execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { encoding: 'utf8' }).trim());
  const rollback = ['down', 'http', 'content'].includes(failure.failureType) && headAge < 86400000;
  return { diagnosis: 'Rule-based fallback', likely_cause: rollback ? 'A recent deployment may have caused the failure.' : 'Cause requires human review.', confidence: 0.35, action: rollback ? 'rollback' : 'alert_only', reason, files: [] };
}

if (!process.env.GEMINI_API_KEY) result = fallback('GEMINI_API_KEY is not configured.');
else {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const prompt = sanitize(`You are triaging a static website outage. Return only strict JSON with keys diagnosis, likely_cause, confidence (0..1), action, reason, files. action must be one of none, alert_only, rollback, open_fix_pr, escalate. Never request secrets, DNS, billing or database changes. Prefer alert_only when uncertain.\n\nFailure:\n${failureSummary(report)}\n\nRecent commits and changed file names:\n${recent}`);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } })
    });
    if (!response.ok) throw new Error(`Gemini API ${response.status}`);
    const payload = await response.json();
    result = JSON.parse(payload.candidates?.[0]?.content?.parts?.[0]?.text || '');
    if (!result || typeof result.diagnosis !== 'string' || typeof result.reason !== 'string' || !allowed.has(result.action) || !(Number(result.confidence) >= 0 && Number(result.confidence) <= 1) || !Array.isArray(result.files)) throw new Error('Invalid triage JSON.');
  } catch (error) { result = fallback(error.message); }
}
writeJson('work/triage.json', result);
setOutput('action', result.action);
if (issueNumber && process.env.CARETAKER_DRY_RUN !== 'true') {
  const today = new Date().toISOString().slice(0, 10);
  const body = `<!-- ai-run:${today} -->\n## Automated diagnosis\n\n**Diagnosis:** ${sanitize(result.diagnosis)}\n\n**Likely cause:** ${sanitize(result.likely_cause)}\n\n**Confidence:** ${result.confidence}\n\n**Action:** \`${result.action}\`\n\n${sanitize(result.reason)}`;
  await githubRequest(`/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
  await telegram(`CUBE diagnosis\n${result.diagnosis}\nAction: ${result.action}\n${result.reason}`);
}
console.log(JSON.stringify(result, null, 2));
