// Render production states to PNG (deterministic: shoot=1 fixes time). Usage: node app/shoot.mjs <outdir> --list app/shots.txt
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname);
let [outdir, ...pairs] = process.argv.slice(2);
if (pairs[0] === '--list') {   // a shot list: one "name  hash" per line ('#' comments) — the reproducible review set
  pairs = fs.readFileSync(pairs[1], 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).flatMap(l => { const [name, hash] = l.split(/\s+/); return [hash, name]; });
}
fs.mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 1.5 });
page.on('pageerror', e => console.log('  [pageerror]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('  [console]', m.text()); });
for (let i = 0; i < pairs.length; i += 2) {
  const hash = pairs[i], name = pairs[i + 1];
  await page.goto('file://' + path.join(here, 'dist/lya.html') + '?i=' + i + '#' + hash + '&shoot=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outdir, name + '.png') });
  console.log('wrote', name);
}
await browser.close();
