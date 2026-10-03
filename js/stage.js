// stage.js — shot-driven animated stage (left-top STAGE panel)
// Every visual derives from audio clock t; same t => same frame (seek-safe).
'use strict';

const SHOTS = [
  { t0: 0,      t1: 13.89,  id: 'power',   name: 'POWER-ON' },
  { t0: 13.89,  t1: 29.7,   id: 'summon',  name: 'SUMMON' },
  { t0: 29.7,   t1: 59.22,  id: 'geometry',name: 'GEOMETRY' },
  { t0: 59.22,  t1: 74.04,  id: 'charge',  name: 'CHARGE' },
  { t0: 74.04,  t1: 114.04, id: 'mimic',   name: 'MIMIC' },
  { t0: 114.04, t1: 131.3,  id: 'sever',   name: 'SEVER' },
  { t0: 131.3,  t1: 147.0,  id: 'wait',    name: 'WAIT' },
  { t0: 147.0,  t1: 161.9,  id: 'storm',   name: 'STORM' },
  { t0: 161.9,  t1: 177.24, id: 'reboot',  name: 'REBOOT' },
  { t0: 177.24, t1: 191.5,  id: 'solve',   name: 'SOLVE' },
  { t0: 191.5,  t1: 205.81, id: 'idle',    name: 'IDLE' },
  { t0: 205.81, t1: 1e9,    id: 'exit',    name: 'EXIT' },
];
function shotAt(t) {
  let s = SHOTS[0];
  for (const sh of SHOTS) { if (sh.t0 <= t) s = sh; else break; }
  return s;
}

// ---- stage-local text helper: local (0..92, 0..25) -> absolute cells ----
function SA(col, row, str, color, opts) { TUI.text(1 + col, 2 + row, str, color, opts); }
function SAbig(col, row, str, color) {
  const c = TUI.ctx;
  c.font = TUI.fontBig;
  c.fillStyle = color;
  c.fillText(str, TUI.px(1 + col), TUI.py(2 + row) + 2);
  c.font = TUI.font;
}

const AV = ['  .--.  ', ' (o  o) ', '  ||||  ', ' /|\\/|\\ ', ' / \\ / \\'];
const AV_SAD = ['  .--.  ', ' (x  x) ', '  ||||  ', ' /|\\/|\\ ', ' / \\ / \\'];
const AV_SIT = ['         ', '  .--.  ', ' (o  o) ', ' /|/|   ', '   |/ \\ '];

// ---- word-timeline keyword timing: stage reacts when the KEYWORD is sung ----
function holdEndOf(c) {
  return c.t + Math.min(c.end - c.t, clamp(0.8 + c.text.length * 0.09, 1.2, 4.2));
}
function keywordOf(c) {
  if (!c) return null;
  const ws = window.WORDS && window.WORDS[c.i];
  const tOf = (pred) => { const e = ws ? ws.find(x => pred(x[0])) : null; return e ? e[1] : c.t; };
  const litEnd = holdEndOf(c);
  if (c.text.includes('dizzy')) return { word: 'SO DIZZY', litAt: c.t, litEnd };
  if (/To [FS] to [FM]/.test(c.text)) {
    const isF = c.text.includes('F to M');
    return { word: isF ? 'F ⇄ M' : 'S ⇄ M', litAt: tOf(w => /^[FM]$/.test(w)), litEnd };
  }
  if (c.text.includes('AC to DC')) return { word: 'AC ⇄ DC', litAt: tOf(w => w === 'AC'), litEnd };
  if (c.text.includes('A.D to B.C')) return { word: 'AD ⇄ BC', litAt: tOf(w => w === 'A.D'), litEnd };
  if (CAPS_RE.test(c.text)) {
    const m = c.text.match(CAPS_SPLIT);
    return { word: m ? m[1] : c.text, litAt: tOf(w => CAPS_RE.test(w)), litEnd };
  }
  return null;
}
function sceneLook(t) {
  const c = cueAt(t);
  if (!c) return { word: '', lit: false };
  const own = keywordOf(c);
  if (own) {
    const lit = t >= own.litAt && t <= own.litEnd;
    return { word: own.word, lit, cue: c };
  }
  for (let i = c.i + 1; i < CUES.length; i++) {
    const k = keywordOf(CUES[i]);
    if (k) return { word: k.word, lit: false, cue: CUES[i] };
  }
  return { word: '', lit: false };
}
function sceneOf(word) {
  const w = word.toUpperCase();
  if (w.includes('DIMENSION')) return 'cloud';
  if (w.includes('CIRCUMFERENCE')) return 'circle';
  if (w.includes('TANGENTS')) return 'wave';
  if (w.includes('LIMITATION')) return 'limits';
  if (w.includes('NUTRIENT')) return 'eggplant';
  if (w.includes('ANTIOXIDANT')) return 'tomato';
  if (w.includes('ENJOYMENT')) return 'cat';
  if (w.includes('EXISTENCE')) return 'assert';
  if (w.includes('VIBRATION')) return 'wave';
  if (w.includes('COMPLETION')) return 'complete';
  if (w === 'AC ⇄ DC') return 'square';
  if (w === 'AD ⇄ BC') return 'eraband';
  if (w === 'F ⇄ M' || w === 'S ⇄ M') return 'register';
  if (w === 'AM' || w === 'PM') return 'clock';
  if (w.includes('SATISFACTION') || w.includes('STIMULATION')) return 'gauges';
  if (w.includes('EXECUTION')) return 'exec';
  if (w.includes('SIMULATION')) return 'simbox';
  if (w.includes('PROTECTION')) return 'shield';
  return null;
}

