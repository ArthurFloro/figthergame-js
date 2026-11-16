'use strict';
// ============================================================
//  Renderização: cenários, lutadores (esqueleto procedural), projéteis e partículas
// ============================================================
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let VS = 1;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const s = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px';
  cv.width = Math.max(320, Math.floor(W * s * dpr)); cv.height = Math.max(180, Math.floor(H * s * dpr));
  VS = cv.width / W;
}
addEventListener('resize', resize);
resize();

const OUT = '#17111f';
const HORIZON = 312, FLOOR_TOP = GROUND - 54;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }

// ---------------- Cenários ----------------
const stageCache = {};

function shipShape(x, cx, by, s, hull, sail, lit) {
  x.save(); x.translate(cx, by); x.scale(s, s);
  x.fillStyle = hull;
  x.beginPath(); x.moveTo(-135, -48); x.lineTo(-110, -48); x.lineTo(-104, -30); x.lineTo(130, -30); x.lineTo(150, -52); x.lineTo(172, -52);
  x.quadraticCurveTo(140, 10, 100, 14); x.lineTo(-90, 14); x.quadraticCurveTo(-125, 5, -135, -48); x.fill();
  x.fillRect(-52, -210, 6, 182); x.fillRect(38, -244, 7, 216); x.fillRect(104, -172, 5, 144);
  x.strokeStyle = hull; x.lineWidth = 3; x.beginPath(); x.moveTo(160, -50); x.lineTo(226, -84); x.stroke();
  x.lineWidth = 1; x.beginPath(); x.moveTo(226, -84); x.lineTo(41, -240); x.lineTo(-49, -208); x.lineTo(-132, -48); x.stroke();
  x.fillStyle = sail;
  for (const [mx, top, w, h] of [[-49, -200, 84, 60], [-49, -132, 96, 70], [41, -232, 96, 64], [41, -160, 112, 80], [106, -164, 60, 56], [106, -102, 70, 56]]) {
    x.beginPath(); x.moveTo(mx - w / 2, top); x.lineTo(mx + w / 2, top); x.quadraticCurveTo(mx + w / 2 + 12, top + h / 2, mx + w / 2, top + h);
    x.lineTo(mx - w / 2, top + h); x.quadraticCurveTo(mx - w / 2 + 12, top + h / 2, mx - w / 2, top); x.fill();
  }
  if (lit) { x.fillStyle = '#ffcf70'; for (let k = 0; k < 6; k++) x.fillRect(-84 + k * 36, -20, 8, 7); }
  x.restore();
}

function barrel(x, bx, by, w, h) {
  const g = x.createLinearGradient(bx, 0, bx + w, 0);
  g.addColorStop(0, '#4a2a16'); g.addColorStop(0.45, '#8a5630'); g.addColorStop(1, '#3d2212');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(bx + 3, by); x.lineTo(bx + w - 3, by); x.quadraticCurveTo(bx + w + 4, by + h / 2, bx + w - 3, by + h);
  x.lineTo(bx + 3, by + h); x.quadraticCurveTo(bx - 4, by + h / 2, bx + 3, by); x.fill();
  x.fillStyle = '#231509'; x.fillRect(bx - 1, by + h * 0.2, w + 2, 4); x.fillRect(bx - 1, by + h * 0.72, w + 2, 4);
}
function crate(x, bx, by, s) {
  x.fillStyle = '#7a5230'; x.fillRect(bx, by, s, s);
  x.strokeStyle = '#3b2412'; x.lineWidth = 4; x.strokeRect(bx + 2, by + 2, s - 4, s - 4);
  x.beginPath(); x.moveTo(bx + 4, by + 4); x.lineTo(bx + s - 4, by + s - 4); x.moveTo(bx + s - 4, by + 4); x.lineTo(bx + 4, by + s - 4); x.stroke();
}
function planks(x, R, top, c0, c1, seam) {
  const g = x.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  x.fillStyle = g; x.fillRect(0, top, STAGE_W, H - top);
  let y = top, hgt = 7, row = 0;
  x.fillStyle = seam;
  while (y < H) {
    x.fillRect(0, y, STAGE_W, 1.6);
    for (let px = (row % 2) * 90 + R() * 40; px < STAGE_W; px += 170 + R() * 70) { x.fillRect(px, y, 1.6, hgt); x.fillRect(px + 6, y + hgt * 0.4, 2, 2); }
    y += hgt; hgt *= 1.32; row++;
  }
  x.fillStyle = 'rgba(255,225,170,.28)'; x.fillRect(0, top, STAGE_W, 2);
}

