'use strict';
// ============================================================
//  Núcleo: constantes, utilidades, entrada (teclado/controle/toque) e áudio
// ============================================================
const W = 960, H = 540;            // resolução lógica
const GROUND = 472;                // y do chão na tela
const STAGE_W = 1480;              // largura do cenário
const MAX_DIST = 720;              // distância máxima entre os lutadores
const WALL = 58;                   // margem das paredes
const GRAV = 0.62;
const FOOT_PAD = 6;
const DEG = Math.PI / 180;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, k = Math.abs(amt);
  r = Math.round(r + (t - r) * k); g = Math.round(g + (t - g) * k); b = Math.round(b + (t - b) * k);
  return `rgb(${r},${g},${b})`;
}

const G = {};   // estado global do jogo (preenchido em game.js)

// ---------------- Teclado ----------------
const keys = {};
const pressed = [];   // teclas pressionadas desde o último quadro lógico
const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);

addEventListener('keydown', (e) => {
  if (PREVENT.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  pressed.push(e.code);
  audioInit();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const BTNS = ['lp', 'mk', 'hp', 'sp', 'su'];
const ALLK = ['left', 'right', 'up', 'down', ...BTNS];

// 1 jogador: aceita os dois esquemas ao mesmo tempo
const KM_SOLO = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  lp: ['KeyJ', 'KeyF'], mk: ['KeyK', 'KeyG'], hp: ['KeyL', 'KeyH'], sp: ['KeyU', 'KeyR'], su: ['KeyI', 'KeyT'],
};
const KM_P1 = {
  left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
  lp: ['KeyF'], mk: ['KeyG'], hp: ['KeyH'], sp: ['KeyR'], su: ['KeyT'],
};
const KM_P2 = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  lp: ['KeyJ', 'Numpad1'], mk: ['KeyK', 'Numpad2'], hp: ['KeyL', 'Numpad3'], sp: ['KeyU', 'Numpad4'], su: ['KeyI', 'Numpad5'],
};

// ---------------- Toque ----------------
const touch = {};
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

function setupTouch() {
  const pad = document.getElementById('dpad'), knob = document.getElementById('dknob');
  let pid = null;
  const move = (e) => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy), dz = 16;
    touch.left = d > dz && dx < -d * 0.38; touch.right = d > dz && dx > d * 0.38;
    touch.up = d > dz && dy < -d * 0.5; touch.down = d > dz && dy > d * 0.42;
    const m = Math.min(d, 46) / (d || 1);
    knob.style.transform = `translate(${dx * m}px,${dy * m}px)`;
  };
  const end = () => { pid = null; touch.left = touch.right = touch.up = touch.down = false; knob.style.transform = ''; };
  pad.addEventListener('pointerdown', (e) => { pid = e.pointerId; pad.setPointerCapture(pid); move(e); audioInit(); e.preventDefault(); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); });
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  document.querySelectorAll('#btns button').forEach((b) => {
    const k = b.dataset.k;
    const on = (e) => { touch[k] = true; b.classList.add('on'); audioInit(); e.preventDefault(); };
    const off = () => { touch[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  });
  addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------------- Controles (gamepad) ----------------
const padPrev = [{}, {}];
function padState(i) {
  let gp = null;
  try { gp = navigator.getGamepads ? navigator.getGamepads()[i] : null; } catch (e) { gp = null; }
  if (!gp || !gp.connected) return null;
  const b = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed);
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  return {
    left: ax < -0.45 || b(14), right: ax > 0.45 || b(15), up: ay < -0.6 || b(12), down: ay > 0.5 || b(13),
    lp: b(2), mk: b(0), hp: b(1), sp: b(3), su: b(5) || b(7), start: b(9), back: b(8),
  };
}
function pollPads() {
  for (let i = 0; i < 2; i++) {
    const s = padState(i) || {}, p = padPrev[i];
    for (const k in s) if (s[k] && !p[k]) pressed.push('Pad' + i + k);
    padPrev[i] = s;
  }
}

// Estado bruto de entrada de um jogador neste quadro
function rawInput(pi, solo) {
  const map = pi === 0 ? (solo ? KM_SOLO : KM_P1) : KM_P2;
  const r = {};
  for (const k of ALLK) r[k] = map[k].some((c) => keys[c]);
  const ps = padPrev[pi];
  for (const k of ALLK) if (ps[k]) r[k] = true;
  if (pi === 0) for (const k of ALLK) if (touch[k]) r[k] = true;
  if (r.left && r.right) r.left = r.right = false;
  return r;
}

const hit = (...codes) => codes.some((c) => pressed.includes(c));
const MENU = {
  up: () => hit('ArrowUp', 'KeyW', 'Pad0up', 'Pad1up'),
  down: () => hit('ArrowDown', 'KeyS', 'Pad0down', 'Pad1down'),
  left: () => hit('ArrowLeft', 'KeyA', 'Pad0left', 'Pad1left'),
  right: () => hit('ArrowRight', 'KeyD', 'Pad0right', 'Pad1right'),
  ok: () => hit('Enter', 'Space', 'KeyJ', 'KeyF', 'Pad0mk', 'Pad0lp', 'Pad0start', 'Pad1mk'),
  back: () => hit('Escape', 'Backspace', 'Pad0hp', 'Pad0back'),
};

// Buffer de entrada de cada lutador: botões recentes + histórico de direções (para comandos)
class Controller {
  constructor() {
    this.s = {}; for (const k of ALLK) this.s[k] = false;
    this.presses = []; this.dirs = [{ n: 5, f: 0 }]; this.f = 0;
  }
  feed(raw, facing, frozen) {
    if (!frozen) this.f++;   // em hitstop o relógio do buffer para: comandos dados no impacto não expiram
    // direção em notação de teclado numérico, relativa ao lado para o qual o lutador olha
    const fx = ((raw.right ? 1 : 0) - (raw.left ? 1 : 0)) * facing, fy = raw.down ? -1 : raw.up ? 1 : 0;
    const n = 5 + fx + fy * 3;
    // cada botão guarda a direção do instante em que foi apertado (vale mesmo se o golpe sair do buffer depois)
    for (const b of BTNS) if (raw[b] && !this.s[b]) this.presses.push({ b, f: this.f, n });
    for (const k of ALLK) this.s[k] = !!raw[k];
    if (this.dirs[this.dirs.length - 1].n !== n) { this.dirs.push({ n, f: this.f }); if (this.dirs.length > 16) this.dirs.shift(); }
    while (this.presses.length && this.f - this.presses[0].f > 12) this.presses.shift();
  }
  peek(b, win = 7) { return this.presses.some((p) => p.b === b && this.f - p.f <= win); }
  take(b, win = 7) {
    const i = this.presses.findIndex((p) => p.b === b && this.f - p.f <= win);
    if (i < 0) return null; return this.presses.splice(i, 1)[0];
  }
  cur() { return this.dirs[this.dirs.length - 1].n; }
  // steps: lista de conjuntos de direções, em ordem (ex.: [[2],[3,6]] = ↓ ↘/→)
  motion(steps, span = 20, lastWin = 10) {
    let k = steps.length - 1;
    for (let i = this.dirs.length - 1; i >= 0 && k >= 0; i--) {
      const end = i === this.dirs.length - 1 ? this.f : this.dirs[i + 1].f;
      if (this.f - end > (k === steps.length - 1 ? lastWin : span)) return false;
      if (steps[k].includes(this.dirs[i].n)) k--;
    }
    return k < 0;
  }
  clear() { this.presses.length = 0; }
}

// ---------------- Áudio (tudo sintetizado, sem arquivos) ----------------
let AC = null, master = null, musicG = null, noiseBuf = null, muted = false;

function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    AC = new C();
    master = AC.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(AC.destination);
    musicG = AC.createGain(); musicG.gain.value = 0.11; musicG.connect(master);
    const n = AC.sampleRate;
    noiseBuf = AC.createBuffer(1, n, n);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  } catch (e) { AC = null; }
}
function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; }