function watermark(sc) {
  if (!sc.word) return;
  const c = TUI.ctx;
  c.font = TUI.fontBig;
  const wpx = c.measureText(sc.word).width;
  c.font = TUI.font;
  const col = Math.round((93 - sc.word.length) / 2);
  SA(col, 0, sc.word, sc.lit ? PAL.accent : PAL.dimmer);
  void wpx;
}

function gauge(col, row, w, frac, label) {
  const f = clamp(frac, 0, 1);
  const fill = Math.round(w * f);
  SA(col, row, label + ' [' + '█'.repeat(fill) + '░'.repeat(w - fill) + '] ' +
    String(Math.round(f * 100)).padStart(3) + '%', f > 0.99 ? PAL.ok : (f > 0 ? PAL.accent : PAL.dim));
}

// ---------- generic stage light (fallback beat) ----------
function lightGrid(t, sc) {
  const bucket = Math.floor(t * 4);
  const e = energy(t);
  for (let i = 0; i < 7; i++) {
    const h = 1 + Math.floor(rnd01(i, bucket) * 4 * (0.4 + e * 0.8));
    for (let k = 0; k < h; k++) {
      SA(14 + i * 10, 22 - k, '█', sc.lit && k === h - 1 ? PAL.accentDim : PAL.dimmer);
    }
  }
}

// ---------- shots ----------
function actPower(t, sc) {
  // power line + switch
  let line = '─'.repeat(60);
  const on = t >= 0.55;
  SA(16, 5, line.slice(0, 24) + (on ? '●' : '╳') + line.slice(25), on ? PAL.accent : PAL.errDim);
  SA(16, 6, on ? '[breaker CLOSED — power stable]' : '[breaker OPEN — switching on…]',
    on ? PAL.ok : PAL.dim);
  if (on && t < 1.4) SA(38, 4, '*', PAL.accent);

  // pieces drop (3.87)
  if (t >= 3.87) {
    for (let i = 0; i < 8; i++) {
      const tp = 3.9 + i * 0.13;
      const p = easeOut(clamp((t - tp) / 0.5, 0, 1));
      const y = Math.round(lerp(1, 11, p));
      const landed = p >= 1;
      SA(24 + i * 5, y, landed ? '▣' : '□', landed ? PAL.text : PAL.accent);
    }
    SA(16, 13, 'layout: 8/8 pieces placed', PAL.dim);
  }
  // parameters fill (7.44)
  if (t >= 7.44) {
    const names = ['name', 'params', 'world', 'self'];
    for (let i = 0; i < 4; i++) {
      const p = easeOut(clamp((t - (7.5 + i * 0.5)) / 1.1, 0, 1));
      SA(18, 16 + i, names[i].padEnd(8) + '=' + '▓'.repeat(Math.round(p * 22)),
        p >= 1 ? PAL.ok : PAL.accent);
    }
  }
  // INIT gauge (10.09 -> 13.89)
  if (t >= 10.09) {
    gauge(18, 23, 40, (t - 10.09) / (13.89 - 10.09), 'INIT');
  }
  // PROTECTION shield — lights when the word is sung (2.92)
  const cP = CUES.find(c => c.text === 'PROTECTION');
  if (cP && t >= cP.t) {
    SA(64, 8, '▄▀▀▀▀▄', PAL.accent);
    SA(64, 9, '█ ◆ █', PAL.accent);
    SA(65, 10, ' ▀▄▄▀ ', PAL.accent);
    SA(56, 11, 'fs.protect: read-only mount', PAL.ok);
  }
  // OBJECT CREATION pool — blocks spawn word by word (OBJECT -> half, CREATION -> full)
  const cO = CUES.find(c => c.text === 'OBJECT CREATION');
  if (cO && t >= cO.t) {
    const wsO = window.WORDS && window.WORDS[cO.i];
    const w2 = wsO && wsO[1] ? wsO[1][1] : cO.end;
    const n = t >= w2 ? 8 : 4;
    for (let i = 0; i < n; i++) {
      SA(57 + (i % 4) * 5, 15 + Math.floor(i / 4) * 2, '▣', PAL.cyan);
    }
    SA(57, 20, t >= w2 ? 'object pool: +64 slots ready' : 'allocating objects…',
      t >= w2 ? PAL.ok : PAL.accent);
  }
}

