// main.js — render(t): transport-independent compositor (preview and export share this)
'use strict';

// ---------- layout (cell grid) ----------
const L = {
  title: { c: 0, r: 0, w: 159, h: 1 },
  stage: { c: 0, r: 1, w: 95, h: 28 },       // stage interior rows 2..27, cols 1..93
  lyrics: { c: 0, r: 29, w: 95, h: 12 },     // lyrics interior rows 30..39, cols 1..93
  spectrum: { c: 96, r: 1, w: 63, h: 16 },   // interior rows 2..15, cols 97..157
  corpus: { c: 96, r: 17, w: 63, h: 11 },    // interior rows 18..26
  ops: { c: 96, r: 28, w: 63, h: 13 },       // interior rows 29..39
  transport: { c: 0, r: 41, w: 159, h: 7 },  // interior rows 42..46, cols 1..157
  status: { c: 0, r: 48, w: 159, h: 1 },
};

let EVENTS = [];
let TOKENS = [];
const PROMPT = 'mili@world:~$ ';
const SEC_SHORT = {
  boot: 'BOOT', world: 'WORLD.EXEC', v1: 'SETUP', pre1: 'PRE-EXEC', v2: 'RUNTIME',
  iso: 'ISOLATION', gap: 'WAIT()', storm: 'STORM', final: 'RE-EXEC', love: 'LOVE',
  lull: 'IDLE', end: 'EXIT',
};

// ---------- classification ----------
// ≥2 uppercase chars (or hyphen-joined); must NOT match "I'" inside "I'm"
const CAPS_RE = /\b[A-Z][A-Z-]+\b/;
const CAPS_SPLIT = /(\b[A-Z][A-Z-]+\b)/;
const normTok = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function buildTokens() {
  const out = [];
  for (const c of CUES) {
    if (c.meta) continue;
    for (const w of c.text.split(/[^A-Za-z0-9().;-]+/)) {
      if (w) out.push({ w, ci: c.i });
    }
  }
  return out;
}


// word-timeline karaoke: chars lit exactly as words are sung (onset-snapped)
function sungChars(cue, text, t) {
  const ws = window.WORDS && window.WORDS[cue.i];
  if (!ws || !ws.length) {
    return text.length * clamp((t - cue.t) / Math.max(0.1, (cue.end - cue.t) * 0.92), 0, 1);
  }
  const segs = [];
  let cursor = 0;
  for (const [w, t0, t1] of ws) {
    const idx = text.indexOf(w, cursor);
    if (idx < 0) continue;
    segs.push({ s: idx, t0, t1 });
    cursor = idx + w.length;
  }
  let n = 0;
  for (let i = 0; i < segs.length; i++) {
    const segEnd = i + 1 < segs.length ? segs[i + 1].s : text.length;
    if (t >= segs[i].t1) n = segEnd;
    else if (t >= segs[i].t0) {
      const f = segs[i].t1 > segs[i].t0 ? (t - segs[i].t0) / (segs[i].t1 - segs[i].t0) : 1;
      n = Math.max(n, segs[i].s + Math.floor(f * (segEnd - segs[i].s)));
      break;
    } else break;
  }
  return Math.min(text.length, n);
}

