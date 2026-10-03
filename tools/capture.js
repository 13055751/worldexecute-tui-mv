// tools/capture.js — headless render: stills for inspection / full frame dump for export
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';

async function openPage() {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction('window.__ready === true', null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  if (errors.length) throw new Error('page errors:\n' + errors.join('\n'));

  // determinism preflight (skill §13.4)
  const det = await page.evaluate(() => {
    const grab = (t) => { __renderTo(t); return document.getElementById('screen').toDataURL('image/png'); };
    const out = {};
    for (const t of [2, 40.5, 150.25, 208.7]) {
      const a = grab(t);
      grab(t + 3.333);
      const b = grab(t);
      out[t] = a === b;
    }
    return out;
  });
  const bad = Object.entries(det).filter(([, ok]) => !ok).map(([t]) => t);
  if (bad.length) throw new Error('NON-DETERMINISTIC at t=' + bad.join(','));
  return { browser, page, errors };
}

const grab = (page, ts) => page.evaluate((list) => {
  const c = document.getElementById('screen');
  return list.map((t) => { __renderTo(t); return c.toDataURL('image/png'); });
}, ts);

async function main() {
  const mode = process.argv[2] || 'stills';
  const { browser, page, errors } = await openPage();
  try {
    if (mode === 'stills') {
      const times = (process.argv[3] || '2,16,45,75,120,150,159,165,185,196,206.5,210')
        .split(',').map(Number);
      const outDir = path.join(ROOT, 'tools', 'stills');
      fs.mkdirSync(outDir, { recursive: true });
      const urls = await grab(page, times);
      times.forEach((t, i) => {
        const f = path.join(outDir, 't' + String(t).replace('.', '_') + '.png');
        fs.writeFileSync(f, Buffer.from(urls[i].split(',')[1], 'base64'));
        console.log('wrote', path.relative(ROOT, f));
      });
    } else if (mode === 'frames') {
      const fps = 30;
      const n = await page.evaluate(() => window.FEATURES.nFrames);
      const outDir = path.join(ROOT, 'frames');
      fs.mkdirSync(outDir, { recursive: true });
      const BATCH = 30;
      const t0 = Date.now();
      for (let start = 0; start < n; start += BATCH) {
        const ts = [];
        for (let k = start; k < Math.min(start + BATCH, n); k++) ts.push(k / fps);
        const urls = await grab(page, ts);
        for (let k = 0; k < urls.length; k++) {
          const idx = start + k;
          fs.writeFileSync(path.join(outDir, String(idx).padStart(5, '0') + '.png'),
            Buffer.from(urls[k].split(',')[1], 'base64'));
        }
        if (start % 300 === 0) {
          const done = Math.min(start + BATCH, n);
          const el = (Date.now() - t0) / 1000;
          console.log(`frames ${done}/${n}  ${(done / el).toFixed(1)} fps  eta ${((n - done) / (done / el)).toFixed(0)}s`);
        }
      }
      console.log('done in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
    } else {
      throw new Error('unknown mode ' + mode);
    }
    if (errors.length) throw new Error('page errors:\n' + errors.join('\n'));
    console.log('PREFLIGHT determinism OK, no page errors');
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