function drawAvatar(geoCol, geoRow, t, sad, sit) {
  const art = sit ? AV_SIT : (sad ? AV_SAD : AV);
  for (let r = 0; r < art.length; r++) SA(geoCol, geoRow + r, art[r], sad ? PAL.err : PAL.bright);
  void t;
}

function actSummon(t) {
  const cmd = 'world.execute(me);';
  if (t < 16.0) {
    SA(30, 6, '$ awaiting macro…', PAL.dim);
    SA(30, 7, '_', Math.floor(t * 2) % 2 ? PAL.accent : PAL.dimmer);
    // SIMULATION scan box (lights when that word is sung at 13.89)
    const cS = CUES.filter(c => c.text === 'SIMULATION').pop();
    if (cS && t >= cS.t) {
      const w = 24, x0 = 34, y0 = 11;
      SA(x0, y0, '┌' + '─'.repeat(w) + '┐', PAL.cyan);
      for (let r = 1; r <= 6; r++) SA(x0, y0 + r, '│' + ' '.repeat(w) + '│', PAL.cyan);
      SA(x0, y0 + 7, '└' + '─'.repeat(w) + '┘', PAL.cyan);
      const scan = 1 + (Math.floor((t - cS.t) * 9) % 6);
      SA(x0 + 1, y0 + scan, '░'.repeat(w - 1), PAL.cyanBright);
      SA(x0 + 3, y0 + 3, 'simulation: tick 60Hz', PAL.accent);
      SA(x0 + 1, y0 + 9, 'engaged — world scope', PAL.ok);
    }
    return;
  }
  // typed macro line (big)
  const p = clamp((t - 16.0) / 1.2, 0, 1);
  const shown = cmd.slice(0, Math.max(1, Math.ceil(cmd.length * easeOut(p))));
  SAbig(20, 6, '$ ' + shown, PAL.accent);
  if (p >= 1 && t < 16.55) {
    TUI.fillCells(21, 12, 24, 1, PAL.accent);
    TUI.text(22, 12, 'ENTER pressed', '#000000');
  }
  // avatar assembles after ENTER
  if (t >= 16.35) {
    const art = AV;
    for (let r = 0; r < art.length; r++) {
      for (let i = 0; i < art[r].length; i++) {
        const ch = art[r][i];
        if (ch === ' ') continue;
        const at = 16.35 + rnd01(r, i) * 0.9;
        if (t >= at) SA(42 + i, 15 + r, ch, PAL.bright);
        else SA(42 + i, 15 + r, '·', PAL.dimmer);
      }
    }
    if (t >= 17.6) SA(34, 22, 'entity created: self · pid 1280', PAL.ok);
  }
}

