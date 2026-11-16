'use strict';
// ============================================================
//  Jogo: efeitos, resolução de golpes, projéteis, cenas e loop principal
// ============================================================
Object.assign(G, {
  scene: 'title', sceneT: 0, t: 0, menuI: 0, diff: 1, mode: 'cpu', hot: [], parts: [], projs: [],
  cam: (STAGE_W - W) / 2, shakeT: 0, shakeMag: 0, hitstop: 0, flash: null, slow: 0, boltFlash: 0,
  paused: false, pauseI: 0, resI: 0, dummy: 0, stage: 0, callouts: [null, null], phase: 'intro', phaseT: 0,
  round: 1, timer: 99, timerF: 0, winner: null, perfect: false, koKind: 'ko', result: null, sel: null, ai: null,
});
G.prevs = CHARS.map((ch, i) => ({ ch, col: ch.col, x: 0, y: 0, facing: 1, pose: clonePose(ch.poses.idle || POSES.idle), vx: 0, idx: i, state: 'idle', mv: null, flash: 0 }));
let PROJ_SEQ = 1;

// ---------------- Efeitos ----------------
G.shake = (m) => { G.shakeMag = Math.max(G.shakeT > 0 ? G.shakeMag : 0, m); G.shakeT = Math.max(G.shakeT, 8); };
G.spark = (x, y, str, col) => {
  G.parts.push({ type: 'star', x, y, life: 6 + str, max: 6 + str, size: 16 + str * 9, col: '#fff', rot: rand(0, 1) });
  G.parts.push({ type: 'ring', x, y, life: 9 + str * 2, max: 9 + str * 2, size: 12 + str * 9, col });
  for (let i = 0, n = 5 + str * 4; i < n; i++) {
    const a = rand(0, 6.28), s = rand(3, 7 + str * 2.5);
    G.parts.push({ type: 'line', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(9, 17), max: 17, size: 2 + str * 0.6, col: i % 2 ? col : '#fff', grav: 0.25 });
  }
};
G.blockSpark = (x, y) => {
  G.parts.push({ type: 'ring', x, y, life: 9, max: 9, size: 20, col: '#bfe4ff' });
  for (let i = 0; i < 6; i++) { const a = rand(0, 6.28), s = rand(2, 6); G.parts.push({ type: 'line', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 10, max: 10, size: 2, col: '#dff2ff' }); }
};
G.dust = (x, n) => {
  for (let i = 0; i < n * 2; i++) G.parts.push({ type: 'smoke', x: x + rand(-14, 14), y: GROUND - 2, vx: rand(-1.6, 1.6), vy: rand(-0.9, -0.1), life: 18, max: 18, size: rand(5, 10), col: '#e6d6b8' });
};
G.puff = (f) => {
  for (let i = 0; i < 14; i++) G.parts.push({ type: 'smoke', x: f.x + rand(-22, 22), y: GROUND - f.y - rand(10, 150), vx: rand(-2, 2), vy: rand(-1.5, 0.5), life: 20, max: 20, size: rand(7, 13), col: f.col.fx });
};
G.floatText = (x, y, str, col) => { G.parts.push({ type: 'text', x, y, vx: 0, vy: -0.8, life: 50, max: 50, text: str, col }); };
G.callout = (f, str) => { G.callouts[f.idx] = { text: str, t: 55 }; };
G.superFlash = (f, mv) => { G.flash = { t: 44, max: 44, who: f, name: mv.name }; G.callouts[f.idx] = null; SFX.super(); };

function updParts() {
  const ps = G.parts;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.x += p.vx || 0; p.y += p.vy || 0; if (p.grav) p.vy += p.grav;
    if (--p.life <= 0) ps.splice(i, 1);
  }
  if (ps.length > 450) ps.splice(0, ps.length - 450);
}