function drawLyrics(t, st, style, events) {
  const p = L.lyrics;
  TUI.panel(p.c, p.r, p.w, p.h, 'LYRICS / karaoke', { border: style.border, titleColor: style.border });
  const innerC = p.c + 1, innerW = p.w - 2;
  const active = cueAt(t);
  if (active) {
    // hold window: line clears shortly after it is sung (long instrumental gaps stay empty)
    const hold = clamp(0.8 + active.text.length * 0.09, 1.2, 4.2);
    const visible = t <= active.t + Math.min(active.end - active.t, hold);
    if (visible) {
      const prev = CUES[active.i - 1];
      const next = CUES[active.i + 1];
      if (prev) TUI.text(innerC, p.r + 1, prev.text, PAL.dimmer, { maxCols: innerW });

      // current line, big, karaoke-lit while it is being sung
      const c = TUI.ctx;
      c.font = TUI.fontBig;
      const maxW = TUI.wpx(innerW);
      let text = active.text;
      if (c.measureText(text).width > maxW) {
        while (text.length > 1 && c.measureText(text + '…').width > maxW) text = text.slice(0, -1);
        text += '…';
      }
      const sung = sungChars(active, active.text, t);
      const y = TUI.py(p.r + 2) + 4;
      let xx = TUI.px(innerC);
      if (active.meta) {
        c.fillStyle = PAL.dim;
        c.fillText(text, xx, y);
      } else {
        const parts = text.split(CAPS_SPLIT);
        let idx = 0;
        for (let i = 0; i < parts.length; i++) {
          if (!parts[i]) continue;
          const seg = parts[i];
          const startIdx = idx;
          idx += seg.length;
          const nSung = clamp(Math.floor(sung) - startIdx, 0, seg.length);
          if (nSung > 0) {
            c.fillStyle = style.accent;
            c.fillText(seg.slice(0, nSung), xx, y);
            xx += c.measureText(seg.slice(0, nSung)).width;
          }
          if (nSung < seg.length) {
            c.fillStyle = i % 2 === 1 ? PAL.accentDim : style.focusColor;
            c.fillText(seg.slice(nSung), xx, y);
            xx += c.measureText(seg.slice(nSung)).width;
          }
        }
      }
      c.font = TUI.font;

      // Chinese translation under the lyric: // 译文
      const zh = window.ZH && window.ZH[active.text];
      if (zh && !active.meta) {
        TUI.text(innerC, p.r + 5, '//', PAL.cyan);
        TUI.text(innerC + 3, p.r + 5, zh, PAL.cyanBright, { maxCols: innerW - 3 });
      }
      if (next) TUI.text(innerC, p.r + 6, next.text, PAL.dim, { maxCols: innerW });
    }
  }

  // semantic event feed (last3)
  hline(p.r + 7, innerC, p.c + p.w - 1, PAL.dimmer);
  const recent = events.filter(e => e.t <= t).slice(-3);
  for (let i = 0; i < 3; i++) {
    const row = p.r + 8 + i;
    const e = recent[i - (3 - recent.length)];
    if (!e) continue;
    const age = t - e.t;
    const alpha = age > 15 ? 0.45 : 1;
    const col = { ok: PAL.ok, warn: PAL.accent, err: PAL.err, info: PAL.cyan, wait: PAL.dim }[e.lvl] || PAL.text;
    TUI.text(innerC, row, fmtTime(e.t) + ' ', PAL.dimmer, { alpha });
    TUI.text(innerC + 11, row, e.lvl.toUpperCase().padEnd(5) + ' ' + e.msg,
      col, { alpha, maxCols: innerW - 11 });
  }
}

function drawSpectrum(t, st, style, imp) {
  const p = L.spectrum;
  TUI.panel(p.c, p.r, p.w, p.h, 'FEATURE / fft+envelope',
    { border: style.border, titleColor: style.border });
  const f = frameOf(t);
  const innerC = p.c + 1, innerW = p.w - 2; // 61
  TUI.text(innerC, p.r + 1, 'spectrum — log bins 40Hz..10kHz', PAL.dimmer);

  const barC = innerC, barW = 48, barTop = p.r + 3, barH = 9;
  const partial = '▁▂▃▄▅▆▇';
  for (let b = 0; b < FEATURES.nBands; b++) {
    const v = BANDS[f * FEATURES.nBands + b];
    const lvl = (v / 255) * barH;
    const full = Math.floor(lvl);
    const frac = Math.round((lvl - full) * 7);
    const col = b < 2 ? (imp > 0.7 ? PAL.bright : PAL.accent) : (imp > 1.2 ? PAL.bright : PAL.text);
    for (let r = 0; r < full; r++) {
      const row = barTop + barH - 1 - r;
      TUI.text(barC + b * 3, row, '███', col);
    }
    if (full < barH && frac > 0) {
      TUI.text(barC + b * 3, barTop + barH - 1 - full, partial[frac - 1].repeat(3), col);
    }
    // peak hold over a 0.75s window
    let hold = 0;
    const f0 = Math.max(0, f - 22);
    for (let k = f0; k <= f; k++) hold = Math.max(hold, BANDS[k * FEATURES.nBands + b]);
    const hRow = barTop + barH - 1 - Math.floor((hold / 255) * barH);
    if (hRow >= barTop && hRow > barTop + barH - 1 - full) {
      TUI.text(barC + b * 3, hRow, '▀▀▀', PAL.dimmer);
    }
  }

  const ro = barC + barW + 1; // col 146 rel
  const rows = [
    'SR   22050', 'FFT  1024', 'HOP  512', 'BANDS 16', 'ONSET ' + FEATURES.onsets.length,
    'RMS  ' + (FEAT.rms[f] / 255).toFixed(2), 'FLX  ' + (FEAT.flux[f] / 255).toFixed(2),
    'ENV  ' + (FEAT.env[f] / 127).toFixed(2), 'SEC  ' + (SEC_SHORT[st.id] || st.name),
  ];
  for (let i = 0; i < rows.length; i++) {
    TUI.text(ro, barTop + i, rows[i], i === 8 ? style.accent : PAL.dim, { maxCols: 12 });
  }

  TUI.text(innerC, p.r + 11, 'log bins: 40Hz ─────────────── 10kHz', PAL.dimmer);
  TUI.text(innerC, p.r + 12, 'hold=0.75s · quantized 0..255 · sampled@30fps', PAL.dimmer);
  TUI.text(innerC, p.r + 13, 'onset flux ▇ marks: ' + onsetsBetween(st.t, t) + ' this section', PAL.dimmer);
}