function actGeometry(t, sc, geo) {
  watermark(sc);
  const lit = sc.lit;
  const dim = lit ? PAL.text : PAL.dim;
  switch (geo) {
    case 'cloud': {
      for (let i = 0; i < 40; i++) {
        const bx = 10 + rnd01(i, 1) * 74;
        const by = 6 + rnd01(i, 2) * 16;
        const x = bx + Math.sin(t * 0.8 + i) * 1.6;
        const y = by + Math.cos(t * 0.6 + i * 1.7) * 0.9;
        SA(Math.round(x), Math.round(y), i % 6 === 0 && lit ? '✳' : '·',
          i % 6 === 0 && lit ? PAL.accent : dim);
      }
      SA(4, 24, lit ? 'dim=2  points=40  rendered' : 'evaluating points…', lit ? PAL.ok : PAL.dimmer);
      break;
    }
    case 'circle': {
      const cx = 46, cy = 15, R = 12;
      for (let k = 0; k < 72; k++) {
        const a = (k / 72) * TAU;
        SA(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R * 0.55), '·', dim);
      }
      const ang = t * 1.15;
      for (let k = 1; k < 11; k++) {
        const rr = (k / 11) * R;
        SA(Math.round(cx + Math.cos(ang) * rr), Math.round(cy + Math.sin(ang) * rr * 0.55), '·',
          lit ? PAL.accent : PAL.dimmer);
      }
      SA(Math.round(cx + Math.cos(ang) * R), Math.round(cy + Math.sin(ang) * R * 0.55), '●',
        lit ? PAL.accent : PAL.dim);
      SA(4, 24, '2*pi*r   r=1.000', dim);
      break;
    }
    case 'wave': {
      const A = 7, base = 14;
      const u = (col) => col * 0.17 - t * 3.1;
      const yAt = (col) => base - Math.sin(u(col)) * A;
      const curveCol = lit ? PAL.text : PAL.dim;
      let prevR = Math.round(yAt(0));
      for (let col = 0; col < 90; col++) {
        const y = yAt(col);
        const yr = Math.round(y);
        if (Math.abs(yr - prevR) > 1) {
          const lo = Math.min(yr, prevR), hi = Math.max(yr, prevR);
          for (let rr = lo + 1; rr < hi; rr++) SA(2 + col, rr, '│', curveCol);
        }
        SA(2 + col, yr, '─', curveCol);
        prevR = yr;
      }
      // tangent line sweeping across the curve
      const pc = 6 + ((t * 14) % 78);
      const slope = -Math.cos(u(pc)) * 0.17 * A;      // d(row)/d(col)
      const yc = yAt(pc);
      for (let d = -10; d <= 10; d++) {
        const cc = pc + d;
        if (cc < 0 || cc > 89) continue;
        const rr = Math.round(yc + slope * d);
        if (rr < 6 || rr > 22) continue;
        const near = Math.abs(d) <= 1;
        SA(2 + cc, rr, near ? '●' : (slope > 0.3 ? '╲' : slope < -0.3 ? '╱' : '─'),
          near ? (lit ? PAL.accent : PAL.dim) : (lit ? PAL.accentDim : PAL.dimmer));
      }
      SA(4, 24, lit ? 'y=sin(x) · tangent at ● · slope ' + slope.toFixed(2)
                    : 'plotting sine…', lit ? PAL.accent : PAL.dimmer);
      break;
    }
    case 'limits': {
      const bucket = Math.floor(t * 6);
      const dig = String(Math.floor(rnd01(bucket, 3) * 9000) + 1000);
      const exp = 12 + (bucket % 80);
      SAbig(30, 10, '1.' + dig.slice(0, 3) + 'e+' + exp, dim);
      const done = sc.lit && sc.cue && t - sc.cue.t > 1.1;
      SA(done ? 40 : 34, 17, done ? '→ ∞ (clamped)' : 'x → ∞', done ? PAL.accent : PAL.dim);
      SA(4, 24, lit ? 'approaching infinity…' : 'eval limit', dim);
      break;
    }
    case 'square': {
      // two lanes: AC = alternating square wave, DC = constant line; switch when "DC" is sung
      const cue = sc.cue;
      const ws = cue && window.WORDS && window.WORDS[cue.i];
      const dcW = ws ? ws.find(x => x[0] === 'DC') : null;
      const dcAt = dcW ? dcW[1] : (cue ? cue.end : t);
      const toDC = !!cue && t >= dcAt;
      const AC_ON = lit && !toDC, DC_ON = lit && toDC;

      SA(6, 8, 'AC', AC_ON ? PAL.accent : (lit ? PAL.dimmer : PAL.dim));
      for (let x = 0; x < 73; x++) {
        const high = Math.floor((x + Math.floor(t * 8)) / 6) % 2 === 0;
        SA(14 + x, high ? 9 : 11, '─', AC_ON ? PAL.text : PAL.dimmer);
        const prevHigh = Math.floor((x - 1 + Math.floor(t * 8)) / 6) % 2 === 0;
        if (x > 0 && high !== prevHigh) SA(14 + x, 10, '│', AC_ON ? PAL.text : PAL.dimmer);
      }
      SA(6, 15, 'DC', DC_ON ? PAL.accent : (lit ? PAL.dimmer : PAL.dim));
      SA(14, 15, '─'.repeat(73), DC_ON ? PAL.text : PAL.dimmer);
      if (lit) SA(3, toDC ? 15 : 8, '▶', PAL.accent);

      SA(34, 20, 'switch: AC → DC', lit ? PAL.accent : PAL.dim);
      SA(38, 22, toDC ? 'DC active — constant' : 'AC active — alternating',
        lit ? (toDC ? PAL.ok : PAL.cyan) : PAL.dimmer);
      SA(36, 24, 'polarity switch', PAL.dimmer);
      break;
    }
    case 'eraband': {
      // time travel: AD era countdown -> BC era countdown, marker slides when "B.C" is sung
      const cue = sc.cue;
      const ws = cue && window.WORDS && window.WORDS[cue.i];
      const bcW = ws ? ws.find(x => x[0] === 'B.C') : null;
      const bcAt = bcW ? bcW[1] : (cue ? cue.end : t);
      const toBC = !!cue && t >= bcAt;
      const endShown = cue ? Math.min(holdEndOf(cue), cue.end) : t;
      let year, prog;
      if (!toBC) {
        prog = cue ? clamp((t - cue.t) / Math.max(0.1, bcAt - cue.t), 0, 1) : 0;
        year = 2026 - Math.floor(prog * (2026 - 1));
      } else {
        prog = 1;
        const p2 = cue ? clamp((t - bcAt) / Math.max(0.1, endShown - bcAt), 0, 1) : 1;
        year = Math.max(1, 753 - Math.floor(p2 * 752));
      }
      SAbig(37, 7, (toBC ? 'BC ' : 'AD ') + Math.abs(year), lit ? PAL.accent : PAL.dim);
      SA(14, 13, 'AD', lit ? (toBC ? PAL.dimmer : PAL.accent) : PAL.dim);
      SA(20, 13, '─'.repeat(50), lit ? PAL.text : PAL.dimmer);
      SA(72, 13, 'BC', lit ? (toBC ? PAL.accent : PAL.dimmer) : PAL.dim);
      SA(20 + Math.round(prog * 49), 13, '▼', lit ? PAL.accent : PAL.dim);
      SA(34, 18, 'timebase: AD → BC', lit ? PAL.accent : PAL.dim);
      SA(32, 22, toBC ? 'B.C. — counting down' : 'A.D. — counting down',
        lit ? PAL.cyan : PAL.dimmer);
      SA(36, 24, 'travel', PAL.dimmer);
      break;
    }
    default: {
      // dizzy or generic: jittering glyph band
      const q = Math.floor(t * 12);
      for (let col = 0; col < 60; col++) {
        SA(6 + col + Math.round((rnd01(col, q) - 0.5) * 6), 14 + Math.round((rnd01(col, q, 2) - 0.5) * 5),
          col % 3 ? '~' : '≈', lit ? PAL.accent : PAL.dim);
      }
      SA(40, 22, 'so dizzy…', lit ? PAL.err : PAL.dim);
    }
  }
}