// ---------------- Projéteis ----------------
function hitData(mv) {
  const s = mv.p;
  return { dmg: s.dmg, hitstun: s.hitstun || 20, blockstun: s.blockstun || 14, push: s.push != null ? s.push : 8, hitstop: s.hitstop || 9,
    level: 'mid', type: mv.type, launch: s.launch, str: mv.type === 'super' ? 3 : 2, rehit: s.rehit, suck: s.suck };
}
G.spawnProj = (f, mv) => {
  const s = mv.p;
  G.projs.push({ id: PROJ_SEQ++, owner: f, kind: s.kind, x: f.x + f.facing * 52 * f.ch.scale, y: s.y, vx: f.facing * s.speed, w: s.w, h: s.h,
    hits: s.hits || 1, rehitT: 0, t: 0, delay: 0, life: s.life, super: mv.type === 'super', mv: hitData(mv) });
  SFX.fire();
};
G.spawnStorm = (f, mv, opp) => {
  const s = mv.p;
  for (let i = 0; i < mv.bolts; i++) {
    G.projs.push({ id: PROJ_SEQ++, owner: f, kind: 'bolt', x: opp.x, y: 0, vx: 0, w: s.w, h: s.h, hits: 1, rehitT: 0, t: 0,
      delay: 30 + i * 26, lock: 18, target: opp, life: 8, super: true, mv: hitData(mv) });
  }
};
const projBox = (p) => ({ x: p.x - p.w / 2, y: GROUND - p.y - p.h, w: p.w, h: p.h });

function updProjs() {
  for (const p of G.projs) {
    if (p.delay > 0) {
      p.delay--;
      if (p.delay > p.lock) p.x = p.target.x;
      if (p.delay === 0) { SFX.thunder(); G.shake(8); G.boltFlash = 6; }
      continue;
    }
    p.t++; p.x += p.vx;
    if (p.rehitT > 0) p.rehitT--;
    if (p.life != null && p.t > p.life) p.dead = true;
    if (p.x < G.cam - 180 || p.x > G.cam + W + 180) p.dead = true;
    if (p.dead) continue;
    const C = p.owner.col;
    if (p.kind !== 'bolt' && p.t % 2 === 0) {
      G.parts.push({ type: 'dot', x: p.x - Math.sign(p.vx) * rand(0, p.w * 0.5), y: GROUND - p.y - rand(0, p.h), vx: -p.vx * 0.2, vy: rand(-1.4, 1.4) - (p.kind === 'tornado' ? 3 : 0),
        life: 14, max: 14, size: rand(2, p.super ? 7 : 5), col: p.t % 4 ? C.fx : C.fx2 });
    }
    const box = projBox(p);
    if (p.kind !== 'bolt') {
      for (const q of G.projs) {
        if (q === p || q.dead || q.owner === p.owner || q.delay > 0 || q.kind === 'bolt') continue;
        if (overlap(box, projBox(q))) {
          p.hits--; q.hits--;
          G.spark((p.x + q.x) / 2, GROUND - p.y - p.h / 2, 2, '#fff'); SFX.block();
          if (p.hits <= 0) p.dead = true;
          if (q.hits <= 0) q.dead = true;
        }
      }
      if (p.dead) continue;
    }
    const opp = p.owner === G.p1 ? G.p2 : G.p1, ub = opp.hurtbox();
    if (ub && p.rehitT <= 0 && overlap(box, ub)) {
      const px = clamp(p.x, ub.x, ub.x + ub.w), py = clamp(GROUND - p.y - p.h / 2, ub.y + 10, ub.y + ub.h - 10);
      if (G.applyHit(p.owner, opp, p.mv, p.hits <= 1, px, py, p)) { p.hits--; p.rehitT = p.mv.rehit || 0; if (p.hits <= 0) p.dead = true; }
    }
  }
  G.projs = G.projs.filter((p) => !p.dead);
}

