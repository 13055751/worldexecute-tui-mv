// plates.js — semantic scenes: section styles, lyric events, takeover overlays
'use strict';

// ---------- lyric keyword -> semantic event (skill §7: lyrics as events) ----------
const EVENT_MAP = [
  ['PROTECTION', 'ok', 'fs.protect: read-only mount'],
  ['OBJECT CREATION', 'ok', 'object pool: +64 slots'],
  ['INITIALIZATION', 'ok', 'world.state: INIT -> READY'],
  ['SIMULATION', 'ok', 'simulation engaged (tick 60Hz)'],
  ['DIMENSION', 'info', 'dim = 2 ; points = 512'],
  ['CIRCUMFERENCE', 'info', '2*pi*r , r = 1.000'],
  ['TANGENTS', 'info', 'tan(theta) sampled x512'],
  ['LIMITATIONS', 'info', 'lim -> inf (clamped)'],
  ['AC to DC', 'info', 'polarity: AC -> DC'],
  ['A.D to B.C', 'info', 'timebase: AD -> BC'],
  ['STIMULATIONS', 'ok', 'feedback loop armed'],
  ['SATISFACTION', 'ok', 'feedback loop closed'],
  ['EXECUTION', 'warn', 'exec() raised from lyric'],
  ['NUTRIENTS', 'ok', 'metabolic intake +1'],
  ['ANTIOXIDANTS', 'ok', 'radical scan: clean'],
  ['ENJOYMENT', 'ok', 'purr() -> void'],
  ['EXISTENCE', 'info', 'assert(self != null) pass'],
  ['F to M', 'info', 'gender register: F -> M'],
  ['S to M', 'info', 'role register: S -> M'],
  ['VIBRATIONS', 'info', 'carrier f = 432.0 Hz'],
  ['COMPLETION', 'ok', 'state: COMPLETED'],
  ['ISOLATION', 'err', 'conn <3 : link severed'],
  ['FRAGMENTS', 'err', 'buffer loss x128 blocks'],
  ['DISHEARTENED', 'err', 'signal degraded 41%'],
  ['ILLEGAL ARGUMENTS', 'err', 'E_ILLEGAL_ARG (0x1F)'],
  ['LO-O-OVE', 'info', 'love: undefined -> print(love)'],
];

function buildEvents() {
  const ev = [];
  for (const c of CUES) {
    for (const [kw, lvl, msg] of EVENT_MAP) {
      if (c.text.includes(kw)) {
        ev.push({ t: c.t, ci: c.i, lvl, msg, kw });
        break;
      }
    }
  }
  // wait-section heartbeats (deterministic, derived from structure not randomness)
  for (let t = 133.0; t < 147.0; t += 2.0) {
    ev.push({ t: Math.round(t * 10) / 10, ci: -1, lvl: 'wait',
      msg: 'awaiting SIGEXEC — ' + onsetsBetween(t, 147) + ' onsets queued' });
  }
  // recovery after storm
  ev.push({ t: 161.9, ci: -1, lvl: 'ok', msg: 'reaping zombies: done' });
  ev.push({ t: 192.5, ci: -1, lvl: 'info', msg: 'load shed: idle ticks only' });
  ev.sort((a, b) => a.t - b.t);
  return ev;
}

// ---------- per-section style ----------
const SECTION_STYLE = {
  boot:        { border: PAL.border,     focusColor: PAL.bright, accent: PAL.accent },
  world:       { border: PAL.accentDim,  focusColor: PAL.accent, accent: PAL.accent },
  v1:          { border: PAL.border,     focusColor: PAL.bright, accent: PAL.accent },
  pre1:        { border: PAL.borderHot,  focusColor: PAL.bright, accent: PAL.accent },
  v2:          { border: PAL.borderHot,  focusColor: PAL.bright, accent: PAL.accent },
  iso:         { border: PAL.errDim,     focusColor: PAL.text,   accent: PAL.err },
  gap:         { border: PAL.border,     focusColor: PAL.dim,    accent: PAL.cyan },
  storm:       { border: PAL.err,        focusColor: PAL.err,    accent: PAL.err },
  final:       { border: PAL.borderHot,  focusColor: PAL.bright, accent: PAL.accent },
  love:        { border: '#4a3a1c',      focusColor: PAL.accent, accent: PAL.accent },
  lull:        { border: PAL.border,     focusColor: PAL.dim,    accent: PAL.accentDim },
  end:         { border: PAL.dimmer,     focusColor: PAL.dim,    accent: PAL.accent },
};