function actCharge(t) {
  const cSim = CUES.find(c => c.text.includes('STIMULATIONS'));
  const cSat = CUES.find(c => c.text.includes('SATISFACTION'));
  const cExe = CUES.find(c => c.text === 'EXECUTION' && c.t > 60);
  if (cSim) gauge(20, 5, 50, t < cSim.t ? 0 : clamp((t - cSim.t) / (cSim.end - cSim.t), 0, 1), 'STIMUL');
  if (cSat) gauge(20, 8, 50, t < cSat.t ? 0 : clamp((t - cSat.t) / (cSat.end - cSat.t), 0, 1), 'SATISF');
  if (cExe && t >= cExe.t) {
    const p = clamp((t - cExe.t) / 2.4, 0, 1);
    gauge(20, 13, 50, p, 'EXEC  ');
    drawAvatar(44, 17, t, false, false);
    SA(30, 23, p >= 1 ? 'exit code 0 — but the world persists' : 'running… SIGTERM pending',
      p >= 1 ? PAL.ok : PAL.accent);
  } else {
    drawAvatar(44, 14, t, false, false);
    SA(34, 21, 'system armed — awaiting stimuli', PAL.dim);
  }
}

function actMimic(t, sc) {
  watermark(sc);
  const lit = sc.lit;
  const col = lit ? PAL.bright : PAL.dim;
  switch (sceneOf(sc.word)) {
    case 'eggplant':
      SA(39, 10, '     __/\\_     ', col);
      SA(38, 11, '    /  ,-. \\    ', col); SA(38, 12, '   |  |   | |   ', col);
      SA(38, 13, '    \\  `-. /    ', col); SA(38, 14, '     `~.__/~    ', col);
      SA(36, 18, lit ? 'nutrients +1 — served' : 'ripening…', lit ? PAL.ok : PAL.dimmer);
      break;
    case 'tomato':
      SA(40, 9, '    __   ', col); SA(39, 10, '   /  \\_ ', col);
      SA(38, 11, '  | o  o |', col); SA(38, 12, '  |  __  |', col); SA(39, 13, '  \\__/ / ', col);
      SA(39, 14, '       ~ ', PAL.dimmer);
      SA(36, 18, lit ? 'antioxidants — scan clean' : 'scanning…', lit ? PAL.ok : PAL.dimmer);
      break;
    case 'cat': {
      const blink = Math.floor(t * 1.1) % 5 === 0;
      const eye = blink ? '-.-' : 'o.o';
      SA(38, 9, ' /\\_/\\  ', col);
      SA(37, 10, '(' + eye + ') ', col);
      SA(38, 11, ' > ^ <   ', col);
      const bob = Math.round(Math.sin(t * 2.2) * 1);
      SA(38, 14 + bob, 'purrrrrr…', lit ? PAL.accent : PAL.dimmer);
      SA(36, 18, lit ? 'purr() -> void, enjoyment 100%' : 'listening…', PAL.dimmer);
      break;
    }
    case 'assert': {
      const open = Math.floor(t * 0.7) % 3 !== 0;
      SA(34, 9, '┌── assert(self != null) ──┐', col);
      SA(34, 10, '│      ' + (open ? '◉' : '◎') + '  !=  null      │', col);
      SA(34, 11, '└────────── ' + (lit ? 'PASS' : '....') + ' ────────┘', lit ? PAL.ok : col);
      SA(38, 15, 'existence proven', lit ? PAL.accent : PAL.dimmer);
      break;
    }
    case 'register': {
      const isF = Math.floor(t * 2.2) % 2 === 0;
      const showF = sc.word.startsWith('S') ? !isF : isF;
      SAbig(42, 9, showF ? (sc.word.startsWith('F') ? 'F' : 'S') : (sc.word.startsWith('F') ? 'M' : 'M'),
        lit ? PAL.accent : col);
      SA(36, 16, 'register swapping ' + Math.floor((t * 10) % 99) + 'Hz', col);
      break;
    }
    case 'clock': {
      const am = Math.floor(t / 3) % 2 === 0;
      const mm = String(Math.floor(t * 7) % 60).padStart(2, '0');
      SAbig(38, 9, '12:' + mm + ' ' + (am ? 'AM' : 'PM'), lit ? PAL.accent : col);
      SA(36, 16, 'doing whatever — round the clock', col);
      break;
    }
    case 'wave': {
      const A2 = 4, b2 = 13;
      for (let col = 0; col < 80; col++) {
        const y = b2 - Math.sin(col * 0.3 - t * 5.2) * A2;
        SA(6 + col, Math.round(y), '─', lit ? PAL.text : PAL.dim);
      }
      SA(6, 18, 'carrier f = 432.0 Hz', lit ? PAL.accent : PAL.dimmer);
      SA(6, 20, lit ? 'vibrating — resonance locked' : 'resonance…', lit ? PAL.cyan : PAL.dimmer);
      break;
    }
    case 'complete':
      gauge(24, 12, 45, 1, 'COMPLETE');
      SA(36, 16, lit ? 'state: COMPLETION reached' : 'almost…', lit ? PAL.ok : PAL.dimmer);
      break;
    default:
      drawAvatar(44, 11, t, false, false);
      lightGrid(t, sc);
  }
}

