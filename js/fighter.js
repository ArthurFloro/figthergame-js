'use strict';
// ============================================================
//  Lutador (máquina de estados, golpes, combos) e IA
// ============================================================
const M236 = [[2], [3, 6]];        // ↓ ↘ →
const M214 = [[2], [1, 4]];        // ↓ ↙ ←
const M623 = [[6], [2], [3]];      // → ↓ ↘
let ATK_SEQ = 1;

class Fighter {
  constructor(ch, idx, ctrl, alt) {
    this.ch = ch; this.idx = idx; this.ctrl = ctrl;
    this.col = alt ? ch.alt : ch.col;
    this.moves = ch.moves;
    this.wins = 0; this.meter = 0; this.jumpId = 0;
    this.pose = clonePose(POSES.idle); this.trail = [];
    this.reset(0, 1);
  }

  reset(x, facing) {
    Object.assign(this, {
      x, y: 0, vx: 0, vy: 0, kbx: 0, facing, hp: this.ch.hp, hpLag: this.ch.hp,
      state: 'idle', stateT: 0, mv: null, mf: 0, stun: 0,
      combo: 0, comboT: 0, comboDmg: 0, inCombo: false, juggle: 0, invuln: 0, airAtk: false, walkPh: 0,
      hidden: 0, armor: 0, flash: 0, hitPose: 'hitHi', blockCrouch: false, atkId: 0, tookDmg: false,
      connected: false, connT: 0, hitCount: 0, rehitT: 0, lastHitF: 0, bounced: false, jumpDir: 0,
    });
    this.pose = clonePose(this.P('idle')); this.trail = [];
  }

  P(n) { return this.ch.poses[n] || POSES[n]; }

  get crouching() {
    return this.state === 'crouch' || (this.state === 'attack' && this.mv && this.mv.crouch) ||
      (this.state === 'blockstun' && this.blockCrouch) || (this.state === 'hitstun' && this.hitPose === 'hitC');
  }

  hurtbox() {
    if (this.state === 'down' || this.state === 'getup' || this.hidden) return null;
    const sc = this.ch.scale, w = 46 * sc;
    const h = (this.crouching ? 94 : this.state === 'launched' ? 96 : this.y > 0 ? 126 : 150) * sc;
    return { x: this.x - w / 2, y: GROUND - this.y - h, w, h };
  }

  hitbox(mv) {
    const sc = this.ch.scale, b = mv.box;
    const x0 = this.x + this.facing * b[0] * sc, x1 = this.x + this.facing * (b[0] + b[2]) * sc;
    return { x: Math.min(x0, x1), y: GROUND - this.y - (b[1] + b[3]) * sc, w: Math.abs(x1 - x0), h: b[3] * sc };
  }

  // dir = sentido em que o golpe empurra; "para trás" é segurar nesse mesmo sentido
  canBlock(mv, dir) {
    if (this.y > 0) return false;
    if (this.state !== 'idle' && this.state !== 'crouch' && this.state !== 'blockstun') return false;
    const s = this.ctrl.s;
    if (!(dir > 0 ? s.right : s.left)) return false;
    if (mv.level === 'low' && !s.down) return false;
    if (mv.level === 'overhead' && s.down) return false;
    return true;
  }

  canDo(id, G) {
    if (id === 'proj') return !G.projs.some((p) => p.owner === this && !p.super);
    return true;
  }

  toNeutral() { this.state = this.ctrl.s.down ? 'crouch' : 'idle'; this.mv = null; this.stateT = 0; this.vx = 0; }
  recover() { this.inCombo = false; this.juggle = 0; this.bounced = false; this.toNeutral(); }

  launch(vx, vy) {
    this.state = 'launched'; this.stateT = 0; this.vx = vx; this.vy = vy;
    this.y = Math.max(this.y, 0.01); this.bounced = false; this.mv = null;
  }

  airPhys() {
    this.x += this.vx; this.y += this.vy; this.vy -= GRAV;
    if (this.y <= 0 && this.vy < 0) { this.y = 0; return true; }
    return false;
  }

