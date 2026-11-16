'use strict';
// ============================================================
//  Interface: HUD da luta, avisos e telas (título, seleção, controles, resultado, pausa)
// ============================================================
const GOLD = () => ['#fff7c2', '#ffd24a', '#e8870c'];
const DIFFS = ['FÁCIL', 'NORMAL', 'DIFÍCIL'];
const DUMMIES = ['PARADO', 'AGACHADO', 'PULANDO', 'CPU'];

function hot(x, y, w, h, fn, hover) { G.hot.push({ x, y, w, h, fn, hover }); }
function para(x, y, w, h, sk) { ctx.beginPath(); ctx.moveTo(x + sk, y); ctx.lineTo(x + w + sk, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
function dim(a) { ctx.fillStyle = `rgba(8,6,20,${a})`; ctx.fillRect(0, 0, W, H); }

function banner(str, size, fill, age, y) {
  const s = 1 + Math.max(0, 8 - age) * 0.22;
  ctx.save(); ctx.translate(W / 2, y || 250); ctx.scale(s, s); ctx.globalAlpha = Math.min(1, age / 5);
  text(str, 0, 0, size, fill, { italic: true });
  ctx.restore();
}

// ---------------- HUD ----------------
function hpBar(f, x, y, w, h, flip) {
  const r = clamp(f.hp / f.ch.hp, 0, 1), rl = clamp(f.hpLag / f.ch.hp, 0, 1), sk = flip ? 8 : -8;
  para(x - 3, y - 3, w + 6, h + 6, sk); ctx.fillStyle = '#120a1c'; ctx.fill();
  para(x, y, w, h, sk); ctx.fillStyle = '#3a1420'; ctx.fill();
  const part = (rr, style) => { const ww = w * rr; if (ww < 1) return; para(flip ? x : x + w - ww, y, ww, h, sk); ctx.fillStyle = style; ctx.fill(); };
  part(rl, '#ff4a3a');
  part(r, r < 0.25 && G.t % 20 < 10 ? '#ff8a3a' : vgrad(y, y + h, '#fff36a', '#ffc21a', '#e07d0c'));
  para(x, y, w, h * 0.34, sk * 0.34); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fill();
  para(x, y, w, h, sk); ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 2; ctx.stroke();
}

function drawHUD() {
  const p1 = G.p1, p2 = G.p2, bw = 380, by = 30;
  hpBar(p1, 44, by, bw, 22, false); hpBar(p2, W - 44 - bw, by, bw, 22, true);
  text(p1.ch.name, 44, by + 44, 19, '#fff', { align: 'left', italic: true });
  text(p2.ch.name + (G.mode === 'cpu' ? '  (CPU)' : ''), W - 44, by + 44, 19, '#fff', { align: 'right', italic: true });
  // vitórias
  for (const [f, sx, d] of [[p1, 44 + bw - 10, -1], [p2, W - 44 - bw + 10, 1]]) {
    for (let i = 0; i < 2; i++) {
      const x = sx + d * i * 22, y = by + 38;
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 8, y); ctx.closePath();
      ctx.fillStyle = i < f.wins ? '#ffd24a' : '#2a2034'; ctx.fill(); ctx.strokeStyle = '#120a1c'; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }
  // tempo
  ctx.save(); ctx.translate(W / 2, 62);
  text(G.mode === 'training' ? '∞' : String(Math.max(0, G.timer)).padStart(2, '0'), 0, 0, 46, G.timer <= 10 && G.mode !== 'training' && G.t % 30 < 15 ? '#ff5a3c' : GOLD());
  ctx.restore();
  // barras de super
  for (const [f, x, flip] of [[p1, 44, false], [p2, W - 44 - 250, true]]) {
    const y = H - 30, w = 250, h = 12, r = clamp(f.meter / 100, 0, 1), full = r >= 1, sk = flip ? 5 : -5;
    para(x - 3, y - 3, w + 6, h + 6, sk); ctx.fillStyle = '#120a1c'; ctx.fill();
    para(x, y, w, h, sk); ctx.fillStyle = '#1c1830'; ctx.fill();
    const ww = w * r;
    if (ww > 1) { para(flip ? x + w - ww : x, y, ww, h, sk); ctx.fillStyle = full ? (G.t % 12 < 6 ? '#fff' : f.col.fx) : f.col.fx; ctx.fill(); }
    para(x, y, w, h, sk); ctx.strokeStyle = full ? '#fff' : '#8a84a8'; ctx.lineWidth = 1.6; ctx.stroke();
    text(full ? 'SUPER PRONTO!' : 'SUPER', flip ? x + w : x, y - 8, 15, full ? '#ffd24a' : '#b8b2d0', { align: flip ? 'right' : 'left', italic: true });
  }
  // combos e nomes dos golpes
  for (const f of [p1, p2]) {
    const left = f.idx === 0, x = left ? 50 : W - 50, al = left ? 'left' : 'right';
    if (f.comboT > 0 && f.combo >= 2) {
      const pop = 1 + Math.max(0, f.comboT - 72) * 0.04;
      ctx.save(); ctx.translate(x, 168); ctx.scale(pop, pop); ctx.globalAlpha = Math.min(1, f.comboT / 15);
      text(f.combo + ' GOLPES!', 0, 0, 34, GOLD(), { align: al, italic: true });
      text(f.comboDmg + ' de dano', 0, 22, 15, '#fff', { align: al });
      ctx.restore();
    }
    const c = G.callouts[f.idx];
    if (c) { ctx.globalAlpha = Math.min(1, c.t / 12); text(c.text, x, 112, 20, f.col.fx, { align: al, italic: true }); ctx.globalAlpha = 1; }
  }
  if (G.mode === 'training') text('TREINO  ·  tecla 1: boneco ' + DUMMIES[G.dummy] + '  ·  Esc: pausa', W / 2, H - 12, 14, '#d8d2e8');
  if (IS_TOUCH) { text('II', W / 2, 100, 22, '#fff'); hot(W / 2 - 34, 74, 68, 36, togglePause); }
}

// ---------------- Luta ----------------
function drawFight() {
  const p1 = G.p1, p2 = G.p2;
  ctx.save();
  if (G.shakeT > 0) ctx.translate(rand(-1, 1) * G.shakeMag, rand(-1, 1) * G.shakeMag);
  drawStage(G.stage, G.cam);

  if (G.flash) {   // escurece o cenário e solta raios de energia durante o super
    const fl = G.flash, who = fl.who, cx = who.x - G.cam, cy = GROUND - who.y - 90;
    ctx.fillStyle = 'rgba(6,4,18,.74)'; ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(G.t * 0.02); ctx.fillStyle = who.col.fx; ctx.globalAlpha = 0.22;
    for (let k = 0; k < 14; k++) { ctx.rotate(Math.PI / 7); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1200, -40); ctx.lineTo(1200, 40); ctx.fill(); }
    ctx.restore();
  }

  ctx.save(); ctx.translate(-G.cam, 0);
  drawShadow(ctx, p1); drawShadow(ctx, p2);
  const front = p1.state === 'attack' ? p1 : p2.state === 'attack' ? p2 : p1.inCombo ? p2 : p1, back = front === p1 ? p2 : p1;
  for (const f of [back, front]) {
    for (const tr of f.trail) drawFighter(ctx, { ch: f.ch, col: f.col, pose: tr.pose, x: tr.x, y: tr.y, facing: tr.facing, vx: 0, idx: f.idx, state: 'idle', mv: null }, f.col.fx, tr.life / 9 * 0.4);
    if (!f.hidden) drawFighter(ctx, f, f.flash > 3 ? '#fff' : null);
  }
  for (const p of G.projs) drawProj(ctx, p);
  drawParts(ctx);
  ctx.restore();
  if (G.boltFlash > 0) { ctx.fillStyle = `rgba(255,255,235,${G.boltFlash * 0.09})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
  ctx.restore();

  drawHUD();

  if (G.flash) {
    const a = G.flash.max - G.flash.t;
    ctx.save(); ctx.translate(Math.max(0, 14 - a) * -40, 0);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 92, W, 62);
    ctx.fillStyle = G.flash.who.col.fx; ctx.fillRect(0, 92, W, 4); ctx.fillRect(0, 150, W, 4);
    text(G.flash.name, W / 2, 140, 44, GOLD(), { italic: true });
    ctx.restore();
  }
  if (G.phase === 'intro') {
    if (G.phaseT < 70) banner(p1.wins === 1 && p2.wins === 1 ? 'ROUND FINAL' : 'ROUND ' + G.round, 70, GOLD(), G.phaseT);
    else banner('LUTEM!', 92, ['#fff', '#ff9a3c', '#e8301c'], G.phaseT - 70);
    if (G.phaseT < 70) text(STAGES[G.stage].name, W / 2, 300, 20, '#fff', { italic: true });
  } else if (G.phase === 'ko') {
    if (G.phaseT < 95) banner(G.koKind === 'time' ? 'TEMPO ESGOTADO' : 'K.O.!', G.koKind === 'time' ? 64 : 120, ['#fff', '#ff9a3c', '#e8301c'], G.phaseT, 270);
    else {
      banner(G.winner ? G.winner.ch.name + ' VENCE!' : 'EMPATE!', 58, GOLD(), G.phaseT - 95);
      if (G.perfect) banner('PERFEITO!', 40, '#7dffb4', Math.max(0, G.phaseT - 110), 310);
    }
  }
  if (G.paused) {
    dim(0.72);
    text('PAUSA', W / 2, 150, 64, GOLD(), { italic: true });
    ['CONTINUAR', 'MENU PRINCIPAL'].forEach((s, i) => menuItem(s, i, G.pauseI, 230 + i * 44, () => pauseSelect(i), (k) => { G.pauseI = k; }));
    drawMoveList(360);
  }
}

function menuItem(s, i, cur, y, fn, setCur) {
  const sel = i === cur;
  text(s, W / 2, y, sel ? 30 : 24, sel ? GOLD() : '#d8d2e8', { italic: sel });
  if (sel) { const w = ctx.measureText(s).width / 2 + 26, b = Math.sin(G.t * 0.2) * 4; text('▶', W / 2 - w - b, y - 2, 20, '#ffd24a'); text('◀', W / 2 + w + b, y - 2, 20, '#ffd24a'); }
  hot(W / 2 - 220, y - 30, 440, 40, fn, () => setCur(i));
}

function drawMoveList(y) {
  const rows = [
    ['DEFENDER', 'segure para trás  (agachado defende golpes baixos)'],
    ['PROJÉTIL', 'Especial   ou   ↓ ↘ → + ataque'],
    ['INVESTIDA', '→ + Especial   ou   ↓ ↙ ← + ataque'],
    ['ANTIAÉREO', '↓ + Especial   ou   → ↓ ↘ + ataque'],
    ['SUPER', 'botão Super com a barra cheia'],
    ['COMBO', 'Soco → Chute → Forte → Especial'],
  ];
  rows.forEach((r, i) => {
    text(r[0], W / 2 - 150, y + i * 25, 17, '#ffd24a', { align: 'right' });
    text(r[1], W / 2 - 130, y + i * 25, 16, '#f0ecf8', { align: 'left', lw: 3 });
  });
}

// ---------------- Prévia dos lutadores (menus) ----------------
function animPrev(pf, name) {
  const tp = Object.assign({}, pf.ch.poses[name] || POSES[name]);
  if (name === 'idle') { const b = Math.sin(G.t * 0.09 + pf.idx * 2); tp.sa += b * 3; tp.sb += b * 3; tp.lean += b * 1.2; tp.ka -= b * 3; tp.ha += b * 1.5; }
  blendPose(pf.pose, tp, 0.2);
}
function drawPrev(pf, x, baseY, scale, facing) {
  pf.x = 0; pf.facing = facing;
  ctx.save(); ctx.translate(x, baseY); ctx.scale(scale, scale); ctx.translate(0, -GROUND);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, GROUND + 3, 50 * pf.ch.scale, 8, 0, 0, 7); ctx.fill();
  drawFighter(ctx, pf);
  ctx.restore();
}

// ---------------- Título ----------------
const TITLE_ITEMS = () => ['1 JOGADOR  ·  VS CPU', '2 JOGADORES', 'TREINO', 'DIFICULDADE:  ' + DIFFS[G.diff], 'CONTROLES'];

function drawTitle() {
  drawStage(0, (STAGE_W - W) / 2 + Math.sin(G.t * 0.004) * 230);
  dim(0.5);
  const a = G.prevs[0], b = G.prevs[2];
  animPrev(a, 'idle'); animPrev(b, 'idle');
  drawPrev(a, 120, 500, 1.25, 1); drawPrev(b, 838, 500, 1.2, -1);
  text('PUNHOS DOS', W / 2, 92, 40, '#fff', { italic: true });
  ctx.save(); ctx.translate(W / 2, 178); ctx.scale(1 + Math.sin(G.t * 0.05) * 0.012, 1);
  text('SETE MARES', 0, 0, 104, ['#fff7c2', '#ffd24a', '#e8650c'], { italic: true, lw: 14 });
  ctx.restore();
  text('D U E L O   D E   P I R A T A S', W / 2, 214, 19, '#4fd0ff', { lw: 4 });
  TITLE_ITEMS().forEach((s, i) => menuItem(s, i, G.menuI, 282 + i * 42, () => { G.menuI = i; titleSelect(i); }, (k) => { G.menuI = k; }));
  text('↑ ↓ escolher   ·   Enter / J confirmar   ·   M som', W / 2, H - 16, 15, '#b8b2d0', { lw: 3 });
}

// ---------------- Controles ----------------
function drawControls() {
  drawStage(1, (STAGE_W - W) / 2);
  dim(0.8);
  text('CONTROLES', W / 2, 60, 46, GOLD(), { italic: true });
  const col = (x, title, rows) => {
    text(title, x, 104, 20, '#4fd0ff', { italic: true });
    rows.forEach((r, i) => { text(r[0], x - 12, 132 + i * 23, 16, '#ffd24a', { align: 'right', lw: 3 }); text(r[1], x + 4, 132 + i * 23, 16, '#f0ecf8', { align: 'left', lw: 3 }); });
  };
  col(200, '1 JOGADOR', [['Mover', 'A D  ou  ← →'], ['Pular / Agachar', 'W / S  ou  ↑ / ↓'], ['Soco', 'J  (ou F)'], ['Chute', 'K  (ou G)'], ['Golpe forte', 'L  (ou H)'], ['Especial', 'U  (ou R)'], ['Super', 'I  (ou T)']]);
  col(480, '2 JOGADORES — P1', [['Mover', 'A D'], ['Pular / Agachar', 'W / S'], ['Soco', 'F'], ['Chute', 'G'], ['Golpe forte', 'H'], ['Especial', 'R'], ['Super', 'T']]);
  col(760, '2 JOGADORES — P2', [['Mover', '← →'], ['Pular / Agachar', '↑ / ↓'], ['Soco', 'J'], ['Chute', 'K'], ['Golpe forte', 'L'], ['Especial', 'U'], ['Super', 'I']]);
  text('GOLPES', W / 2, 322, 20, '#4fd0ff', { italic: true });
  drawMoveList(348);
  text('Pausa: Esc / Enter  ·  Som: M  ·  Controles USB/Bluetooth também funcionam', W / 2, H - 28, 14, '#b8b2d0', { lw: 3 });
  text('pressione qualquer tecla para voltar', W / 2, H - 8, 13, '#8a84a8', { lw: 3 });
  hot(0, 0, W, H, () => { SFX.back(); goto('title'); });
}

// ---------------- Seleção ----------------
function drawSelect() {
  drawStage(1, (STAGE_W - W) / 2 + Math.sin(G.t * 0.005) * 120);
  dim(0.66);
  const s = G.sel, solo = G.mode !== '2p';
  text(!solo ? 'ESCOLHAM SEUS LUTADORES' : s.step === 0 ? 'ESCOLHA SEU LUTADOR' : 'ESCOLHA O RIVAL', W / 2, 58, 40, GOLD(), { italic: true });
  const cw = 180, chh = 232, gap = 24, x0 = (W - (cw * 4 + gap * 3)) / 2, y0 = 82;
  CHARS.forEach((ch, i) => {
    const x = x0 + i * (cw + gap), pf = G.prevs[i];
    const on1 = s.cur[0] === i, on2 = s.cur[1] === i && (!solo || s.step === 1);
    const picked = (on1 && s.done[0]) || (on2 && s.done[1]);
    animPrev(pf, picked ? 'win' : 'idle');
    const g = ctx.createLinearGradient(0, y0, 0, y0 + chh);
    g.addColorStop(0, '#141026'); g.addColorStop(1, on1 || on2 ? shade(ch.col.fx, -0.45) : '#2a2440');
    ctx.fillStyle = g; ctx.fillRect(x, y0, cw, chh);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y0, cw, chh); ctx.clip();
    ctx.globalAlpha = on1 || on2 ? 1 : 0.6;
    drawPrev(pf, x + cw / 2 - 6, y0 + chh - 40, 0.82, 1);
    ctx.restore();
    ctx.fillStyle = 'rgba(8,6,20,.82)'; ctx.fillRect(x, y0 + chh - 32, cw, 32);
    text(ch.name, x + cw / 2, y0 + chh - 9, 19, '#fff', { italic: true });
    ctx.lineWidth = 2; ctx.strokeStyle = '#4a4466'; ctx.strokeRect(x, y0, cw, chh);
    const pulse = 3 + Math.sin(G.t * 0.2) * 1.5;
    if (on2) { ctx.lineWidth = s.done[1] ? 6 : pulse; ctx.strokeStyle = '#ff5a4a'; ctx.strokeRect(x + 3, y0 + 3, cw - 6, chh - 6); text(solo ? 'CPU' : 'P2', x + cw - 8, y0 + 26, 20, '#ff5a4a', { align: 'right' }); }
    if (on1) { ctx.lineWidth = s.done[0] ? 6 : pulse; ctx.strokeStyle = '#4fb4ff'; ctx.strokeRect(x, y0, cw, chh); text('P1', x + 8, y0 + 26, 20, '#4fb4ff', { align: 'left' }); }
    hot(x, y0, cw, chh, () => selClick(i));
  });
  // fichas
  const card = (ci, x, al, tag, colr) => {
    const ch = CHARS[ci], d = al === 'left' ? 1 : -1;
    text(tag + '  ' + ch.name, x, 352, 26, colr, { align: al, italic: true });
    text(ch.title, x, 374, 16, '#d8d2e8', { align: al, lw: 3 });
    Object.keys(ch.stats).forEach((k, j) => {
      const y = 398 + j * 20;
      text(k, x, y, 14, '#b8b2d0', { align: al, lw: 3 });
      for (let n = 0; n < 5; n++) { ctx.fillStyle = n < ch.stats[k] ? ch.col.fx : '#2a2440'; ctx.fillRect(x + d * (112 + n * 22) - (d < 0 ? 18 : 0), y - 11, 18, 10); }
    });
    text([ch.moves.proj.name, ch.moves.upper.name, ch.moves.rush.name].join(' · '), x, 486, 14, '#f0ecf8', { align: al, lw: 3 });
    text('Super: ' + ch.moves.super.name, x, 506, 14, '#ffd24a', { align: al, lw: 3 });
  };
  card(s.cur[0], 96, 'left', 'P1', '#4fb4ff');
  if (!solo || s.step === 1) card(s.cur[1], W - 96, 'right', solo ? 'CPU' : 'P2', '#ff5a4a');
  text(solo ? '← → escolher  ·  Enter / J confirmar  ·  Esc voltar' : 'P1: A D + F     ·     P2: ← → + J     ·     Esc voltar', W / 2, H - 8, 14, '#b8b2d0', { lw: 3 });
}

// ---------------- Resultado ----------------
function drawResult() {
  drawStage(G.stage, (STAGE_W - W) / 2);
  dim(0.7);
  const w = G.result && G.result.win;
  if (w) {
    const pf = G.prevs[CHARS.indexOf(w.ch)], keep = pf.col;
    pf.col = w.col; animPrev(pf, 'win'); drawPrev(pf, 230, 480, 1.7, 1); pf.col = keep;
    text('VITÓRIA!', 620, 130, 84, GOLD(), { italic: true });
    text(w.ch.name, 620, 190, 44, '#fff', { italic: true });
    text(w.ch.title, 620, 220, 18, w.col.fx, { lw: 4 });
    text(G.mode === 'cpu' ? (w === G.p1 ? 'Você venceu o duelo!' : 'A CPU levou a melhor...') : (w === G.p1 ? 'Jogador 1 vence!' : 'Jogador 2 vence!'), 620, 252, 18, '#d8d2e8', { lw: 3 });
  } else text('EMPATE!', W / 2, 170, 90, GOLD(), { italic: true });
  const cx = w ? 620 : W / 2;
  ['REVANCHE', 'TROCAR LUTADORES', 'MENU PRINCIPAL'].forEach((s, i) => {
    ctx.save(); ctx.translate(cx - W / 2, 0);
    menuItem(s, i, G.resI, 320 + i * 46, () => resultSelect(i), (k) => { G.resI = k; });
    ctx.restore();
    const h = G.hot[G.hot.length - 1]; h.x += cx - W / 2;
  });
}