function tone(f, dur, type, vol, to, delay, dest) {
  if (!AC) return;
  const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, to, q, delay, type) {
  if (!AC) return;
  const t = AC.currentTime + (delay || 0), s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  f.Q.value = q || 1;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.02);
}

const SFX = {
  hit(s) { noise(0.08 + s * 0.03, 0.5 + s * 0.12, 1000 - s * 150, 180, 0.8); tone(175 - s * 25, 0.1 + s * 0.03, 'sine', 0.55, 48); if (s >= 3) noise(0.2, 0.3, 2600, 400, 0.6); },
  block() { noise(0.06, 0.32, 2400, 1200, 3); tone(520, 0.05, 'square', 0.07, 300); },
  whoosh(s) { noise(0.09 + s * 0.02, 0.1 + s * 0.03, 500 + s * 120, 1700, 1.2); },
  jump() { noise(0.1, 0.09, 400, 1300, 1); },
  land() { noise(0.08, 0.2, 300, 90, 1, 0, 'lowpass'); },
  down() { noise(0.2, 0.5, 260, 60, 0.7, 0, 'lowpass'); tone(90, 0.2, 'sine', 0.5, 40); },
  special() { tone(220, 0.18, 'square', 0.09, 660); noise(0.16, 0.14, 1200, 2600, 2); },
  fire() { tone(320, 0.22, 'sawtooth', 0.1, 880); noise(0.22, 0.16, 800, 3000, 1); },
  super() { tone(110, 0.75, 'sawtooth', 0.2, 880); tone(165, 0.75, 'square', 0.09, 1320); noise(0.75, 0.22, 300, 5000, 1); },
  thunder() { noise(0.5, 0.7, 2200, 80, 0.5, 0, 'lowpass'); tone(64, 0.5, 'sine', 0.6, 30); },
  ko() { tone(210, 0.9, 'sawtooth', 0.28, 40); noise(0.6, 0.55, 1500, 100, 0.6); },
  ui() { tone(660, 0.05, 'square', 0.07); },
  ok() { tone(660, 0.07, 'square', 0.09); tone(990, 0.12, 'square', 0.09, null, 0.07); },
  back() { tone(330, 0.1, 'square', 0.07, 220); },
  round() { tone(392, 0.12, 'square', 0.1); tone(523, 0.12, 'square', 0.1, null, 0.13); tone(784, 0.3, 'square', 0.1, null, 0.26); },
  fight() { tone(880, 0.35, 'sawtooth', 0.14, 440); noise(0.3, 0.18, 1500, 400, 1); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.1, null, i * 0.12)); },
};