  land(G) {
    this.y = 0; this.vy = 0; this.vx = 0; this.state = 'lag'; this.stun = 2; this.mv = null;
    G.dust(this.x, 2); SFX.land();
  }

  // ---------------- atualização por quadro ----------------
  update(opp, G) {
    const canAct = G.phase === 'fight';
    this.stateT++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    if (this.comboT > 0) this.comboT--;

    switch (this.state) {
      case 'idle': case 'crouch': this.neutral(opp, G, canAct); break;
      case 'prejump':
        if (this.stateT >= 4) {
          this.state = 'air'; this.stateT = 0; this.vy = this.ch.jumpV; this.vx = this.jumpDir * this.ch.jumpX;
          this.y = 0.01; this.airAtk = false; this.jumpId++; SFX.jump(); G.dust(this.x, 2);
        }
        break;
      case 'air':
        if (this.airPhys()) { this.land(G); break; }
        if (canAct) this.tryAttack(G, null);
        break;
      case 'attack': this.updateAttack(opp, G); break;
      case 'lag': if (--this.stun <= 0) this.toNeutral(); break;
      case 'hitstun': case 'blockstun': if (--this.stun <= 0) this.recover(); break;
      case 'launched':
        this.x += this.vx; this.y += this.vy; this.vy -= GRAV * 0.9;
        if (this.y <= 0 && this.vy < 0) {
          this.y = 0;
          if (!this.bounced && this.vy < -9) {
            this.bounced = true; this.vy = 4.6; this.vx *= 0.5; this.y = 0.01;
            G.dust(this.x, 4); SFX.down(); G.shake(5);
          } else {
            this.state = 'down'; this.stateT = 0; this.vx = 0; this.vy = 0;
            G.dust(this.x, 4); SFX.down(); G.shake(4);
          }
        }
        break;
      case 'down': if (this.hp > 0 && this.stateT > 26) { this.state = 'getup'; this.stateT = 0; } break;
      case 'getup': if (this.stateT > 16) { this.recover(); this.invuln = 4; } break;
      default: break; // 'win'
    }

    if (this.kbx) { this.x += this.kbx; this.kbx *= 0.8; if (Math.abs(this.kbx) < 0.15) this.kbx = 0; }
    this.fx(G);
  }

  neutral(opp, G, canAct) {
    if (opp.x !== this.x) this.facing = opp.x > this.x ? 1 : -1;
    this.vx = 0;
    if (!canAct) { this.state = 'idle'; return; }
    if (this.tryAttack(G, null)) return;
    const s = this.ctrl.s;
    if (s.up) { this.state = 'prejump'; this.stateT = 0; this.jumpDir = (s.right ? 1 : 0) - (s.left ? 1 : 0); return; }
    if (s.down) { this.state = 'crouch'; return; }
    this.state = 'idle';
    const d = (s.right ? 1 : 0) - (s.left ? 1 : 0);
    if (d) {
      const fwd = d === this.facing;
      this.vx = d * (fwd ? this.ch.walk : this.ch.back);
      this.x += this.vx; this.walkPh += fwd ? 0.21 : -0.17;
    }
  }

  // Lê o buffer e inicia um golpe se possível. `from` = golpe sendo cancelado (combo)
  tryAttack(G, from) {
    const c = this.ctrl, s = c.s;
    if (this.state === 'air') {
      if (this.airAtk) return false;
      for (const [b, id] of [['hp', 'jHP'], ['mk', 'jMK'], ['lp', 'jLP']]) if (c.take(b)) { this.startMove(id, G); return true; }
      return false;
    }
    if (from && from.type !== 'normal') return false;

    if (c.peek('su')) {
      c.take('su');
      if (this.meter >= 100 || G.mode === 'training') { this.meter = 0; this.startMove('super', G); return true; }
    }
    if (c.peek('sp')) {
      const n = c.take('sp').n;   // direção no instante do aperto
      const id = n <= 3 ? 'upper' : n === 6 || n === 9 ? 'rush' : 'proj';
      if (this.canDo(id, G)) { this.startMove(id, G); return true; }
      return false;
    }
    let btn = null;
    for (const b of ['hp', 'mk', 'lp']) if (c.peek(b)) { btn = b; break; }
    if (!btn) return false;

    // comandos clássicos (meia-lua etc.)
    let id = null;
    if (c.cur() === 3 && c.motion(M623)) id = 'upper';
    else if (c.motion(M236)) id = 'proj';
    else if (c.motion(M214)) id = 'rush';
    if (id && this.canDo(id, G)) { c.take(btn); this.startMove(id, G); return true; }

    const nid = (s.down ? 'c' : 's') + { lp: 'LP', mk: 'MK', hp: 'HP' }[btn];
    if (from && this.moves[nid].str <= from.str) return false;   // combo só sobe de força: soco → chute → forte
    c.take(btn); this.startMove(nid, G); return true;
  }