function buildStage(i) {
  const S = STAGES[i], L = {}, R = rng(11 + i * 97);
  // --- céu ---
  let c = mk(W, H), x = c.getContext('2d');
  let g = x.createLinearGradient(0, 0, 0, HORIZON + 10);
  S.sky.forEach((col, k) => g.addColorStop(k / (S.sky.length - 1), col));
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (S.night) {
    x.fillStyle = '#fff';
    for (let k = 0; k < 150; k++) { x.globalAlpha = 0.25 + R() * 0.75; circ(x, R() * W, R() * HORIZON, R() < 0.12 ? 1.6 : 0.9); }
    x.globalAlpha = 1;
    g = x.createRadialGradient(720, 96, 10, 720, 96, 170);
    g.addColorStop(0, 'rgba(200,220,255,.5)'); g.addColorStop(1, 'rgba(200,220,255,0)');
    x.fillStyle = g; x.fillRect(520, -80, 400, 380);
    x.fillStyle = '#eef3ff'; circ(x, 720, 96, 36);
    x.fillStyle = 'rgba(160,180,220,.5)'; circ(x, 708, 86, 7); circ(x, 732, 104, 9); circ(x, 714, 112, 4);
  } else {
    g = x.createRadialGradient(640, HORIZON - 26, 10, 640, HORIZON - 26, 280);
    g.addColorStop(0, 'rgba(255,244,190,.95)'); g.addColorStop(0.18, 'rgba(255,205,125,.55)'); g.addColorStop(1, 'rgba(255,160,80,0)');
    x.fillStyle = g; x.fillRect(300, 0, 660, HORIZON + 10);
    x.fillStyle = '#fff4c8'; circ(x, 640, HORIZON - 26, 44);
  }
  L.sky = c;

  // --- fundo distante (paralaxe 0.25) ---
  c = mk(W + (STAGE_W - W) * 0.25 + 20, H); x = c.getContext('2d');
  const FW = c.width;
  if (S.night) {
    let bx = 0;
    while (bx < FW) {
      const bw = 34 + R() * 52, bh = 34 + R() * 84;
      x.fillStyle = '#080e22'; x.fillRect(bx, HORIZON - bh, bw, bh + 6);
      if (R() < 0.5) { x.beginPath(); x.moveTo(bx - 3, HORIZON - bh); x.lineTo(bx + bw / 2, HORIZON - bh - 18 - R() * 14); x.lineTo(bx + bw + 3, HORIZON - bh); x.fill(); }
      x.fillStyle = '#ffcf70';
      for (let wy = HORIZON - bh + 10; wy < HORIZON - 10; wy += 15) for (let wx = bx + 7; wx < bx + bw - 8; wx += 13) if (R() < 0.32) x.fillRect(wx, wy, 5, 7);
      bx += bw + R() * 6;
    }
    x.fillStyle = '#0c1430'; x.fillRect(880, HORIZON - 170, 20, 172); x.fillRect(872, HORIZON - 178, 36, 12);
    x.fillStyle = '#fff2b0'; x.fillRect(882, HORIZON - 166, 16, 12);
    g = x.createRadialGradient(890, HORIZON - 160, 2, 890, HORIZON - 160, 90);
    g.addColorStop(0, 'rgba(255,240,170,.6)'); g.addColorStop(1, 'rgba(255,240,170,0)');
    x.fillStyle = g; x.fillRect(790, HORIZON - 260, 200, 200);
  } else {
    x.fillStyle = 'rgba(88,44,96,.9)';
    x.beginPath(); x.moveTo(30, HORIZON + 2); x.quadraticCurveTo(120, HORIZON - 78, 210, HORIZON - 40); x.quadraticCurveTo(270, HORIZON - 96, 372, HORIZON + 2); x.fill();
    x.beginPath(); x.moveTo(820, HORIZON + 2); x.quadraticCurveTo(900, HORIZON - 58, 980, HORIZON - 34); x.quadraticCurveTo(1030, HORIZON - 60, 1090, HORIZON + 2); x.fill();
    x.fillStyle = 'rgba(60,30,80,.9)';
    for (const [px, ph] of [[150, 38], [176, 30], [250, 44], [900, 26], [1000, 30]]) {   // palmeiras
      x.fillRect(px, HORIZON - 40 - ph, 3, ph);
      for (let a = 0; a < 5; a++) { x.beginPath(); x.ellipse(px + 1 + Math.cos(a * 1.3 + 0.4) * 9, HORIZON - 40 - ph + Math.sin(a * 1.3 + 0.4) * 4 - 2, 10, 3, a * 1.3 + 0.4, 0, 7); x.fill(); }
    }
  }
  L.far = c;

  // --- plano médio (paralaxe 0.5): navio ---
  c = mk(W + (STAGE_W - W) * 0.5 + 20, H); x = c.getContext('2d');
  if (S.night) shipShape(x, 830, HORIZON + 78, 1.25, '#070b1c', '#0f1832', true);
  else shipShape(x, 300, HORIZON + 26, 0.5, 'rgba(58,30,74,.95)', 'rgba(96,52,96,.9)', false);
  L.mid = c;

  // --- plano do chão (paralaxe 1) ---
  c = mk(STAGE_W, H); x = c.getContext('2d');
  const rt = FLOOR_TOP - 58;
  if (!S.night) {
    // amurada
    for (let px = 10; px < STAGE_W; px += 64) {
      x.fillStyle = '#4a2a18'; x.fillRect(px, rt + 6, 12, 60);
      x.fillStyle = '#6f4426'; x.fillRect(px + 2, rt + 6, 4, 60);
    }
    x.fillStyle = '#5a3420'; x.fillRect(0, rt, STAGE_W, 10);
    x.fillStyle = '#86542f'; x.fillRect(0, rt, STAGE_W, 3);
    x.fillStyle = '#4a2a18'; x.fillRect(0, rt + 34, STAGE_W, 6);
    // enxárcias e mastro
    const cx = STAGE_W / 2;
    x.strokeStyle = 'rgba(30,18,10,.9)'; x.lineWidth = 2.5;
    for (const sg of [-1, 1]) {
      for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(cx + sg * 12, 10); x.lineTo(cx + sg * (150 + k * 36), rt); x.stroke(); }
      x.lineWidth = 1.6;
      for (let y = 70; y < rt; y += 30) {
        const u = (y - 10) / (rt - 10);
        x.beginPath(); x.moveTo(cx + sg * (12 + 138 * u), y); x.lineTo(cx + sg * (12 + 246 * u), y); x.stroke();
      }
      x.lineWidth = 2.5;
    }
    g = x.createLinearGradient(cx - 18, 0, cx + 18, 0);
    g.addColorStop(0, '#3d2414'); g.addColorStop(0.4, '#855432'); g.addColorStop(1, '#33200f');
    x.fillStyle = g; x.fillRect(cx - 18, -10, 36, FLOOR_TOP + 18);
    x.fillStyle = '#24160b'; for (const y of [130, 250, 370]) x.fillRect(cx - 20, y, 40, 7);
    // vela recolhida no alto
    x.fillStyle = '#e6d8ba';
    x.beginPath(); x.moveTo(cx - 310, -6); x.lineTo(cx + 310, -6); x.quadraticCurveTo(cx + 296, 22, cx + 304, 44);
    for (let k = 5; k >= -6; k--) x.quadraticCurveTo(cx + k * 52 + 26, 70, cx + k * 52, 46);
    x.quadraticCurveTo(cx - 300, 24, cx - 310, -6); x.fill();
    x.fillStyle = '#5a3a22'; x.fillRect(cx - 330, -4, 660, 9);
    // carga
    barrel(x, 196, FLOOR_TOP - 52, 40, 56); barrel(x, 240, FLOOR_TOP - 46, 36, 50); barrel(x, 214, FLOOR_TOP - 92, 36, 44);
    crate(x, 1196, FLOOR_TOP - 50, 54); crate(x, 1254, FLOOR_TOP - 40, 44); crate(x, 1208, FLOOR_TOP - 92, 42);
    barrel(x, 1010, FLOOR_TOP - 48, 38, 52);
    // postes das lanternas
    x.fillStyle = '#2a1a10';
    for (const [lx, ly] of S.lights) { x.fillRect(lx - 3, ly, 6, FLOOR_TOP - ly); x.fillRect(lx - 3, ly, 22, 5); x.fillRect(lx + 16, ly, 3, 14); }
    planks(x, R, FLOOR_TOP, '#a06f41', '#5a391f', 'rgba(40,20,8,.45)');
  } else {
    // cais: cabeços de amarração, cordas e carga
    x.strokeStyle = '#151019'; x.lineWidth = 4;
    for (let px = 60; px < STAGE_W; px += 170) {
      x.beginPath(); x.moveTo(px, rt + 22); x.quadraticCurveTo(px + 85, rt + 62, px + 170, rt + 22); x.stroke();
    }
    for (let px = 60; px < STAGE_W; px += 170) {
      x.fillStyle = '#2a2330'; x.fillRect(px - 9, rt + 12, 18, 56);
      x.fillStyle = '#3d3446'; x.fillRect(px - 12, rt + 8, 24, 10); x.fillRect(px - 6, rt + 12, 4, 56);
    }
    crate(x, 420, FLOOR_TOP - 56, 60); crate(x, 484, FLOOR_TOP - 42, 46); barrel(x, 372, FLOOR_TOP - 50, 38, 54);
    barrel(x, 960, FLOOR_TOP - 52, 40, 56); barrel(x, 1004, FLOOR_TOP - 46, 36, 50); crate(x, 1330, FLOOR_TOP - 52, 56);
    x.fillStyle = '#16121c';
    for (const [lx, ly] of S.lights) { x.fillRect(lx - 4, ly, 8, FLOOR_TOP - ly); x.fillRect(lx - 14, ly - 4, 28, 6); x.fillRect(lx - 7, ly - 22, 14, 18); }
    planks(x, R, FLOOR_TOP, '#5d5348', '#2a2420', 'rgba(10,8,6,.5)');
  }
  L.floor = c;
  return L;
}

