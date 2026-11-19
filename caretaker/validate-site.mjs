import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist');
const files = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const errors = [];
for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${file}: missing title`);
  if (!/<html lang="[^"]+">/.test(html)) errors.push(`${file}: missing document language`);
  if (!/<meta name="viewport"/.test(html)) errors.push(`${file}: missing viewport metadata`);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  for (const id of new Set(ids)) if (ids.filter(value => value === id).length > 1) errors.push(`${file}: duplicate id ${id}`);
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const value = match[1].split('#')[0];
    if (/^(?:https?:|mailto:|tel:)/.test(value)) continue;
    if (!fs.existsSync(path.resolve(root, value.replace(/^\/+/, '')))) errors.push(`${file}: missing ${value}`);
  }
}
const required = ['404.html', '_headers', 'robots.txt', 'sitemap.xml'];
for (const file of required) if (!fs.existsSync(path.join(root, file))) errors.push(`missing production file: ${file}`);
const budget = JSON.parse(fs.readFileSync(path.resolve('config/performance-budget.json'), 'utf8'));
const assetFiles = fs.readdirSync(path.join(root, 'assets'));
let totalAssets = 0;
for (const file of assetFiles) {
  const bytes = fs.statSync(path.join(root, 'assets', file)).size;
  totalAssets += bytes;
  if (bytes > budget.maxAssetBytes) errors.push(`assets/${file}: ${bytes} bytes exceeds ${budget.maxAssetBytes}`);
}
if (totalAssets > budget.maxTotalAssetBytes) errors.push(`assets total: ${totalAssets} bytes exceeds ${budget.maxTotalAssetBytes}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Validated ${files.length} HTML pages.`);