  startMove(id, G) {
    const mv = this.moves[id];
    this.state = 'attack'; this.mv = mv; this.mf = 0; this.stateT = 0;
    this.connected = false; this.connT = 0; this.hitCount = 0; this.rehitT = 0; this.lastHitF = 0;
    if (!mv.air) this.vx = 0;
    this.atkId = ATK_SEQ++; this.armor = mv.armor ? 1 : 0; this.hidden = 0;
    if (mv.air) this.airAtk = true;
    if (mv.invuln) this.invuln = Math.max(this.invuln, mv.invuln);
    if (mv.type === 'special') { this.meter = Math.min(100, this.meter + 4); G.callout(this, mv.name); SFX.special(); }
    else if (mv.type === 'super') { this.invuln = mv.startup + 4; G.superFlash(this, mv); }
    else SFX.whoosh(mv.str);
  }

  updateAttack(opp, G) {
    const mv = this.mv, f = ++this.mf, A0 = mv.startup, A1 = mv.startup + mv.active, END = A1 + mv.recovery;
    if (this.connected) this.connT++;

    if (mv.air) {
      if (this.airPhys()) { this.land(G); return; }
      if (f > A0 && f <= A1) this.tryHit(opp, G);
      else if (f > A1) { this.state = 'air'; this.mv = null; }
      return;
    }

    switch (mv.kind) {
      case 'proj': if (f === A0) G.spawnProj(this, mv); break;
      case 'storm': if (f === A0) G.spawnStorm(this, mv, opp); break;

      case 'upper':
        if (f === A0 + 1) { this.vy = mv.vy; this.vx = this.facing * mv.vx; this.y = 0.01; G.dust(this.x, 3); }
        if (f > A0) {
          if (this.airPhys()) {
            this.vx = 0; this.vy = 0; this.state = 'lag'; this.stun = mv.recovery; this.mv = null;
            G.dust(this.x, 2); SFX.land(); return;
          }
          if (f <= A1) this.tryHit(opp, G);
        }
        return;

      case 'rush':
        if (mv.teleport) {
          if (f === 5) { this.hidden = 1; this.invuln = A0 - 3; G.puff(this); }
          if (f === A0) {
            if (Math.abs(opp.x - this.x) < 420 && opp.y < 90) {
              const side = this.facing;
              this.x = clamp(opp.x + side * 76, WALL, STAGE_W - WALL);
              this.facing = opp.x > this.x ? 1 : opp.x < this.x ? -1 : -side;
            } else this.x += this.facing * 170;
            this.hidden = 0; G.puff(this);
          }
        }
        if (f > A0 && f <= A1) {
          if (!(mv.stopOnHit && this.connected)) this.x += this.facing * mv.speed;
          this.tryHit(opp, G);
          if (mv.stopOnHit) {
            if (!this.connected) { if (f > A0 + mv.dash) this.mf = A1; }
            else if (this.hitCount >= mv.hits || this.stateT - this.lastHitF > 12) this.mf = A1;
            else this.mf = Math.min(this.mf, A1 - 2);
          }
        } else if (f > A1 && f < A1 + 8) this.x += this.facing * mv.speed * 0.4 * (1 - (f - A1) / 8);
        break;

      default:
        if (f <= A0 && mv.step) this.x += this.facing * mv.step;
        if (f > A0 && f <= A1) this.tryHit(opp, G);
        if (this.connected && this.connT <= 16 && G.phase === 'fight' && this.tryAttack(G, mv)) return;
    }
    if (this.mf > END) this.toNeutral();
  }