// ---------------- Resolução de um golpe ----------------
G.applyHit = (att, def, mv, last, px, py, proj) => {
  if (def.invuln > 0 || def.state === 'down' || def.state === 'getup' || def.hp <= 0) return false;
  if (def.state === 'launched' && def.juggle >= 3 && mv.type !== 'super' && !(mv.hits > 1 && att.hitCount > 0)) return false;
  const dir = (proj && Math.sign(proj.vx)) || (def.x >= att.x ? 1 : -1);
  const str = mv.str || 2, training = G.mode === 'training';
  let dmg = (last && mv.finalDmg ? mv.finalDmg : mv.dmg) * att.ch.dmg;
  const wallPush = () => {
    if (proj || att.y > 0) return;
    if ((dir > 0 && def.x >= STAGE_W - WALL - 2) || (dir < 0 && def.x <= WALL + 2)) att.kbx = -dir * mv.push;
  };
  def.lastHurt = G.t;

  // --- defendido ---
  if (def.canBlock(mv, dir)) {
    if (mv.type !== 'normal') def.hp = Math.max(training ? 1 : 0, def.hp - Math.max(1, Math.round(dmg * 0.16)));
    att.meter = Math.min(100, att.meter + dmg * 0.05); def.meter = Math.min(100, def.meter + dmg * 0.03);
    G.hitstop = Math.max(G.hitstop, Math.round(mv.hitstop * 0.6));
    G.blockSpark(px, py); SFX.block();
    if (def.hp <= 0) { def.launch(dir * 5, 9); return true; }
    def.state = 'blockstun'; def.stateT = 0; def.stun = mv.blockstun; def.blockCrouch = def.ctrl.s.down; def.mv = null; def.vx = 0;
    def.kbx = dir * mv.push * 1.15;
    wallPush();
    return true;
  }
  // --- armadura (Carga do Barão) ---
  if (def.state === 'attack' && def.armor > 0 && mv.type !== 'super') {
    def.armor--; def.hp = Math.max(1, def.hp - Math.round(dmg * 0.6)); def.flash = 8; def.tookDmg = true;
    G.hitstop = Math.max(G.hitstop, 6); G.blockSpark(px, py); SFX.block();
    return true;
  }
  // --- acertou ---
  const counter = def.state === 'attack' && def.mv && def.mf <= def.mv.startup + def.mv.active;
  if (!def.inCombo) { att.combo = 0; att.comboDmg = 0; }
  att.combo++; att.comboT = 80; def.inCombo = true;
  if (counter) { dmg *= 1.2; G.floatText(def.x, GROUND - def.y - 175, 'CONTRA-ATAQUE!', '#ffd24a'); }
  dmg = Math.round(dmg * Math.max(0.3, 1 - 0.1 * (att.combo - 1)));
  def.hp -= dmg; att.comboDmg += dmg; def.tookDmg = true; def.flash = 6;
  if (training && def.hp < 1) def.hp = 1;
  att.meter = Math.min(100, att.meter + dmg * 0.11); def.meter = Math.min(100, def.meter + dmg * 0.07);
  const wasCrouch = def.crouching, air = def.y > 0 || def.state === 'launched';
  def.mv = null; def.hidden = 0; def.vx = 0; def.armor = 0;
  if (def.hp <= 0) { def.hp = 0; def.launch(dir * 5.5, 10); }
  else if (air || (last && mv.launch) || mv.suck) {
    const L = (last && mv.launch) || (mv.suck ? [0.4, 6.5] : [1.6, 5.5]);
    def.launch(dir * L[0], L[1]); def.juggle++;
  } else {
    def.state = 'hitstun'; def.stateT = 0; def.stun = mv.hitstun;
    def.hitPose = wasCrouch ? 'hitC' : (mv.level === 'low' || py > GROUND - 85 * def.ch.scale) ? 'hitLo' : 'hitHi';
    def.kbx = dir * mv.push;
  }
  wallPush();
  G.hitstop = Math.max(G.hitstop, mv.hitstop + (counter ? 3 : 0));
  G.spark(px, py, str, att.col.fx); G.shake(str * 2 + (mv.type === 'super' ? 2 : 0)); SFX.hit(str);
  return true;
};

// ---------------- Cenas ----------------
function goto(scene) { G.scene = scene; G.sceneT = 0; }