function actSever(t) {
  const errs = ['ISOLATION', 'FRAGMENTS', 'DISHEARTENED', 'ILLEGAL ARGUMENTS']
    .map(kw => CUES.find(c => c.text.includes(kw))).filter(Boolean);
  const broken = errs.filter(c => t >= c.t).length;
  drawAvatar(40, 11, t, broken >= 1, false);
  const rows = [9, 14, 19];
  for (let i = 0; i < 3; i++) {
    const isBroken = broken > i;
    const y = rows[i];
    SA(50, y, isBroken ? '─ ─ ─ ×' : '═════════════════════════>',
      isBroken ? PAL.errDim : PAL.cyan);
    if (isBroken) SA(57, y, '⌁', PAL.err);
  }
  if (broken >= 1) {
    SAbig(66, 8, broken >= 3 ? '</3>' : '</3', PAL.err);
    SA(64, 15, 'severed x' + broken + '/3', PAL.err);
  }
  SA(10, 24, 'io.network ' + (broken ? 'LINK BROKEN' : 'connected') +
    ' · heart.service ' + (broken >= 2 ? 'DEGRADED' : 'RUNNING'), broken ? PAL.err : PAL.ok);
}

function actWait(t) {
  const blink = Math.floor(t * 2) % 2 === 0;
  SAbig(42, 10, '> ' + (blink ? '█' : ' '), PAL.dim);
  const queued = onsetsBetween(t, 147);
  SA(34, 16, 'onsets queued → storm: ' + String(queued).padStart(3), queued > 0 ? PAL.accent : PAL.dim);
  const p = (t - 131.3) / (147 - 131.3);
  const dens = clamp(p, 0, 1) * 0.16;
  const q = Math.floor(t * 4);
  for (let i = 0; i < 340; i++) {
    if (rnd01(i, q) < dens) {
      const col = 2 + Math.floor(rnd01(i, 1) * 88);
      const row = 2 + Math.floor(rnd01(i, 2) * 23);
      SA(col - 1, row - 2, '·', PAL.dimmer);
    }
  }
  SA(30, 22, p > 0.75 ? 'buffer overflow imminent' : 'waiting…', p > 0.75 ? PAL.err : PAL.dimmer);
}

