// tools/check_zh.js — verify translation dictionary covers every lyric line
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'data', 'zh.js'), 'utf8'));
const ZH = global.window.ZH;

const lrc = fs.readFileSync(path.join(ROOT, 'song.lrc'), 'utf8');
let miss = [], total = 0;
for (const raw of lrc.split(/\n/)) {
  const m = raw.match(/^\[[0-9]+:[0-9.]+\]\s*(.*)$/);
  if (!m) continue;
  const t = m[1].trim();
  if (!t) continue;
  if (/^[\u4e00-\u9fa5]/.test(t) && /[:：]/.test(t)) continue; // 作曲/作词 meta
  total++;
  if (!ZH[t]) miss.push(t);
}
console.log('lyric lines:', total, '| dict keys:', Object.keys(ZH).length,
  '| missing:', miss.length ? JSON.stringify(miss, null, 1) : 'NONE — 100% covered');
process.exit(miss.length ? 1 : 0);