function drawStage(i, cam) {
  const S = STAGES[i], L = stageCache[i] || (stageCache[i] = buildStage(i)), t = G.t;
  ctx.drawImage(L.sky, 0, 0);
  // nuvens
  ctx.fillStyle = S.cloud;
  for (const [bx, by, s] of [[60, 70, 1.2], [380, 44, 0.9], [700, 120, 1.4], [1010, 66, 1]]) {
    const span = W + 320, cx = (((bx + t * 0.1 * s - cam * 0.08) % span) + span) % span - 160;
    for (const [ox, oy, rx, ry] of [[0, 0, 60, 14], [-34, 6, 40, 10], [38, 5, 46, 11], [6, -9, 34, 11]]) {
      ctx.beginPath(); ctx.ellipse(cx + ox * s, by + oy * s, rx * s, ry * s, 0, 0, 7); ctx.fill();
    }
  }
  ctx.drawImage(L.far, -Math.round(cam * 0.25), 0);
  // mar
  const g = ctx.createLinearGradient(0, HORIZON, 0, FLOOR_TOP + 20);
  g.addColorStop(0, S.sea[0]); g.addColorStop(0.3, S.sea[1]); g.addColorStop(1, S.sea[2]);
  ctx.fillStyle = g; ctx.fillRect(0, HORIZON, W, FLOOR_TOP + 20 - HORIZON);
  const sunX = S.night ? 720 : 640;
  ctx.fillStyle = S.night ? 'rgba(220,230,255,.35)' : 'rgba(255,236,170,.55)';
  for (let k = 0; k < 11; k++) {
    const y = HORIZON + 4 + k * k * 0.9 + k * 2, w = (18 + k * 9) * (0.7 + 0.3 * Math.sin(t * 0.07 + k * 1.7));
    ctx.fillRect(sunX - w / 2 + Math.sin(t * 0.04 + k) * 6, y, w, 1.5 + k * 0.18);
  }
  for (let j = 0; j < 7; j++) {
    const y = HORIZON + 6 + j * j * 2.2 + j * 4, amp = 1 + j * 0.6, wl = 60 + j * 26;
    ctx.strokeStyle = `rgba(255,255,255,${0.08 + j * 0.02})`; ctx.lineWidth = 1 + j * 0.3;
    ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 20) {
      const yy = y + Math.sin((x + cam * (0.3 + j * 0.08)) / wl + t * (0.03 + j * 0.008) + j) * amp;
      if (x === -20) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.drawImage(L.mid, -Math.round(cam * 0.5), Math.round(Math.sin(t * 0.03) * 2));
  ctx.drawImage(L.floor, -Math.round(cam), 0);
  // lanternas
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < S.lights.length; k++) {
    const lx = S.lights[k][0] - cam + (S.night ? 0 : 17), ly = S.lights[k][1] + (S.night ? -12 : 18);
    const fl = 0.85 + 0.15 * Math.sin(t * 0.21 + k * 2) * Math.sin(t * 0.13 + k);
    const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 110 * fl);
    lg.addColorStop(0, `rgba(255,210,120,${0.75 * fl})`); lg.addColorStop(0.25, 'rgba(255,170,70,.22)'); lg.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = lg; ctx.fillRect(lx - 120, ly - 120, 240, 240);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffe9b0';
  for (const [lx0, ly0] of S.lights) circ(ctx, lx0 - cam + (S.night ? 0 : 17), ly0 + (S.night ? -12 : 18), 4);
}

