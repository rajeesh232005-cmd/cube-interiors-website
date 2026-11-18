import { notify } from './common.mjs';

const delivered = await notify([
  '✅ CUBE website caretaker test',
  'Discord alerts are connected successfully.',
  'Website: https://cube-interiors-website.pages.dev/',
  `Checked: ${new Date().toISOString()}`
].join('\n'));

if (!delivered) throw new Error('No notification channel is configured.');
console.log('Test notification delivered.');
