import { failureSummary, githubRequest, readJson, setOutput, telegram, writeJson } from './common.mjs';

const report = readJson(process.env.CARETAKER_REPORT || 'work/health-report.json');
const dryRun = process.env.CARETAKER_DRY_RUN === 'true';
const title = `Website incident: ${report.results.find(item => !item.ok)?.name || 'CUBE Interiors'}`;
const marker = '<!-- caretaker-incident -->';
const failureMarker = '<!-- confirmed-failure -->';
const summary = failureSummary(report);
if (dryRun) {
  writeJson('work/incident-dry-run.json', { title, summary, report });
  setOutput('issue_number', 0); setOutput('new_incident', true); setOutput('confirmed_failures', 1); setOutput('paused', false); setOutput('ai_runs', 0);
  console.log('Dry run: incident mutation skipped.');
  process.exit(0);
}

async function ensureLabel(name, color, description) {
  try { await githubRequest(`/labels/${encodeURIComponent(name)}`); }
  catch { await githubRequest('/labels', { method: 'POST', body: JSON.stringify({ name, color, description }) }); }
}
await ensureLabel('incident', 'd73a4a', 'Confirmed website incident');
await ensureLabel('pause-agent', 'fbca04', 'Pause automated repair actions');
await ensureLabel('owner-away', '0e8a16', 'Owner is unavailable');

const issues = await githubRequest('/issues?state=open&per_page=100');
const paused = issues.some(issue => issue.labels.some(label => label.name === 'pause-agent'));
let issue = issues.find(item => item.title === title && item.body?.includes(marker));
let isNew = false;
const body = `${marker}\n${failureMarker}\n## Confirmed website failure\n\n${summary}\n\nChecked: ${report.checkedAt}\n`;
if (!issue) {
  issue = await githubRequest('/issues', { method: 'POST', body: JSON.stringify({ title, body, labels: ['incident'] }) });
  isNew = true;
  await telegram(`CUBE website incident\n${summary}\n${issue.html_url}`);
} else {
  await githubRequest(`/issues/${issue.number}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
}
const comments = await githubRequest(`/issues/${issue.number}/comments?per_page=100`);
const confirmed = 1 + comments.filter(comment => comment.body?.includes(failureMarker)).length;
const today = new Date().toISOString().slice(0, 10);
const aiRuns = comments.filter(comment => comment.body?.includes(`<!-- ai-run:${today}`)).length;
setOutput('issue_number', issue.number); setOutput('new_incident', isNew); setOutput('confirmed_failures', confirmed); setOutput('paused', paused); setOutput('ai_runs', aiRuns);
console.log(`Incident #${issue.number}; confirmed failures: ${confirmed}; paused: ${paused}`);