function titleSelect(i) {
  SFX.ok();
  if (i === 0) { G.mode = 'cpu'; openSelect(); }
  else if (i === 1) { G.mode = '2p'; openSelect(); }
  else if (i === 2) { G.mode = 'training'; openSelect(); }
  else if (i === 3) G.diff = (G.diff + 1) % 3;
  else goto('controls');
}
function updTitle() {
  const n = 5;
  if (MENU.up()) { G.menuI = (G.menuI + n - 1) % n; SFX.ui(); }
  if (MENU.down()) { G.menuI = (G.menuI + 1) % n; SFX.ui(); }
  if (G.menuI === 3 && (MENU.left() || MENU.right())) { G.diff = (G.diff + (MENU.right() ? 1 : 2)) % 3; SFX.ui(); }
  else if (MENU.ok()) titleSelect(G.menuI);
}
function updControls() { if (G.sceneT > 10 && pressed.length) { SFX.back(); goto('title'); } }

function openSelect() {
  const a = G.sel ? G.sel.cur[0] : 0;
  let b = (Math.random() * CHARS.length) | 0; if (b === a) b = (b + 1) % CHARS.length;
  G.sel = { cur: [a, b], done: [false, false], step: 0, t: 0 };
  goto('select');
}
function selConfirm(i) {
  const s = G.sel;
  if (s.done[i]) return;
  s.done[i] = true; SFX.ok();
  if (G.mode !== '2p' && i === 0) s.step = 1;
}
function selClick(ci) {
  const s = G.sel, i = G.mode !== '2p' ? s.step : (s.done[0] ? 1 : 0);
  if (s.done[i]) return;
  s.cur[i] = ci; selConfirm(i);
}
function updSelect() {
  const s = G.sel, n = CHARS.length, solo = G.mode !== '2p';
  if (s.done[0] && s.done[1]) { if (++s.t > 45) startMatch(); return; }
  if (hit('Escape', 'Backspace', 'Pad0back')) {
    SFX.back();
    if (solo && s.step === 1) { s.step = 0; s.done[0] = false; } else goto('title');
    return;
  }
  const mv = (i, d) => { if (!s.done[i]) { s.cur[i] = (s.cur[i] + n + d) % n; SFX.ui(); } };
  if (solo) {
    const i = s.step;
    if (MENU.left()) mv(i, -1);
    if (MENU.right()) mv(i, 1);
    if (MENU.ok()) selConfirm(i);
  } else {
    if (hit('KeyA', 'Pad0left')) mv(0, -1);
    if (hit('KeyD', 'Pad0right')) mv(0, 1);
    if (hit('KeyF', 'Space', 'Pad0mk', 'Pad0lp')) selConfirm(0);
    if (hit('ArrowLeft', 'Pad1left')) mv(1, -1);
    if (hit('ArrowRight', 'Pad1right')) mv(1, 1);
    if (hit('KeyJ', 'Enter', 'Numpad1', 'Pad1mk', 'Pad1lp')) selConfirm(1);
  }
}

function startMatch() {
  const [a, b] = G.sel.cur;
  G.p1 = new Fighter(CHARS[a], 0, new Controller(), false);
  G.p2 = new Fighter(CHARS[b], 1, new Controller(), a === b);
  G.ai = G.mode === '2p' ? null : new AI(G.mode === 'training' ? 1 : G.diff);
  G.stage = (Math.random() * STAGES.length) | 0;
  G.round = 1; G.paused = false; G.dummy = 0;
  startRound();
  goto('fight');
}
function startRound() {
  G.p1.reset(STAGE_W / 2 - 170, 1); G.p2.reset(STAGE_W / 2 + 170, -1);
  G.projs = []; G.parts = []; G.callouts = [null, null];
  G.phase = G.mode === 'training' ? 'fight' : 'intro'; G.phaseT = 0;
  G.timer = 99; G.timerF = 0; G.hitstop = 0; G.flash = null; G.slow = 0; G.shakeT = 0; G.boltFlash = 0;
  G.cam = (STAGE_W - W) / 2; G.winner = null; G.perfect = false;
}
function endRound(kind) {
  const p1 = G.p1, p2 = G.p2;
  G.phase = 'ko'; G.phaseT = 0; G.koKind = kind;
  const r1 = p1.hp / p1.ch.hp, r2 = p2.hp / p2.ch.hp;
  G.winner = r1 > r2 ? p1 : r2 > r1 ? p2 : null;
  if (G.winner) G.winner.wins++; else { p1.wins++; p2.wins++; }
  G.perfect = !!G.winner && !G.winner.tookDmg;
  if (kind === 'ko') { G.slow = 48; SFX.ko(); G.shake(10); } else SFX.round();
}