// ---------------- Esqueleto ----------------
function ik(foot, a, b) {   // quadril na origem; devolve o joelho (dobrando para a frente)
  let dx = foot[0], dy = foot[1], d = Math.hypot(dx, dy);
  const mx = a + b - 0.5;
  if (d > mx) { dx *= mx / d; dy *= mx / d; foot[0] = dx; foot[1] = dy; d = mx; }
  const base = Math.atan2(dy, dx), A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  return [Math.cos(base - A) * a, Math.sin(base - A) * a];
}

function skeleton(f) {
  const b = f.ch.build, p = f.pose;
  const d = (a, l) => [Math.sin(a * DEG) * l, Math.cos(a * DEG) * l];
  const add = (u, v) => [u[0] + v[0], u[1] + v[1]];
  let kF = d(p.ha, b.legU), fF = add(kF, d(p.ha + p.ka, b.legL));
  let kB = d(p.hb, b.legU), fB = add(kB, d(p.hb + p.kb, b.legL));
  const maxY = Math.max(fF[1], fB[1]);
  if (f.y <= 0 && Math.abs(p.rot) < 2) {   // planta no chão o pé que estiver quase encostando
    if (fF[1] < maxY && maxY - fF[1] < 8) { fF[1] = maxY; kF = ik(fF, b.legU, b.legL); }
    if (fB[1] < maxY && maxY - fB[1] < 8) { fB[1] = maxY; kB = ik(fB, b.legU, b.legL); }
  }
  const hip = [0, -maxY], off = (v) => [v[0], v[1] - maxY];
  const sh = [Math.sin(p.lean * DEG) * b.torso, hip[1] - Math.cos(p.lean * DEG) * b.torso];
  const ha = (p.lean + p.head) * DEG;
  const head = [sh[0] + Math.sin(ha) * (b.head + 1), sh[1] - Math.cos(ha) * (b.head + 1)];
  const sj = [hip[0] + (sh[0] - hip[0]) * 0.9, hip[1] + (sh[1] - hip[1]) * 0.9];
  const sF = [sj[0] + 4, sj[1]], sB = [sj[0] - 4, sj[1]];
  const eF = add(sF, d(p.sa, b.armU)), hF = add(eF, d(p.sa + p.ea, b.armL));
  const eB = add(sB, d(p.sb, b.armU)), hB = add(eB, d(p.sb + p.eb, b.armL));
  return { hip, kF: off(kF), fF: off(fF), kB: off(kB), fB: off(fB), sh, head, sF, sB, eF, hF, eB, hB };
}

function swoosh(c, cx, cy, rx, ry, rot, col, a) {
  c.save(); c.translate(cx, cy); c.rotate(rot); c.globalAlpha *= clamp(a, 0, 1);
  c.fillStyle = col;
  c.beginPath(); c.ellipse(0, 0, rx, ry, 0, -1.25, 1.25); c.ellipse(-rx * 0.4, 0, rx * 0.95, ry * 0.82, 0, 1.1, -1.1, true); c.fill();
  c.fillStyle = '#fff'; c.globalAlpha *= 0.8;
  c.beginPath(); c.ellipse(0, 0, rx * 0.97, ry * 0.9, 0, -0.9, 0.9); c.ellipse(-rx * 0.22, 0, rx * 0.97, ry * 0.86, 0, 0.84, -0.84, true); c.fill();
  c.restore();
}

