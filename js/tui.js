// tui.js — terminal-grid drawing primitives (cell-exact text, clipped panels)
'use strict';

const PAL = {
  bg: '#000000',
  text: '#8496a8',
  bright: '#c3d2e0',
  dim: '#39434f',
  dimmer: '#232b34',
  border: '#2a3542',
  borderHot: '#516578',
  accent: '#f0a832',
  accentDim: '#7d5c1e',
  err: '#e05555',
  errDim: '#5f2626',
  ok: '#5bc46f',
  cyan: '#57b2cc',
  cyanBright: '#8fd7f2',
  titleBg: '#131b23',
  titleFg: '#9fb2c4',
  invBg: '#f0a832',
  invFg: '#000000',
};

const TUI = {
  ctx: null, W: 1920, H: 1080,
  cellW: 12, cellH: 22, cols: 159, rows: 49,
  offX: 0, offY: 0,
  font: '20px "DejaVu Sans Mono", "WenQuanYi Zen Hei Mono", monospace',
  fontBig: '26px "DejaVu Sans Mono", "WenQuanYi Zen Hei Mono", monospace',
  fontHuge: '64px "DejaVu Sans Mono", "WenQuanYi Zen Hei Mono", monospace',

  init(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    this.ctx = ctx;
    this.W = canvas.width; this.H = canvas.height;
    ctx.font = this.font;
    this.cellW = ctx.measureText('M').width;
    this.cellH = 22;
    this.cols = Math.floor(this.W / this.cellW);
    this.rows = Math.floor(this.H / this.cellH);
    this.offX = Math.round((this.W - this.cols * this.cellW) / 2);
    this.offY = Math.round((this.H - this.rows * this.cellH) / 2);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
  },

  px(col) { return this.offX + col * this.cellW; },
  py(row) { return this.offY + row * this.cellH; },
  wpx(n) { return n * this.cellW; },
  hpx(n) { return n * this.cellH; },

  clear(color) {
    const c = this.ctx;
    c.fillStyle = color || PAL.bg;
    c.fillRect(0, 0, this.W, this.H);
  },

  // rect in cells
  fillCells(col, row, w, h, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.fillRect(this.px(col), this.py(row), this.wpx(w), this.hpx(h));
  },

  panel(col, row, w, h, title, opts) {
    opts = opts || {};
    const c = this.ctx;
    const bcol = opts.border || PAL.border;
    c.save();
    c.strokeStyle = bcol;
    c.lineWidth = 1;
    const x = Math.round(this.px(col)) + 0.5;
    const y = Math.round(this.py(row)) + 0.5;
    c.strokeRect(x, y, Math.round(this.wpx(w)) - 1, Math.round(this.hpx(h)) - 1);
    if (title) {
      const label = ' ' + title + ' ';
      c.font = this.font;
      const tw = c.measureText(label).width;
      const lx = x + this.cellW * 0.6;
      // title sits inside the top border row, breaking the line (classic TUI)
      c.fillStyle = PAL.bg;
      c.fillRect(lx, y - 1, tw, 15);
      c.fillStyle = opts.titleColor || bcol;
      c.textBaseline = 'top';
      c.fillText(label, lx, y + 1);
    }
    c.restore();
  },

  // clipped drawing region in cells
  clip(col, row, w, h, fn) {
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.rect(this.px(col), this.py(row), this.wpx(w), this.hpx(h));
    c.clip();
    fn();
    c.restore();
  },

  ellipsize(str, maxCols) {
    if (maxCols <= 1) return str.slice(0, maxCols);
    return str.length <= maxCols ? str : str.slice(0, maxCols - 1) + '…';
  },

  // single-line text at cell position; maxCols truncates
  text(col, row, str, color, opts) {
    opts = opts || {};
    if (str === undefined || str === null || str === '') return;
    const c = this.ctx;
    c.font = opts.font || this.font;
    c.fillStyle = color || PAL.text;
    if (opts.alpha !== undefined) c.globalAlpha = opts.alpha;
    let s = String(str);
    if (opts.maxCols !== undefined) s = this.ellipsize(s, opts.maxCols);
    c.fillText(s, this.px(col) + (opts.dx || 0), this.py(row) + (opts.dy || 0));
    c.globalAlpha = 1;
    c.font = this.font;
  },

  // horizontal bar built from cell blocks: level 0..1 across n cells
  hbar(col, row, n, level, fillChar, emptyChar, color, colorEmpty) {
    const filled = Math.round(clamp(level, 0, 1) * n);
    let s = '';
    for (let i = 0; i < n; i++) s += i < filled ? fillChar : emptyChar;
    this.text(col, row, s, color);
    void colorEmpty;
  },
};

// box-drawing helpers for inner dividers
function hline(row, col0, col1, color) {
  TUI.text(col0, row, '─'.repeat(Math.max(0, col1 - col0)), color || PAL.dimmer);
}