function togglePause() { if (G.scene !== 'fight') return; G.paused = !G.paused; G.pauseI = 0; SFX.ui(); }
function pauseSelect(i) { SFX.ok(); G.paused = false; if (i === 1) goto('title'); }
function resultSelect(i) {
  SFX.ok();
  if (i === 0) startMatch(); else if (i === 1) openSelect(); else goto('title');
}
function updResult() {
  if (G.sceneT < 40) return;
  if (MENU.up()) { G.resI = (G.resI + 2) % 3; SFX.ui(); }
  if (MENU.down()) { G.resI = (G.resI + 1) % 3; SFX.ui(); }
  if (MENU.ok()) resultSelect(G.resI);
}

function cpuInput() {
  if (G.mode === 'cpu') return G.ai.think(G.p2, G.p1, G);
  if (G.dummy === 3) return G.ai.think(G.p2, G.p1, G);
  return { down: G.dummy === 1, up: G.dummy === 2 };
}

function bodies() {
  const a = G.p1, b = G.p2;
  const lim = () => { a.x = clamp(a.x, WALL, STAGE_W - WALL); b.x = clamp(b.x, WALL, STAGE_W - WALL); };
  lim();
  const solid = (f) => f.state !== 'down' && f.state !== 'launched' && !f.hidden;
  if (solid(a) && solid(b) && Math.abs(a.y - b.y) < 70) {
    const minD = 1.02 * (a.ch.build.shW * a.ch.scale + b.ch.build.shW * b.ch.scale), dx = b.x - a.x;
    if (Math.abs(dx) < minD) {
      const sg = dx > 0 ? 1 : dx < 0 ? -1 : a.facing, push = Math.min((minD - Math.abs(dx)) / 2, 7);
      a.x -= sg * push; b.x += sg * push;
      lim();
    }
  }
  const d = b.x - a.x;
  if (Math.abs(d) > MAX_DIST) { const ex = (Math.abs(d) - MAX_DIST) / 2 * Math.sign(d); a.x += ex; b.x -= ex; }
}