// ---------- ops process table ----------
const PROCS = [
  { n: 'simulation.core', pid: 1024 },
  { n: 'world.renderer', pid: 1102 },
  { n: 'heart.service', pid: 1280 },
  { n: 'memory.cache', pid: 1408 },
  { n: 'io.network', pid: 1536 },
  { n: 'exec.queue', pid: 1792 },
];

function procState(secId, procIdx, t) {
  switch (secId) {
    case 'boot': return procIdx < 3 ? 'INIT' : 'STARTING';
    case 'world': return 'RUNNING';
    case 'v1': return procIdx === 4 ? 'CONNECTING' : 'RUNNING';
    case 'pre1': return 'RUNNING';
    case 'v2': return procIdx === 4 ? 'CONNECTED' : 'RUNNING';
    case 'iso': return ['RUNNING', 'RUNNING', 'DEGRADED', 'EVICTING', 'RETRY', 'PAUSED'][procIdx];
    case 'gap': return procIdx === 5 ? 'ARMED' : 'SLEEP';
    case 'storm': {
      const b = Math.floor((t - 147) * 4);
      const order = ['FAILED', 'KILLED', 'FAILED', 'KILLED', 'FAILED', 'KILLED'];
      return order[(procIdx + hash32(procIdx, b)) % 6];
    }
    case 'final': return 'RUNNING';
    case 'love': return procIdx === 2 ? 'WARM' : 'RUNNING';
    case 'lull': return procIdx === 2 ? 'IDLE' : 'SLEEP';
    case 'end': return 'EXITED';
    default: return 'RUNNING';
  }
}

function procCpu(secId, procIdx, t) {
  const base = {
    boot: 8, world: 30, v1: 42, pre1: 55, v2: 62, iso: 55,
    gap: 12, storm: 99, final: 70, love: 46, lull: 7, end: 0,
  }[secId] || 30;
  const bucket = Math.floor(t * 2);
  const drift = rnd01(procIdx, bucket) * 12;
  const v = base + energy(t) * 22 * (0.4 + rnd01(procIdx, 7) * 0.6) + drift;
  return clamp(Math.round(v), 0, 99);
}

function procMem(procIdx, t) {
  const bucket = Math.floor(t / 4);
  return Math.round(140 + rnd01(procIdx, 42) * 380 + energy(t) * 60 +
    rnd01(procIdx, bucket) * 24);
}

// ---------- STORM takeover overlay (147 – 161.9) ----------
const STORM_TOKENS = [
  'exec()', 'SIGKILL', 'EPERM', '0x7fff', 'core dumped', 'fork(): ENOMEM',
  'world.execute(me);', 'stack smash', 'EINTR', 'reboot', '/dev/heart',
  'permission denied', 'panic()', 'EXIT', 'abort', 'EOF',
];