function drawCorpus(t, st, style, active) {
  const p = L.corpus;
  TUI.panel(p.c, p.r, p.w, p.h, 'CORPUS / lyric tokens', { border: style.border, titleColor: style.border });
  const innerC = p.c + 1, innerW = p.w - 2, innerR = p.r + 1, innerH = p.h - 2;
  const ci = active ? active.i : 0;

  // wrap tokens up to the active cue into lines, keep the last innerH
  const lines = [];
  let line = '';
  for (let i = 0; i < TOKENS.length; i++) {
    const tk = TOKENS[i];
    if (tk.ci > ci) break;
    const add = (line ? ' ' : '') + tk.w;
    if (line.length + add.length > innerW) { lines.push(line); line = tk.w; }
    else line += add;
  }
  if (line) lines.push(line);
  const vis = lines.slice(-innerH);

  // highlight tokens of active cue
  const c = TUI.ctx;
  c.font = TUI.font;
  const activeSet = new Set(active ? active.text.split(/[^A-Za-z0-9]+/).filter(Boolean).map(normTok) : []);
  for (let li = 0; li < vis.length; li++) {
    const row = innerR + li;
    const isLast = lines.length - innerH + li === lines.length - 1;
    if (!isLast) { TUI.text(innerC, row, vis[li], PAL.dim); continue; }
    // active line: tokens of active cue in accent
    let x = TUI.px(innerC);
    for (const w of vis[li].split(' ')) {
      const tkActive = activeSet.has(normTok(w));
      c.fillStyle = tkActive ? style.accent : PAL.text;
      c.fillText(w + ' ', x, TUI.py(row));
      x += c.measureText(w + ' ').width;
    }
  }
}

function drawOps(t, st, style) {
  const p = L.ops;
  TUI.panel(p.c, p.r, p.w, p.h, 'OPS / process table', { border: style.border, titleColor: style.border });
  const innerC = p.c + 1;
  TUI.text(innerC, p.r + 1, 'PID   PROC              STATE      CPU   MEM', PAL.dimmer);
  for (let i = 0; i < PROCS.length; i++) {
    const row = p.r + 2 + i;
    const pr = PROCS[i];
    const state = procState(st.id, i, t);
    const cpu = procCpu(st.id, i, t);
    const mem = procMem(i, t);
    const stateCol = {
      RUNNING: PAL.ok, CONNECTED: PAL.ok, CONNECTING: PAL.cyan, DEGRADED: PAL.accent,
      RETRY: PAL.accent, EVICTING: PAL.accent, PAUSED: PAL.accent, ARMED: PAL.cyan,
      FAILED: PAL.err, KILLED: PAL.err, EXITED: PAL.dim, SLEEP: PAL.dim, IDLE: PAL.dim,
      INIT: PAL.cyan, STARTING: PAL.cyan, WARM: PAL.accent,
    }[state] || PAL.text;
    TUI.text(innerC, row, String(pr.pid).padEnd(6) + pr.n.padEnd(18) +
      state.padEnd(11) + (state === 'EXITED' ? '  -  ' : String(cpu).padStart(3) + '  ') +
      String(mem).padStart(3) + 'M', PAL.text);
    // state colored overlay
    TUI.text(innerC + 24, row, state, stateCol);
    // cpu micro bar
    if (state !== 'EXITED' && state !== 'KILLED') {
      TUI.hbar(innerC + 44, row, 5, cpu / 100, '█', '·', cpu > 85 ? PAL.err : PAL.accentDim);
    }
  }
  hline(p.r + 8, innerC, p.c + p.w - 2, PAL.dimmer);
  const load = (0.4 + energy(t) * 3.1).toFixed(2);
  TUI.text(innerC, p.r + 9, 'load ' + load + '  tasks ' + (st.id === 'storm' ? '128/128' : '6/128') +
    '  irq ' + Math.round(energy(t) * 90), PAL.dim);
  TUI.text(innerC, p.r + 10, 'uptime ' + fmtTime(t) + '  mem ' +
    (2100 + Math.round(energy(t) * 1600)) + 'M/' + '8192M  swap 0', PAL.dimmer);
}