function updFight() {
  if (hit('Escape', 'KeyP', 'Enter', 'Pad0start', 'Pad1start')) { togglePause(); return; }
  if (G.paused) {
    if (MENU.up() || MENU.down()) { G.pauseI = 1 - G.pauseI; SFX.ui(); }
    if (hit('Space', 'KeyJ', 'KeyF', 'Pad0mk', 'Pad0lp')) pauseSelect(G.pauseI);
    return;
  }
  const p1 = G.p1, p2 = G.p2, training = G.mode === 'training';
  if (training && hit('Digit1', 'Numpad1')) { G.dummy = (G.dummy + 1) % 4; SFX.ui(); }

  // a entrada é lida sempre (mesmo em hitstop) para o buffer não perder comandos
  const frozen = G.hitstop > 0 || !!G.flash;
  p1.ctrl.feed(rawInput(0, G.mode !== '2p'), p1.facing, frozen);
  p2.ctrl.feed(G.mode === '2p' ? rawInput(1, false) : cpuInput(), p2.facing, frozen);

  updParts();
  if (G.shakeT > 0) G.shakeT--;
  if (G.boltFlash > 0) G.boltFlash--;
  for (let i = 0; i < 2; i++) { const c = G.callouts[i]; if (c && --c.t <= 0) G.callouts[i] = null; }
  if (G.flash) { if (--G.flash.t <= 0) G.flash = null; return; }
  if (G.hitstop > 0) { G.hitstop--; return; }
  if (G.slow > 0) { G.slow--; if (G.slow % 3) return; }

  G.phaseT++;
  if (G.phase === 'intro') {
    if (G.phaseT === 2) SFX.round();
    if (G.phaseT === 72) SFX.fight();
    if (G.phaseT >= 104) { G.phase = 'fight'; G.phaseT = 0; }
  } else if (G.phase === 'fight') {
    if (training) {
      p1.meter = 100;
      for (const f of [p1, p2]) if (!f.inCombo && G.t - (f.lastHurt || 0) > 70) f.hp = Math.min(f.ch.hp, f.hp + 12);
    } else if (++G.timerF >= 60) { G.timerF = 0; if (--G.timer <= 0) endRound('time'); }
  } else if (G.phase === 'ko') {
    const w = G.winner;
    if (G.phaseT >= 95 && w && w.state === 'idle' && w.y <= 0) { w.state = 'win'; SFX.win(); }
    if (G.phaseT >= 240) {
      if (p1.wins >= 2 || p2.wins >= 2) {
        G.result = { win: p1.wins > p2.wins ? p1 : p2.wins > p1.wins ? p2 : null }; G.resI = 0; goto('result');
      } else { G.round++; startRound(); }
      return;
    }
  }

  // alterna a ordem a cada quadro para nenhum lado ter vantagem em trocas
  const first = G.t % 2 ? p1 : p2, second = first === p1 ? p2 : p1;
  first.update(second, G); second.update(first, G);
  updProjs();
  bodies();
  p1.updatePose(G); p2.updatePose(G);
  for (const f of [p1, p2]) if (f.hpLag > f.hp && !f.inCombo) f.hpLag = Math.max(f.hp, f.hpLag - 5);
  G.cam += (clamp((p1.x + p2.x) / 2 - W / 2, 0, STAGE_W - W) - G.cam) * 0.12;

  if (G.phase === 'fight' && (p1.hp <= 0 || p2.hp <= 0)) endRound('ko');
}

// ---------------- Loop principal ----------------
const UPD = { title: updTitle, controls: updControls, select: updSelect, fight: updFight, result: updResult };
const DRAW = { title: drawTitle, controls: drawControls, select: drawSelect, fight: drawFight, result: drawResult };
const touchEl = document.getElementById('touch');

function tick() {
  pollPads();
  G.t++; G.sceneT++;
  if (hit('KeyM')) toggleMute();
  UPD[G.scene]();
  pressed.length = 0;
  if (IS_TOUCH) touchEl.style.display = G.scene === 'fight' && !G.paused ? 'block' : 'none';
}
function render() {
  ctx.setTransform(VS, 0, 0, VS, 0, 0);
  G.hot.length = 0;
  DRAW[G.scene]();
  if (muted) text('SOM DESLIGADO (M)', W - 10, H - 6, 12, '#b8b2d0', { align: 'right', lw: 3 });
}

const STEP = 1000 / 60;
let lastTs = 0, acc = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  acc += Math.min(100, ts - lastTs); lastTs = ts;
  let n = 0;
  while (acc >= STEP && n < 5) { tick(); acc -= STEP; n++; }
  if (n === 5) acc = 0;
  render();
}

// cliques / toques nos menus
function canvasPt(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
function hotAt(x, y) { for (let i = G.hot.length - 1; i >= 0; i--) { const h = G.hot[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; } return null; }
cv.addEventListener('pointerdown', (e) => { audioInit(); const [x, y] = canvasPt(e), h = hotAt(x, y); if (h) h.fn(); });
cv.addEventListener('pointermove', (e) => { const [x, y] = canvasPt(e), h = hotAt(x, y); if (h && h.hover) h.hover(); cv.style.cursor = h ? 'pointer' : 'default'; });

if (IS_TOUCH) setupTouch();
requestAnimationFrame((ts) => { lastTs = ts; loop(ts); });