function actReboot(t) {
  const p = clamp((t - 161.9) / (177.24 - 161.9), 0, 1);
  gauge(20, 5, 50, p, 'RE-EXEC');
  // reassembling avatar with speed lines
  const build = clamp((t - 161.9) / 1.4, 0, 1);
  const art = AV;
  for (let r = 0; r < art.length; r++) {
    for (let i = 0; i < art[r].length; i++) {
      const ch = art[r][i];
      if (ch === ' ') continue;
      if (rnd01(r, i, 7) < build) SA(44 + i, 12 + r, ch, PAL.bright);
      else SA(44 + i, 12 + r, '░', PAL.dimmer);
    }
  }
  const run = Math.floor(t * 9) % 2;
  SA(34, 17 + run, '>>', PAL.accent); SA(56, 13 - run, '>>', PAL.accent);
  // glitch rows on impulse
  const imp = onsetImpulse(t);
  if (imp > 1.1) {
    const q = Math.floor(t * 30);
    for (let k = 0; k < 3; k++) {
      const row = 4 + Math.floor(rnd01(k, q) * 20);
      const sh = Math.round((rnd01(k, q, 1) - 0.5) * 30);
      SA(4 + sh, row, '···· world.execute(me); ····', PAL.err);
    }
  }
  SA(30, 23, 'rebuilding world state ' + Math.round(p * 100) + '%', PAL.ok);
}

