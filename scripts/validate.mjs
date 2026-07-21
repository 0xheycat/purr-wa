import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('../purr-wa-export.user.js', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const requiredMetadata = [
  '// @version      1.0.1',
  '// @homepageURL  https://github.com/0xheycat/purr-wa',
  '// @supportURL   https://github.com/0xheycat/purr-wa/issues',
  '// @downloadURL  https://raw.githubusercontent.com/0xheycat/purr-wa/main/purr-wa-export.user.js',
  '// @updateURL    https://raw.githubusercontent.com/0xheycat/purr-wa/main/purr-wa-export.user.js',
  '// @license      MIT',
  '// @match        https://web.whatsapp.com/*',
];

for (const line of requiredMetadata) {
  assert.ok(script.includes(line), `missing userscript metadata: ${line}`);
}

assert.equal(pkg.version, '1.0.1');
assert.ok(script.includes("var REPO = 'https://github.com/0xheycat/purr-wa';"));
assert.ok(readme.includes('https://0xheycat.xyz/work/purr-wa'));
assert.ok(readme.includes('https://raw.githubusercontent.com/0xheycat/purr-wa/main/purr-wa-export.user.js'));
assert.ok(!script.includes('0xheycat/purr-wa-export'));
assert.ok(!readme.includes('0xheycat/purr-wa-export'));

console.log('Purr WA metadata and canonical links are valid.');