// ---------------- Lutador ----------------
function drawHead(c, f, sk, K, O, mono) {
  const ch = f.ch, C = f.col, r = ch.build.head, t = G.t, p = f.pose, look = ch.look;
  const wind = Math.sin(t * 0.12 + f.idx * 2) * 3 - clamp(f.vx * f.facing, -5, 5) * 1.6;
  c.save();
  c.translate(sk.head[0], sk.head[1]); c.rotate((p.lean + p.head) * DEG * 0.6);
  // atrás da cabeça
  if (look === 'hood') {
    c.fillStyle = K('acc'); c.strokeStyle = O; c.lineWidth = 2;
    c.beginPath(); c.arc(-3, -1, r + 4, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-r - 4, -8); c.lineTo(-r - 15 + wind * 0.5, 1); c.lineTo(-r - 3, 9); c.fill();
    c.strokeStyle = K('sash'); c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-r + 2, r * 0.6); c.quadraticCurveTo(-r - 12 + wind, r * 0.9, -r - 20 + wind * 2, r * 1.5 + Math.sin(t * 0.2) * 3); c.stroke();
  } else if (look === 'tricorn') {
    c.strokeStyle = O; c.lineWidth = 12; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-r + 3, -2); c.quadraticCurveTo(-r - 14 + wind, 14, -r - 8 + wind * 1.6, 40); c.stroke();
    c.strokeStyle = K('hair'); c.lineWidth = 8.5; c.stroke();
  } else if (look === 'bandana') {
    c.fillStyle = K('hair'); c.strokeStyle = O; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-r + 2, -6); c.lineTo(-r - 8, -1); c.lineTo(-r, 2); c.lineTo(-r - 7, 8); c.lineTo(-r + 3, 9); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = K('acc');
    for (const k of [0, 1]) {
      c.beginPath(); c.moveTo(-r + 1, -r * 0.45); c.lineTo(-r - 15 + wind, -r * 0.7 + k * 9 + Math.sin(t * 0.25 + k) * 2); c.lineTo(-r - 11 + wind, -r * 0.15 + k * 8); c.closePath(); c.fill(); c.stroke();
    }
  } else if (look === 'captain') {
    c.fillStyle = K('hair'); c.strokeStyle = O; c.lineWidth = 2;
    c.beginPath(); c.arc(-2, 2, r + 2, 1.2, 4.6); c.fill();
  }
  // cabeça
  c.fillStyle = K('skin'); c.strokeStyle = O; c.lineWidth = 2.4;
  c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.stroke();
  if (!mono) {
    const hurt = f.state === 'hitstun' || f.state === 'launched' || f.state === 'down';
    c.strokeStyle = '#1a1018'; c.fillStyle = '#1a1018'; c.lineWidth = 2; c.lineCap = 'round';
    if (hurt) { c.beginPath(); c.moveTo(r * 0.28, -r * 0.3); c.lineTo(r * 0.6, -r * 0.12); c.lineTo(r * 0.28, 0.06 * r); c.stroke(); }
    else { c.beginPath(); c.ellipse(r * 0.46, -r * 0.12, 2.2, 3, 0, 0, 7); c.fill(); }
    c.beginPath(); c.moveTo(r * 0.12, -r * 0.5); c.lineTo(r * 0.74, -r * 0.34); c.stroke();
    c.lineWidth = 1.6; c.beginPath();
    if (hurt || f.state === 'attack') { c.ellipse(r * 0.5, r * 0.46, 2.6, 2.2, 0, 0, 7); c.fill(); }
    else { c.moveTo(r * 0.34, r * 0.46); c.lineTo(r * 0.7, r * 0.42); c.stroke(); }
  }
  // por cima
  c.strokeStyle = O; c.lineWidth = 2.2; c.lineJoin = 'round';
  if (look === 'bandana') {
    c.fillStyle = K('acc');
    c.beginPath(); c.arc(0, 0, r + 0.6, Math.PI * 1.02, Math.PI * 1.93); c.closePath(); c.fill(); c.stroke();
    if (!mono) { c.fillStyle = C.hair; c.beginPath(); c.moveTo(r * 0.5, -r * 0.62); c.lineTo(r * 0.98, -r * 0.5); c.lineTo(r * 0.6, -r * 0.32); c.fill(); }
  } else if (look === 'tricorn') {
    if (!mono) { c.fillStyle = C.hair; c.beginPath(); c.arc(0, 0, r, Math.PI * 0.95, Math.PI * 1.9); c.closePath(); c.fill(); }
    c.fillStyle = K('hat');
    c.beginPath(); c.moveTo(-r - 10, -r * 0.42); c.lineTo(r + 14, -r * 0.62); c.lineTo(r * 0.25, -r - 13); c.lineTo(-r * 0.75, -r - 9); c.closePath(); c.fill(); c.stroke();
    if (!mono) {
      c.strokeStyle = C.acc; c.lineWidth = 2; c.beginPath(); c.moveTo(-r - 7, -r * 0.5); c.lineTo(r + 10, -r * 0.68); c.stroke();
      c.strokeStyle = '#f4efe2'; c.lineWidth = 3.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-r * 0.3, -r - 8); c.quadraticCurveTo(-r - 4, -r - 22, -r - 16 + wind * 0.5, -r - 12); c.stroke();
    }
  } else if (look === 'captain') {
    if (!mono) { c.fillStyle = C.hair; c.beginPath(); c.arc(0, 0, r + 1.5, 0.1, Math.PI * 0.86); c.closePath(); c.fill(); }   // barba
    c.fillStyle = K('hat'); c.strokeStyle = O; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(-r - 13, -r * 0.42); c.quadraticCurveTo(0, -r - 34, r + 14, -r * 0.5); c.quadraticCurveTo(0, -r * 1.02, -r - 13, -r * 0.42); c.fill(); c.stroke();
    if (!mono) {
      c.strokeStyle = C.acc; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-r - 9, -r * 0.5); c.quadraticCurveTo(0, -r * 1.12, r + 10, -r * 0.58); c.stroke();
      c.fillStyle = C.acc; c.beginPath(); c.arc(2, -r - 7, 4, 0, 7); c.fill();
    }
  } else if (look === 'hood') {
    if (!mono) {
      c.fillStyle = C.mask; c.beginPath(); c.arc(0, 0, r - 0.5, -0.12, Math.PI * 0.8); c.closePath(); c.fill();
      c.fillStyle = C.hair; c.beginPath(); c.moveTo(r * 0.1, -r * 0.95); c.lineTo(r * 0.92, -r * 0.42); c.lineTo(r * 0.3, -r * 0.5); c.fill();
    }
    c.strokeStyle = K('acc'); c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, r + 0.5, Math.PI * 0.72, Math.PI * 1.72); c.stroke();
  }
  c.restore();
}

