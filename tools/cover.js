// tools/cover.js — compose Bilibili cover (1920x1200, 16:10) on a browser canvas
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(ROOT, 'cover.html'));
  await page.evaluate(async (frameUrl) => {
    const img = new Image();
    img.src = frameUrl;
    await img.decode();
    const c = document.getElementById('c');
    const x = c.getContext('2d');
    x.fillStyle = '#000';
    x.fillRect(0, 0, 1920, 1200);
    // 16:10 crop: scale frame to 2133x1200, center-crop to 1920 wide
    x.drawImage(img, -(2133 - 1920) / 2, 0, 2133, 1200);
    // bottom scrim for legibility
    x.fillStyle = 'rgba(0,0,0,0.62)';
    x.fillRect(0, 760, 1920, 440);
    x.textAlign = 'center';
    x.textBaseline = 'top';
    const line = (text, font, size, color, y) => {
      x.font = size + 'px ' + font;
      x.lineWidth = 8;
      x.strokeStyle = '#000';
      x.strokeText(text, 960, y);
      x.fillStyle = color;
      x.fillText(text, 960, y);
    };
    line('终端窗口开始唱歌', '"WenQuanYi Zen Hei", monospace', 118, '#F0A832', 790);
    line('Mili 名曲 TUI 终端风格 自制MV', '"WenQuanYi Zen Hei", monospace', 56, '#C3D2E0', 960);
    line('1080P  ·  03:31  ·  12 SHOTS', '"DejaVu Sans Mono", monospace', 40, '#8496A8', 1055);
    line('rendered by MiMo V2.6 Flash', '"DejaVu Sans Mono", monospace', 30, '#7d5c1e', 1120);
    // terminal-style amber frame
    x.strokeStyle = '#F0A832';
    x.lineWidth = 10;
    x.strokeRect(5, 5, 1910, 1190);
  }, 'frames/00555.png');
  await page.locator('#c').screenshot({ path: path.join(ROOT, 'cover.png'), type: 'png' });
  console.log('cover.png written');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
