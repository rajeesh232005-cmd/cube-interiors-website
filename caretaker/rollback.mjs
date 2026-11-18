import { execFileSync } from 'node:child_process';
import { githubRequest, readJson, telegram } from './common.mjs';

if (process.env.CARETAKER_DRY_RUN === 'true') { console.log('Dry run: rollback skipped.'); process.exit(0); }
const report = readJson(process.env.CARETAKER_REPORT || 'work/health-report.json');
const issueNumber = Number(process.env.ISSUE_NUMBER);
const confirmed = Number(process.env.CONFIRMED_FAILURES || 0);
const failure = report.results.find(item => !item.ok);
if (confirmed < 3) throw new Error('Rollback requires three confirmed failures.');
if (!['down', 'http', 'content'].includes(failure.failureType)) throw new Error(`Rollback is not allowed for ${failure.failureType}.`);
const issues = await githubRequest('/issues?state=open&per_page=100');
if (issues.some(issue => issue.labels.some(label => label.name === 'pause-agent'))) throw new Error('pause-agent is active.');
const committedAt = Date.parse(execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { encoding: 'utf8' }).trim());
if (Date.now() - committedAt > 86400000) throw new Error('Newest commit is older than 24 hours.');
const comments = await githubRequest(`/issues/${issueNumber}/comments?per_page=100`);
const lastRollback = comments.filter(comment => comment.body?.includes('<!-- rollback -->')).at(-1);
if (lastRollback && Date.now() - Date.parse(lastRollback.created_at) < 21600000) throw new Error('Rollback cooldown is active.');
const files = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
if (!files.length || files.some(file => !file.startsWith('dist/'))) throw new Error(`Rollback rejected because commit touches non-site files: ${files.join(', ')}`);
execFileSync('git', ['config', 'user.name', 'cube-caretaker[bot]']);
execFileSync('git', ['config', 'user.email', 'cube-caretaker@users.noreply.github.com']);
execFileSync('git', ['revert', '--no-edit', 'HEAD'], { stdio: 'inherit' });
execFileSync('git', ['push', 'origin', 'HEAD:main'], { stdio: 'inherit' });
await githubRequest(`/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body: `<!-- rollback -->\nAutomatically reverted the newest site-only commit at ${new Date().toISOString()}.` }) });
await telegram(`CUBE caretaker reverted the newest site-only commit. Incident #${issueNumber} will be rechecked in 5 minutes.`);