function drawStorm(t) {
  const c = TUI.ctx;
  const start = 147, endT = 161.9;
  const p = clamp((t - start) / (endT - start), 0, 1);
  const bucket = Math.floor((t - start) * 15);
  const imp = onsetImpulse(t);

  TUI.fillCells(0, 1, TUI.cols, TUI.rows - 2, PAL.bg);
  TUI.clip(0, 1, TUI.cols, TUI.rows - 2, () => {
    for (let row = 0; row < TUI.rows - 2; row++) {
      const y = row + 1;
      const r = rnd01(row, bucket, 1);
      const seedT = STORM_TOKENS[Math.floor(rnd01(row, bucket, 2) * STORM_TOKENS.length)];
      const pid = 1000 + Math.floor(rnd01(row, bucket, 3) * 9000);
      const line = '[' + String(pid).padStart(4, '0') + '] ' + seedT +
        (r < 0.5 ? ' ×' + (2 + Math.floor(rnd01(row, bucket, 4) * 40)) : ' -> retry') +
        (r < 0.22 ? ' — halted' : '');
      const inverse = rnd01(row, bucket, 5) < 0.16;
      const x = Math.floor(rnd01(row, bucket, 6) * 14);
      if (inverse) {
        TUI.fillCells(0, y, TUI.cols, 1, PAL.err);
        TUI.text(1 - x, y, line.toUpperCase(), '#000000');
      } else {
        TUI.text(1 - x, y, line, rnd01(row, 3) < 0.4 ? PAL.errDim : PAL.err,
          { alpha: 0.55 + r * 0.45 });
      }
    }
    // onset flash: hard inverse rows on strong hits
    if (imp > 0.75) {
      const n = Math.floor(imp * 6);
      for (let k = 0; k < n; k++) {
        const rr = Math.floor(rnd01(k, Math.floor(t * 30), 9) * (TUI.rows - 3));
        TUI.fillCells(0, rr + 1, TUI.cols, 1, PAL.accent);
      }
    }
    // takeover header
    TUI.fillCells(0, 1, TUI.cols, 2, '#000000');
    TUI.text(2, 1, '!! PROCESS TAKEOVER — EXECUTION STORM — SIGKILL x' +
      onsetsBetween(147, t), PAL.err);
    TUI.text(2, 2, 'panic: lyric layer exceeded irq budget — halting handlers…',
      PAL.errDim);
    hline(3, 2, TUI.cols - 2, PAL.errDim);

    // multilingual count (cues 101..106: EIN DOS TROIS NE FEM LIU, before EXECUTION@161.58)
    const countCues = CUES.filter(c => c.t >= 158.1 && c.t < 161.5);
    const active = countCues.filter(c => c.t <= t).pop();
    if (active) {
      const prog = clamp((t - active.t) / 0.42, 0, 1);
      const word = active.text.slice(0, Math.max(1, Math.ceil(active.text.length * easeOut(prog))));
      c.font = TUI.fontHuge;
      const tw = c.measureText(word).width;
      const cx = Math.round((TUI.W - tw) / 2);
      const cy = TUI.py(20);
      c.fillStyle = PAL.err;
      c.fillRect(cx - 24, cy - 10, tw + 48, 84);
      c.fillStyle = '#000000';
      c.fillText(word, cx, cy);
      c.font = TUI.font;
      TUI.text(2, 30, 'count: ' + active.text + '  (' + (countCues.indexOf(active) + 1) +
        '/6)  next: ' + (countCues[countCues.indexOf(active) + 1] ?
          countCues[countCues.indexOf(active) + 1].text : 'EXECUTION'), PAL.err);
    }
    void p;
  });
}

// ---------- END overlay (205.81 – duration) ----------
function drawEnd(t) {
  const c = TUI.ctx;
  const t0 = 205.81;
  TUI.clear(PAL.bg);
  const burstEnd = t0 + 1.45;
  if (t < burstEnd) {
    // EXECUTION blink + progressive clear from top
    const blink = Math.floor((t - t0) * 8) % 2 === 0;
    const clearRows = Math.floor((t - t0) * 18);
    for (let row = 0; row < TUI.rows; row++) {
      if (row < clearRows) continue;
      if (blink) {
        TUI.fillCells(0, row, TUI.cols, 1, PAL.err);
        TUI.text(2, row, 'EXECUTION '.repeat(Math.ceil(TUI.cols / 11)), '#000000');
      } else {
        TUI.text(2, row, 'exec() '.repeat(Math.ceil(TUI.cols / 7)), PAL.errDim);
      }
    }
    TUI.text(TUI.cols - 26, 0, 'SIG in ' + (burstEnd - t).toFixed(2) + 's', PAL.err);
    return;
  }
  // clean exit state
  const since = t - burstEnd;
  const blink = Math.floor(since * 2) % 2 === 0;
  const mid = Math.floor(TUI.rows / 2) - 3;
  c.font = TUI.font;
  const title = 'world.execute(me);';
  const tw = c.measureText(title).width;
  TUI.text(Math.round((TUI.cols - title.length) / 2), mid, title, PAL.accent);
  void tw;
  TUI.text(Math.round((TUI.cols - 'process exited with code 0'.length) / 2), mid + 2,
    'process exited with code 0', PAL.ok);
  const prompt = 'mili@world:~$ ';
  const pc = Math.round((TUI.cols - prompt.length - 1) / 2);
  TUI.text(pc, mid + 5, prompt + (blink ? '█' : ' '), PAL.bright);
  TUI.text(pc, mid + 8, 'tty1 closed — world state persisted', PAL.dimmer);
  TUI.text(pc, mid + 11, 'rendered by MiMo V2.6 Flash', PAL.accentDim);
}
