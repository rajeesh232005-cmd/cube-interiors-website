import { githubRequest, readJson, telegram } from './common.mjs';
const report = readJson(process.env.CARETAKER_REPORT || 'work/health-report.json');
if (!report.ok || process.env.CARETAKER_DRY_RUN === 'true') process.exit(0);
const issues = await githubRequest('/issues?state=open&labels=incident&per_page=100');
for (const issue of issues.filter(item => item.body?.includes('<!-- caretaker-incident -->'))) {
  const body = `<!-- recovery -->\nWebsite recovered at ${report.checkedAt}. All configured checks passed.`;
  await githubRequest(`/issues/${issue.number}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
  await githubRequest(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
  await telegram(`CUBE website recovered\n${report.results.map(item => `${item.name}: ${item.durationMs}ms`).join('\n')}\n${issue.html_url}`);
}