function actSolve(t) {
  const solved = t >= 187;
  // each sung LO-O-OVE triggers a heart bloom (word-timed)
  const loCues = CUES.filter(c => c.text === 'LO-O-OVE');
  const loHit = loCues.find(c => {
    const k = keywordOf(c);
    return k && t >= k.litAt && t < k.litAt + 0.9;
  });
  SAbig(solved ? 30 : 34, 6, solved ? 'love := ♥' : 'love = ?', solved ? PAL.accent : PAL.bright);
  // heart with beat pulse
  const imp = onsetImpulse(t);
  const beat = imp > 0.62 || loHit;
  const H = ['  ██  ██  ', ' ████████ ', '  ██████  ', '   ████   ', '    ██    '];
  const r0 = beat ? 11 : 12;
  for (let r = 0; r < H.length; r++) SA(41, r0 + r, H[r], beat ? PAL.bright : PAL.accent);
  if (beat) {
    SA(40, r0 + 1, '▌', PAL.accent); SA(51, r0 + 1, '▐', PAL.accent);
  }
  if (loHit) {
    SA(38, r0 - 2, '♥ bloom — LO-O-OVE', PAL.bright);
    const pulse = Math.floor((t - keywordOf(loHit).litAt) * 12) % 2;
    if (pulse) SA(36, r0 + 6, '  ∙  ♥  ∙  ', PAL.accent);
  }
  SA(32, 19, solved ? 'eval(love) = true — bpm ' + (58 + Math.round(energy(t) * 60)) :
    'computing algebraic expression of…', solved ? PAL.ok : PAL.dim);
}

function actIdle(t) {
  const bob = Math.round(Math.sin(t * 0.6) * 1);
  drawAvatar(44, 12 + bob, t, false, true);
  const zc = Math.floor(t * 1.4) % 3;
  SA(53, 9 - zc, 'z', PAL.dim); SA(55, 7 - (zc + 1) % 3, 'z', PAL.dimmer);
  SA(32, 21, 'idle · ticks draining · tty warm', PAL.dimmer);
}

// ---------- stage master ----------
function drawStage(t, st, style, imp, active) {
  const shot = shotAt(t);
  const p = L.stage;
  const cutting = (t - st.t) < 0.16;
  TUI.panel(p.c, p.r, p.w, p.h,
    'STAGE / ' + String(SHOTS.indexOf(shot) + 1).padStart(2, '0') + ' ' + shot.name +
    ' · shot=' + shot.id,
    { border: cutting ? PAL.accent : style.border, titleColor: cutting ? PAL.accent : style.border });

  const ix = p.c + 1, iy = p.r + 1, iw = p.w - 2, ih = p.h - 2;
  TUI.clip(ix, iy, iw, ih, () => {
    const c = TUI.ctx;
    // camera: cut settle + onset punch + shake (storm/dizzy) + slow drift
    const sc = sceneLook(t);
    const dizzy = sc.lit && sc.word === 'SO DIZZY';
    let scale = 1 + 0.05 * Math.exp(-(t - st.t) / 0.35) + 0.022 * Math.min(1, imp);
    let amp = 0;
    if (shot.id === 'storm') amp = 2.4 * Math.min(1, imp);
    if (dizzy) amp = 5;
    const q = Math.floor(t * 30);
    const cx = TUI.px(ix + iw / 2), cy = TUI.py(iy + ih / 2);
    const dx = (rnd01(q, 11) - 0.5) * 2 * amp + Math.sin(t * 0.17) * 3;
    const dy = (rnd01(q, 23) - 0.5) * 2 * amp;
    c.save();
    c.translate(cx + dx, cy + dy);
    c.scale(scale, scale);
    c.translate(-cx, -cy);

    switch (shot.id) {
      case 'power': actPower(t, sc); break;
      case 'summon': actSummon(t); break;
      case 'geometry': actGeometry(t, sc, sceneOf(sc.word)); break;
      case 'charge': actCharge(t); watermark(sc); break;
      case 'mimic': actMimic(t, sc); break;
      case 'sever': actSever(t); break;
      case 'wait': actWait(t); break;
      case 'reboot': actReboot(t); watermark(sc); break;
      case 'solve': actSolve(t); break;
      case 'idle': actIdle(t); break;
      default: lightGrid(t, sc);
    }
    c.restore();
  });
  void active;
}