function drawTransport(t, st, style) {
  const p = L.transport;
  TUI.panel(p.c, p.r, p.w, p.h, 'TRANSPORT / audio clock', { border: style.border, titleColor: style.border });
  const c = TUI.ctx;
  const x0 = TUI.px(1), wTot = TUI.wpx(157);
  const prog = clamp(t / DURATION, 0, 1);

  // waveform rows 42..44 (rect bars, centered)
  const cy = TUI.py(43) + TUI.cellH / 2;
  const maxH = TUI.cellH * 1.35;
  const colW = wTot / 157;
  const nW = FEAT.wave.length;
  for (let i = 0; i < 157; i++) {
    const idx = Math.floor((i / 157) * nW);
    const v = FEAT.wave[idx] / 255;
    const h = Math.max(1, v * maxH);
    const x = x0 + i * colW;
    const played = (i / 157) < prog;
    c.fillStyle = played ? PAL.accentDim : PAL.dimmer;
    c.fillRect(x, cy - h, colW + 0.5, h * 2);
  }
  // playhead
  const phx = x0 + prog * wTot;
  c.fillStyle = PAL.accent;
  c.fillRect(phx - 1, TUI.py(42), 2, TUI.hpx(3));

  // ruler row 45: cue ticks + section marks
  const cells = new Array(157).fill('─');
  for (const cc of CUES) {
    const i = Math.round((cc.t / DURATION) * 156);
    if (i >= 0 && i < 157 && !cc.meta) cells[i] = '┬';
  }
  for (const s of SECTIONS) {
    const i = Math.round((s.t / DURATION) * 156);
    if (i >= 0 && i < 157) cells[i] = '│';
  }
  const phi = Math.round(prog * 156);
  cells[phi] = '▼';
  TUI.text(1, 45, cells.join(''), PAL.dimmer);
  TUI.text(1 + phi - 1, 45, '▼', PAL.accent);

  // progress row 46
  const fill = Math.round(prog * 157);
  TUI.text(1, 46, '━'.repeat(fill), PAL.accent);
  TUI.text(1 + fill, 46, '─'.repeat(Math.max(0, 157 - fill)), PAL.dimmer);
}

function drawTitleBar(t, st, imp) {
  const p = L.title;
  TUI.fillCells(p.c, p.r, p.w, p.h, PAL.titleBg);
  const left = ' MLI@WORLD :: world.execute(me); :: tty1 — Mili / Cassie Wei';
  TUI.text(1, 0, left, PAL.titleFg);
  const right = '● ' + fmtTime(t) + '  en ' + String(FEAT.env[frameOf(t)]).padStart(3) +
    '  imp ' + imp.toFixed(2) + '  30fps';
  TUI.text(TUI.cols - right.length - 1, 0, right,
    imp > 1 ? PAL.accent : PAL.titleFg);
}

function drawStatusBar(t, st) {
  const p = L.status;
  TUI.fillCells(p.c, p.r, p.w, p.h, PAL.titleBg);
  const ci = cueAt(t);
  const left = ' RUN  T' + fmtTime(t) + ' / ' + fmtTime(DURATION) +
    '  CUE ' + (ci ? ci.i + 1 : 0) + '/' + CUES.length + '  SEC ' + st.name;
  const right = 'SYNC audio-clock · rendered by MiMo V2.6 Flash';
  TUI.text(1, p.r, left, PAL.bright, { maxCols: 90 });
  TUI.text(TUI.cols - right.length - 1, p.r, right, PAL.dimmer);
}

// ---------- master ----------
function renderTo(t) {
  t = clamp(t, 0, DURATION - 0.001);
  const st = sectionAt(t);
  const style = SECTION_STYLE[st.id] || SECTION_STYLE.boot;
  const imp = onsetImpulse(t);

  TUI.clear(PAL.bg);

  if (st.id === 'end') {
    drawEnd(t);
    drawTitleBar(t, st, imp);
    drawStatusBar(t, st);
    return;
  }
  if (st.id === 'storm') {
    drawStorm(t);
    drawTitleBar(t, st, imp);
    drawStatusBar(t, st);
    return;
  }

  const active = cueAt(t);
  drawStage(t, st, style, imp, active);
  drawLyrics(t, st, style, EVENTS);
  drawSpectrum(t, st, style, imp);
  drawCorpus(t, st, style, active);
  drawOps(t, st, style);
  drawTransport(t, st, style);
  drawTitleBar(t, st, imp);
  drawStatusBar(t, st);
}

// ---------- bootstrap ----------
function boot() {
  initFeatures();
  EVENTS = buildEvents();
  TOKENS = buildTokens();
  const canvas = document.getElementById('screen');
  TUI.init(canvas);
  window.__renderTo = renderTo;
  window.__ready = true;
}