// Música: um tema marítimo original em 6/8, gerado por osciladores
const NOTE = { A2: 110, C3: 130.8, D3: 146.8, F3: 174.6, G3: 196, A3: 220, C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, C5: 523.3, D5: 587.3 };
const MEL = [
  'D4', 0, 'F4', 'A4', 0, 'F4',   'G4', 0, 'E4', 'C4', 0, 'E4',   'F4', 0, 'A4', 'D5', 0, 'C5',   'A4', 0, 'G4', 'E4', 0, 0,
  'D4', 0, 'F4', 'A4', 0, 'D5',   'C5', 0, 'A4', 'G4', 0, 'E4',   'F4', 'G4', 'A4', 'G4', 'F4', 'E4',   'D4', 0, 0, 'D4', 0, 0,
];
const BASS = ['D3', 'C3', 'D3', 'A2', 'D3', 'C3', 'F3', 'D3'];
function startMusic() {
  let step = 0, next = AC.currentTime + 0.1;
  const T = 0.2;
  setInterval(() => {
    if (!AC || AC.state !== 'running') return;
    if (next < AC.currentTime) next = AC.currentTime + 0.05;
    while (next < AC.currentTime + 0.25) {
      const i = step % MEL.length, m = MEL[i];
      if (m) tone(NOTE[m], T * 1.7, 'triangle', 0.9, null, next - AC.currentTime, musicG);
      if (i % 3 === 0) tone(NOTE[BASS[(i / 6) | 0]] / (i % 6 === 0 ? 1 : 0.667), T * 1.4, 'square', 0.22, null, next - AC.currentTime, musicG);
      step++; next += T;
    }
  }, 60);
}