  tryHit(opp, G) {
    const mv = this.mv, n = mv.hits || 1;
    if (this.hitCount >= n) return;
    if (this.rehitT > 0) { this.rehitT--; return; }
    const hb = this.hitbox(mv), ub = opp.hurtbox();
    if (!ub || !overlap(hb, ub)) return;
    const last = this.hitCount + 1 >= n;
    const px = clamp(this.x + this.facing * (mv.box[0] + mv.box[2] * 0.8) * this.ch.scale, ub.x, ub.x + ub.w);
    const py = clamp(hb.y + hb.h / 2, ub.y + 6, ub.y + ub.h - 6);
    if (G.applyHit(this, opp, mv, last, px, py, null)) {
      this.hitCount++; this.rehitT = mv.rehit || 0;
      if (!this.connected) { this.connected = true; this.connT = 0; }
      this.lastHitF = this.stateT;
    }
  }

  // rastros e partículas dos especiais
  fx(G) {
    const mv = this.mv, sc = this.ch.scale, c = this.col;
    if (this.state === 'attack' && mv && mv.type !== 'normal') {
      const act = this.mf > mv.startup && this.mf <= mv.startup + mv.active;
      if ((mv.kind === 'rush' || mv.kind === 'upper') && act && !this.hidden) {
        if (G.t % 2 === 0) this.trail.push({ pose: clonePose(this.pose), x: this.x, y: this.y, facing: this.facing, life: 9 });
        G.parts.push({ type: 'dot', x: this.x + rand(-20, 20), y: GROUND - this.y - rand(20, 140) * sc, vx: -this.facing * rand(1, 3), vy: rand(-1, 1),
          life: 14, max: 14, size: rand(3, 6), col: G.t % 2 ? c.fx : c.fx2 });
      }
      if (mv.type === 'super' && this.mf <= mv.startup + 6) {
        G.parts.push({ type: 'dot', x: this.x + rand(-44, 44), y: GROUND - rand(0, 30), vx: 0, vy: rand(-6, -2), life: 18, max: 18, size: rand(3, 6), col: G.t % 2 ? c.fx : c.fx2 });
      }
    }
    for (let i = this.trail.length - 1; i >= 0; i--) if (--this.trail[i].life <= 0) this.trail.splice(i, 1);
  }

  // escolhe a pose-alvo do estado atual e interpola suavemente até ela
  updatePose(G) {
    let tp, k = 0.3;
    const mv = this.mv;
    switch (this.state) {
      case 'idle':
        tp = Object.assign({}, this.P('idle'));
        if (this.vx) {
          const s = Math.sin(this.walkPh), c = Math.cos(this.walkPh);
          tp.ha = 6 + 26 * s; tp.ka = -18 - 30 * Math.max(0, c); tp.hb = 2 - 26 * s; tp.kb = -16 - 30 * Math.max(0, -c);
          tp.lean += this.vx * this.facing > 0 ? 4 : -3; k = 0.5;
        } else {
          const b = Math.sin(G.t * 0.09 + this.idx * 2);
          tp.sa += b * 3; tp.sb += b * 3; tp.lean += b * 1.2; tp.ha += b * 1.5; tp.ka -= b * 3;
        }
        break;
      case 'crouch': tp = this.P('crouch'); k = 0.4; break;
      case 'prejump': tp = this.P('preJump'); k = 0.5; break;
      case 'air': tp = this.P(this.vy > 1 ? 'jumpUp' : 'jumpFall'); k = 0.25; break;
      case 'lag': tp = this.P('crouch'); k = 0.35; break;
      case 'attack': {
        const f = this.mf, A0 = mv.startup, A1 = A0 + mv.active;
        let hn = mv.h;
        if (mv.cyc && this.connected) hn = mv.cyc[this.hitCount % mv.cyc.length];
        if (f < A0) { tp = this.P(mv.w); k = 0.5; }
        else if (f <= A1) { tp = this.P(hn); k = 0.75; }
        else if (mv.kind === 'upper') { tp = this.P('jumpFall'); k = 0.2; }
        else { tp = (f - A1) / Math.max(1, mv.recovery) < 0.45 ? this.P(hn) : this.P(mv.crouch ? 'crouch' : 'idle'); k = 0.3; }
        break;
      }
      case 'hitstun': tp = this.P(this.hitPose); k = 0.6; break;
      case 'blockstun': tp = this.P(this.blockCrouch ? 'blockC' : 'blockS'); k = 0.6; break;
      case 'launched': tp = Object.assign({}, this.P('launch')); tp.rot = -35 - Math.min(55, this.stateT * 2.5); k = 0.4; break;
      case 'down': tp = this.P('lying'); k = 0.5; break;
      case 'getup': tp = this.stateT < 8 ? this.P('getup') : this.P('crouch'); k = 0.35; break;
      case 'win': tp = this.P('win'); k = 0.15; break;
      default: tp = this.P('idle');
    }
    blendPose(this.pose, tp, k);
  }
}