function drawFighter(c, f, mono, alpha) {
  const ch = f.ch, b = ch.build, C = f.col, p = f.pose, sc = ch.scale, sk = skeleton(f), t = G.t;
  const K = (k) => mono || C[k], O = mono || OUT;
  c.save();
  c.translate(f.x, GROUND - f.y + (p.oy - FOOT_PAD) * sc); c.scale(f.facing * sc, sc);
  if (p.rot) c.rotate(p.rot * DEG);
  if (alpha != null) c.globalAlpha = alpha;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const path = (pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); };
  const seg = (pts, w, col) => { path(pts); c.strokeStyle = O; c.lineWidth = w + 4; c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
  const fseg = (pts, w, col) => { path(pts); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
  const dot = (pt, r, col) => { c.beginPath(); c.arc(pt[0], pt[1], r, 0, 7); c.fillStyle = col; c.fill(); c.strokeStyle = O; c.lineWidth = 2; c.stroke(); };
  const mid = (a, q, u) => [a[0] + (q[0] - a[0]) * u, a[1] + (q[1] - a[1]) * u];
  const sway = clamp(-f.vx * f.facing * 2.2, -10, 10) + Math.sin(t * 0.1 + f.idx * 3) * 2;

  const leg = (k, ft, back) => {
    const dx = ft[0] - k[0], dy = ft[1] - k[1], l = Math.hypot(dx, dy) || 1, toe = [ft[0] + dy / l * 9, ft[1] - dx / l * 9];
    const boot = K(back ? 'bootB' : 'boot');
    seg([ft, toe], b.legW - 3, boot);
    seg([sk.hip, k, ft], b.legW, K(back ? 'pantsB' : 'pants'));
    fseg([mid(k, ft, 0.45), ft], b.legW, boot);
    fseg([ft, toe], b.legW - 3, boot);
  };
  const blade = (h, ang, len, wd) => {
    const d = [Math.sin(ang * DEG), Math.cos(ang * DEG)], n = [d[1], -d[0]], tip = [h[0] + d[0] * len, h[1] + d[1] * len];
    seg([[h[0] - n[0] * 5 + d[0] * 3, h[1] - n[1] * 5 + d[1] * 3], [h[0] + n[0] * 5 + d[0] * 3, h[1] + n[1] * 5 + d[1] * 3]], 3, K('acc'));
    c.beginPath(); c.moveTo(h[0] + d[0] * 4, h[1] + d[1] * 4);
    c.quadraticCurveTo(h[0] + d[0] * len * 0.6 + n[0] * len * 0.13, h[1] + d[1] * len * 0.6 + n[1] * len * 0.13, tip[0], tip[1]);
    c.strokeStyle = O; c.lineWidth = wd + 3.5; c.stroke(); c.strokeStyle = mono || '#e4ebf2'; c.lineWidth = wd; c.stroke();
  };
  const arm = (s, e, h, back) => {
    const skin = K(back ? 'skinB' : 'skin'), slv = K(back ? 'shirtB' : 'shirt');
    let fist = skin;
    if (ch.coat) { seg([s, e, h], b.armW, slv); if (!mono) fseg([mid(e, h, 0.82), h], b.armW, C.acc); }
    else {
      seg([s, e, h], b.armW, skin);
      fseg([s, mid(s, e, ch.id === 'caio' ? 0.3 : 0.9)], b.armW, slv);
      if (!mono && ch.id === 'caio') { fseg([mid(e, h, 0.45), h], b.armW, back ? '#b9b3a6' : '#efe8d8'); fist = back ? '#b9b3a6' : '#efe8d8'; }
      if (!mono && ch.id === 'brisa') fseg([mid(e, h, 0.15), mid(e, h, 0.8)], b.armW, C.mask);
    }
    if (ch.weapon === 'daggers') blade(h, (back ? p.sb + p.eb : p.sa + p.ea) + 105, 18, 3.4);
    if (ch.weapon === 'cannon' && !back) {
      const dx = h[0] - e[0], dy = h[1] - e[1], l = Math.hypot(dx, dy) || 1, a = mid(e, h, 0.2), z = [h[0] + dx / l * 11, h[1] + dy / l * 11];
      c.lineCap = 'butt';
      seg([a, z], b.armW + 10, K('metal'));
      if (!mono) { fseg([mid(a, z, 0.12), mid(a, z, 0.26)], b.armW + 13, C.acc); fseg([mid(a, z, 0.84), z], b.armW + 13, '#3a404c'); }
      c.lineCap = 'round';
      if (!mono) { c.fillStyle = '#0c0c12'; c.beginPath(); c.arc(z[0], z[1], 5, 0, 7); c.fill(); }
      return;
    }
    dot(h, b.armW * 0.64, fist);
    if (ch.weapon === 'sword' && !back) blade(h, p.sa + p.ea + p.wa, 50, 4.6);
  };

  // casaco (cauda)
  if (ch.coat) {
    const hx = sk.hip[0], hy = sk.hip[1];
    c.beginPath(); c.moveTo(hx - b.hipW / 2, hy - 8); c.lineTo(hx - b.hipW / 2 - 9 + sway, hy + b.legU * 1.2);
    c.lineTo(hx + 2 + sway * 0.6, hy + b.legU * 1.05); c.lineTo(hx + b.hipW / 2 - 4, hy - 4); c.closePath();
    c.fillStyle = K('coat'); c.fill(); c.strokeStyle = O; c.lineWidth = 2.5; c.stroke();
  }
  arm(sk.sB, sk.eB, sk.hB, true);
  leg(sk.kB, sk.fB, true);
  // tronco
  const m = mid(sk.hip, sk.sh, 0.45), top = mid(sk.hip, sk.sh, 0.8);
  path([sk.hip, m]); c.strokeStyle = O; c.lineWidth = b.hipW + 4; c.stroke();
  path([m, top]); c.lineWidth = b.shW + 4; c.stroke();
  path([sk.hip, m]); c.strokeStyle = K('shirt'); c.lineWidth = b.hipW; c.stroke();
  path([m, top]); c.lineWidth = b.shW; c.stroke();
  if (!mono) {
    const tl = Math.hypot(sk.sh[0] - sk.hip[0], sk.sh[1] - sk.hip[1]) || 1;
    const fw = [-(sk.sh[1] - sk.hip[1]) / tl, (sk.sh[0] - sk.hip[0]) / tl];   // vetor "para a frente" do tronco
    const o = (pt, d) => [pt[0] + fw[0] * d, pt[1] + fw[1] * d];
    if (ch.id === 'caio') fseg([o(mid(sk.hip, sk.sh, 0.3), 6), o(mid(sk.hip, sk.sh, 0.86), 6)], 9, C.skin);
    else if (ch.coat) { c.fillStyle = C.acc; for (const u of [0.3, 0.52, 0.74]) { const q = o(mid(sk.hip, sk.sh, u), b.shW * 0.24); c.beginPath(); c.arc(q[0], q[1], 2.3, 0, 7); c.fill(); } }
    else fseg([o(top, -b.shW * 0.3), o(mid(sk.hip, sk.sh, 0.12), b.hipW * 0.4)], 3.5, C.sash);
    c.lineCap = 'butt';
    fseg([mid(sk.hip, sk.sh, 0.02), mid(sk.hip, sk.sh, 0.16)], b.hipW + 1.5, C.sash);
    c.lineCap = 'round';
  }
  leg(sk.kF, sk.fF, false);
  drawHead(c, f, sk, K, O, mono);
  arm(sk.sF, sk.eF, sk.hF, false);

  // rastro do golpe
  const mv = f.mv;
  if (!mono && f.state === 'attack' && mv && mv.arc && mv.box) {
    const a = f.mf - mv.startup, bx = mv.box;
    if (a > 0 && a <= mv.active + 3) {
      let al = 1 - a / (mv.active + 4), rot = mv.kind === 'upper' ? -1.15 : mv.crouch ? 0.12 : mv.air ? 0.6 : 0;
      if (mv.cyc) { al = 0.95 - (f.stateT - f.lastHitF) * 0.14; rot = f.hitCount % 2 ? -0.6 : 0.6; }
      swoosh(c, bx[0] + bx[2] * 0.5, -(bx[1] + bx[3] / 2) + FOOT_PAD, bx[2] * 0.55, Math.max(bx[3] * 0.62, 22), rot, C.fx, al);
    }
  }
  c.restore();
}

function drawShadow(c, f) {
  const sc = f.ch.scale, k = 1 - Math.min(f.y, 220) / 400;
  c.fillStyle = 'rgba(0,0,0,.34)';
  c.beginPath(); c.ellipse(f.x, GROUND + 3, (f.state === 'down' ? 70 : 46) * sc * k, 8 * k, 0, 0, 7); c.fill();
}

// ---------------- Projéteis ----------------
function drawProj(c, p) {
  const C = p.owner.col, t = p.t, dir = Math.sign(p.vx) || 1, cy = GROUND - p.y - p.h / 2;
  c.save();
  if (p.kind === 'bolt') {
    if (p.delay > 0) {   // aviso no chão
      const a = 0.35 + 0.35 * Math.sin(G.t * 0.6);
      c.fillStyle = `rgba(255,225,74,${a})`; c.beginPath(); c.ellipse(p.x, GROUND + 2, p.w * 0.6, 9, 0, 0, 7); c.fill();
      c.strokeStyle = `rgba(255,255,220,${a * 0.6})`; c.lineWidth = 2; c.setLineDash([6, 10]);
      c.beginPath(); c.moveTo(p.x, 0); c.lineTo(p.x, GROUND); c.stroke(); c.setLineDash([]);
    } else {
      c.lineJoin = 'round'; c.lineCap = 'round'; c.shadowColor = C.fx; c.shadowBlur = 26;
      const R = rng(p.id * 31 + t);
      for (let k = 0; k < 2; k++) {
        c.beginPath(); c.moveTo(p.x + (R() - 0.5) * 30, -10);
        for (let y = 50; y < GROUND; y += 50) c.lineTo(p.x + (R() - 0.5) * 64, y);
        c.lineTo(p.x, GROUND);
        c.strokeStyle = C.fx; c.lineWidth = 16 - k * 4; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 6; c.stroke();
      }
      c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,230,.8)'; c.beginPath(); c.ellipse(p.x, GROUND, 70, 16, 0, 0, 7); c.fill();
    }
    c.restore(); return;
  }
  c.translate(p.x, cy); c.scale(dir, 1);
  if (p.kind === 'wave' || p.kind === 'slash' || p.kind === 'dagger') {
    const hy = p.h / 2 + 6, w = p.kind === 'slash' ? 20 : p.kind === 'dagger' ? 26 : 30;
    if (p.kind === 'slash') c.rotate(-0.25);
    if (p.kind === 'dagger') c.scale(1, 0.75 + 0.25 * Math.sin(t * 0.9));
    c.shadowColor = C.fx; c.shadowBlur = 20; c.fillStyle = C.fx;
    c.beginPath(); c.moveTo(-w * 0.5, -hy); c.quadraticCurveTo(w * 1.5, 0, -w * 0.5, hy); c.quadraticCurveTo(w * 0.35, 0, -w * 0.5, -hy); c.fill();
    c.shadowBlur = 0; c.fillStyle = C.fx2;
    c.beginPath(); c.moveTo(-w * 0.3, -hy * 0.72); c.quadraticCurveTo(w * 1.18, 0, -w * 0.3, hy * 0.72); c.quadraticCurveTo(w * 0.62, 0, -w * 0.3, -hy * 0.72); c.fill();
  } else if (p.kind === 'ball') {
    c.shadowColor = C.fx; c.shadowBlur = 22; c.fillStyle = '#23232d'; circ(c, 0, 0, 21);
    c.shadowBlur = 0; c.fillStyle = '#5a5a6c'; circ(c, -6, -7, 7);
    c.strokeStyle = C.fx; c.lineWidth = 2.4; c.lineJoin = 'round';
    const R = rng(p.id * 17 + (t >> 1));
    for (let k = 0; k < 3; k++) {
      const a = R() * 6.28; c.beginPath(); c.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
      c.lineTo(Math.cos(a + 0.4) * 30, Math.sin(a + 0.4) * 30); c.lineTo(Math.cos(a - 0.1) * 40, Math.sin(a - 0.1) * 40); c.stroke();
    }
  } else if (p.kind === 'tsunami') {
    const hh = p.h / 2, wob = Math.sin(t * 0.5) * 4;
    const g = c.createLinearGradient(0, -hh, 0, hh); g.addColorStop(0, C.fx2); g.addColorStop(0.3, C.fx); g.addColorStop(1, '#1a5fb4');
    c.shadowColor = C.fx; c.shadowBlur = 24; c.fillStyle = g;
    c.beginPath(); c.moveTo(-90, hh); c.quadraticCurveTo(-40, -hh * 0.4, 20 + wob, -hh);
    c.quadraticCurveTo(70 + wob, -hh + 6, 66, -hh + 46); c.quadraticCurveTo(50, -hh + 30, 30, -hh + 44);
    c.quadraticCurveTo(46, 0, 60, hh); c.closePath(); c.fill();
    c.shadowBlur = 0; c.fillStyle = '#fff';
    for (let k = 0; k < 7; k++) circ(c, -30 + k * 14 + Math.sin(t * 0.7 + k) * 3, -hh * 0.55 - k * hh * 0.07 + Math.cos(t * 0.6 + k * 2) * 4, 7 + (k % 3) * 2);
  } else if (p.kind === 'tornado') {
    c.shadowColor = C.fx; c.shadowBlur = 14;
    for (let k = 0; k < 10; k++) {
      const u = k / 9, y = p.h / 2 - u * p.h, rx = 16 + u * 44, ox = Math.sin(t * 0.35 + k * 0.8) * (6 + u * 10);
      c.strokeStyle = k % 2 ? C.fx : C.fx2; c.globalAlpha = 0.55 + 0.3 * Math.sin(t * 0.5 + k);
      c.lineWidth = 5; c.beginPath(); c.ellipse(ox, y, rx, 7 + u * 5, 0, 0, 7); c.stroke();
    }
  }
  c.restore();
}

// ---------------- Partículas ----------------
function drawParts(c) {
  for (const p of G.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    c.globalAlpha = a;
    if (p.type === 'line') {
      c.strokeStyle = p.col; c.lineWidth = p.size; c.lineCap = 'round';
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); c.stroke();
    } else if (p.type === 'dot') { c.fillStyle = p.col; circ(c, p.x, p.y, p.size * (0.4 + a * 0.6)); }
    else if (p.type === 'smoke') { c.globalAlpha = a * 0.5; c.fillStyle = p.col; circ(c, p.x, p.y, p.size * (2 - a)); }
    else if (p.type === 'ring') {
      c.strokeStyle = p.col; c.lineWidth = 2 + a * 4;
      c.beginPath(); c.arc(p.x, p.y, p.size * (1.4 - a), 0, 7); c.stroke();
    } else if (p.type === 'star') {
      const s = p.size * (0.5 + a * 0.7); c.fillStyle = p.col;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot || 0);
      c.beginPath();
      for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.28 : s, an = k * Math.PI / 4; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
      c.closePath(); c.fill(); c.restore();
    } else if (p.type === 'text') {
      c.globalAlpha = Math.min(1, a * 2);
      text(p.text, p.x, p.y, 20, p.col, { italic: true });
    }
  }
  c.globalAlpha = 1;
}

// ---------------- Texto ----------------
function text(str, x, y, size, fill, o) {
  o = o || {};
  if (Array.isArray(fill)) fill = vgrad(y - size * 0.82, y + size * 0.08, ...fill);
  ctx.font = `${o.italic ? 'italic ' : ''}900 ${size}px Impact, "Arial Black", "Segoe UI", sans-serif`;
  ctx.textAlign = o.align || 'center'; ctx.lineJoin = 'round';
  if (o.stroke !== false) { ctx.lineWidth = o.lw || Math.max(3, size * 0.17); ctx.strokeStyle = o.stroke || '#120a1c'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
}
function vgrad(y0, y1, ...cols) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
  return g;
}