// ============================================================
//  IA
// ============================================================
const AI_LV = [
  { react: 16, block: 0.25, aggro: 0.4, combo: 0.15, aa: 0.1 },    // fácil
  { react: 9, block: 0.55, aggro: 0.6, combo: 0.55, aa: 0.45 },    // normal
  { react: 4, block: 0.85, aggro: 0.78, combo: 0.9, aa: 0.8 },     // difícil
];

class AI {
  constructor(lv) {
    this.lv = lv; this.raw = {}; this.q = []; this.cool = 30; this.hold = null;
    this.threatId = null; this.willBlock = false; this.jumpSeen = -1; this.comboSeen = -1; this.projSeen = -1;
  }
  press(keys, L) { const w = (L.react * rand(0.3, 1)) | 0; this.q.push({ wait: w, keys }); this.cool = L.react; }

  think(me, opp, G) {
    const r = this.raw;
    for (const k of ALLK) r[k] = false;
    if (G.phase !== 'fight') { this.q.length = 0; return r; }
    const L = AI_LV[this.lv];
    const dx = opp.x - me.x, dist = Math.abs(dx), tw = dx >= 0 ? 'right' : 'left', aw = dx >= 0 ? 'left' : 'right';
    const neutral = me.state === 'idle' || me.state === 'crouch' || me.state === 'blockstun';

    // --- ameaças: golpes e projéteis vindo ---
    let threat = null;
    if (opp.state === 'attack' && opp.mv && opp.mv.box && opp.mf <= opp.mv.startup + opp.mv.active + 2) {
      const mv = opp.mv;
      let reach = (mv.box[0] + mv.box[2]) * opp.ch.scale + 50;
      if (mv.kind === 'rush') reach += mv.speed * mv.active;
      if (mv.air) reach += 60;
      if (dist < reach) threat = { id: 'a' + opp.atkId, low: mv.level === 'low' };
    }
    for (const p of G.projs) {
      if (p.owner !== opp) continue;
      if (p.kind === 'bolt') { if (Math.abs(p.x - me.x) < 80 && p.delay < 16) threat = { id: 'p' + p.id }; continue; }
      const ahead = (me.x - p.x) * Math.sign(p.vx);
      if (ahead > -40 && ahead < Math.abs(p.vx) * 14 + 80) threat = { id: 'p' + p.id };
      else if (ahead > 150 && ahead < 430 && neutral && this.projSeen !== p.id) {
        this.projSeen = p.id;
        if (!p.super && Math.random() < L.aa * 0.7) {
          this.q.length = 0;
          this.q.push({ wait: Math.max(0, Math.round((ahead - 150) / (Math.abs(p.vx) + 2))), keys: ['up', tw] });
        }
      }
    }
    if (threat) {
      if (this.threatId !== threat.id) { this.threatId = threat.id; this.willBlock = Math.random() < L.block; }
      if (this.willBlock && neutral && me.y <= 0) { r[aw] = true; if (threat.low) r.down = true; this.q.length = 0; return r; }
    }

    // --- antiaéreo ---
    if (opp.state !== 'launched' && opp.y > 30 && opp.vy < 3 && dist < 190 && neutral && this.jumpSeen !== opp.jumpId) {
      this.jumpSeen = opp.jumpId;
      if (Math.random() < L.aa) { this.q.length = 0; this.q.push({ wait: (rand(0, 4)) | 0, keys: ['down', 'sp'] }); }
    }

    // --- combos ao acertar ---
    if (me.state === 'attack' && me.mv && me.mv.type === 'normal' && !me.mv.air && me.connected && this.comboSeen !== me.atkId) {
      this.comboSeen = me.atkId;
      if (Math.random() < L.combo) {
        const hitOk = opp.state === 'hitstun' || opp.state === 'launched';
        if (me.mv.str === 1) this.q.push({ wait: 1, keys: [me.mv.crouch ? 'down' : '', 'mk'] });
        else if (me.mv.str === 2) this.q.push({ wait: 1, keys: ['hp'] });
        else if (hitOk) this.q.push({ wait: 1, keys: me.meter >= 100 ? ['su'] : pick([[tw, 'sp'], ['down', 'sp'], [tw, 'sp']]) });
      }
    }

    // --- ações agendadas ---
    if (this.q.length) {
      const a = this.q[0];
      if (a.wait-- > 0) return r;
      this.q.shift();
      for (const k of a.keys) if (k) r[k] = true;
      return r;
    }
    if (!neutral || me.state === 'blockstun') return r;
    if (this.cool > 0) {
      this.cool--;
      if (this.hold) for (const k of this.hold) r[k === 'tw' ? tw : k === 'aw' ? aw : k] = true;
      return r;
    }

    // --- decisão em neutro ---
    const R = Math.random(), ag = L.aggro, range = 112 * me.ch.reach * me.ch.scale;
    this.hold = null;
    if (opp.state === 'down' || opp.state === 'getup' || opp.state === 'launched') {
      if (dist > range + 30) { this.hold = ['tw']; this.cool = 10; }
      else if (opp.state === 'getup' && R < ag * 0.6) this.press(['down', 'mk'], L);
      else { this.hold = R < 0.5 ? ['down', 'aw'] : null; this.cool = 12; }
      return r;
    }
    if (dist > 430) {
      if (R < 0.25 + ag * 0.25 && me.canDo('proj', G)) this.press(['sp'], L);
      else if (R < 0.88) { this.hold = ['tw']; this.cool = rand(14, 30) | 0; }
      else { this.q.push({ wait: 0, keys: ['up', tw] }); this.cool = 20; }
    } else if (dist > range + 25) {
      if (R < 0.16 * ag + 0.04 && dist > 250 && me.canDo('proj', G)) this.press(['sp'], L);
      else if (R < 0.3 * ag + 0.07 && dist < 360) this.press([tw, 'sp'], L);
      else if (R < 0.44 * ag + 0.1 && dist < 330) {
        this.q.push({ wait: 0, keys: ['up', tw] });
        this.q.push({ wait: 24 + (rand(0, 6) | 0), keys: [pick(['hp', 'mk'])] });
      }
      else if (R < 0.9) { this.hold = ['tw']; this.cool = rand(8, 20) | 0; }
      else { this.hold = ['aw']; this.cool = rand(10, 24) | 0; }
    } else {
      if (R < ag) {
        if (me.meter >= 100 && Math.random() < 0.12 * ag) this.press(['su'], L);
        else this.press(pick([['lp'], ['lp'], ['mk'], ['mk'], ['hp'], ['down', 'mk'], ['down', 'mk'], ['down', 'hp'], ['down', 'lp']]), L);
      }
      else if (R < ag + 0.14) { this.hold = ['aw']; this.cool = rand(10, 22) | 0; }
      else if (R < ag + 0.24) { this.hold = ['down', 'aw']; this.cool = rand(12, 26) | 0; }
      else this.cool = rand(4, 12) | 0;
    }
    return r;
  }
}
