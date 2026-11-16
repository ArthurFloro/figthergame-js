'use strict';
// ============================================================
//  Dados: poses (ângulos em graus), golpes, personagens e cenários
// ============================================================
// Convenção dos ângulos: 0 = membro apontando para baixo, 90 = para a frente, 180 = para cima.
// sa/ea = ombro/cotovelo do braço da frente, sb/eb = braço de trás,
// ha/ka = quadril/joelho da perna da frente, hb/kb = perna de trás.
function P(lean, head, sa, ea, sb, eb, ha, ka, hb, kb, ex) {
  const p = { lean, head, sa, ea, sb, eb, ha, ka, hb, kb, rot: 0, oy: 0, wa: 0 };
  if (ex) Object.assign(p, ex);
  return p;
}
const PKEYS = ['lean', 'head', 'sa', 'ea', 'sb', 'eb', 'ha', 'ka', 'hb', 'kb', 'rot', 'oy', 'wa'];
function clonePose(p) { const o = {}; for (const k of PKEYS) o[k] = p[k]; return o; }
function blendPose(cur, tgt, k) { for (const key of PKEYS) cur[key] += (tgt[key] - cur[key]) * k; }

const POSES = {
  idle:     P(6, 0,     50, 85,    22, 95,    28, -44,  -18, -14),
  crouch:   P(16, -4,   55, 90,    30, 95,    70, -118,  22, -104),
  preJump:  P(14, 0,    20, 40,   -10, 40,    60, -100,  14, -84),
  jumpUp:   P(2, -6,    40, 70,   -30, 50,    58, -96,    6, -50),
  jumpFall: P(-4, 6,   104, 26,   -80, -20,   30, -40,   -6, -24),
  blockS:   P(-6, 6,    72, 100,   60, 105,   26, -40,  -18, -14),
  blockC:   P(8, 4,     72, 100,   60, 105,   70, -118,  22, -104),
  hitHi:    P(-24, -22, -35, 45,  -55, 35,    32, -24,   -8, -30),
  hitLo:    P(30, 22,   45, 60,    30, 70,    22, -44,  -14, -30),
  hitC:     P(28, 12,   40, 70,    30, 80,    70, -118,  22, -104),
  launch:   P(-28, -24, -110, -25, -140, -15, 46, -46,   10, -36),
  lying:    P(0, -6,   -25, 10,    15, -10,    8, -8,    -6, -10, { rot: -90, oy: -6 }),
  getup:    P(34, 10,   30, 40,    10, 60,    74, -124,  26, -108),
  win:      P(-6, -8,  172, 6,     25, 95,    14, -16,  -12, -8),
  // --- golpes: _w = preparação, _h = impacto ---
  sLP_w:    P(8, 0,     30, 115,   22, 95,    28, -44,  -18, -14),
  sLP_h:    P(14, 0,    88, 2,     10, 112,   30, -44,  -20, -12),
  sMK_w:    P(-6, 0,    55, 85,    25, 95,    84, -104, -14, -6),
  sMK_h:    P(-20, 0,   40, 95,   -20, 70,    86, -4,   -14, -6),
  sHP_w:    P(-4, 0,    40, 100,  -70, 125,   24, -40,  -22, -12),
  sHP_h:    P(26, 4,   -35, 95,    96, 2,     38, -40,  -30, -2),
  cLP_w:    P(16, -4,   30, 110,   30, 95,    70, -118,  22, -104),
  cLP_h:    P(18, -4,   86, 2,     30, 95,    70, -118,  22, -104),
  cMK_w:    P(-4, -4,   55, 90,   -30, 40,    60, -110,  26, -112),
  cMK_h:    P(-20, -4,  55, 90,   -60, 10,    74, 8,     30, -125),
  cHP_w:    P(-18, -4,  40, 80,   -80, 10,    56, -104,  34, -128),
  cHP_h:    P(-40, -6,  30, 70,   -95, 0,     80, 6,     40, -140),
  jLP_h:    P(18, 5,    62, 2,    -30, 80,    58, -96,   10, -60),
  jMK_h:    P(-10, 0,   40, 80,   -40, 60,    62, -4,    25, -115),
  jHP_h:    P(24, 6,    58, 4,     50, 8,     50, -90,    6, -50),
  proj_w:   P(-10, -4, -45, 60,   -65, 55,    28, -40,  -22, -12),
  proj_h:   P(22, 2,    92, 0,     84, 6,     38, -40,  -30, -2),
  upper_w:  P(22, 0,    15, 35,   -20, 60,    70, -118,  22, -104),
  upper_h:  P(-8, -14, 174, 4,    -30, 70,    42, -76,   -8, -12),
  rush_w:   P(14, 0,    10, 100,  -50, 110,   40, -62,  -20, -22),
  rush_h:   P(38, 6,   -30, 90,    97, 0,     52, -62,  -46, -4),
  super_w:  P(-10, -12, 24, 104,  -24, 112,   34, -44,  -30, -6),
};

// Golpes normais (quadros a 60 fps). box = [x à frente, altura da base, largura, altura]
const NORMALS = {
  sLP: { startup: 4, active: 3, recovery: 7,  dmg: 32, hitstun: 15, blockstun: 10, push: 5,  hitstop: 6,  level: 'mid',      box: [18, 104, 66, 24], str: 1 },
  sMK: { startup: 6, active: 4, recovery: 12, dmg: 62, hitstun: 19, blockstun: 13, push: 7,  hitstop: 8,  level: 'mid',      box: [18, 72, 88, 28],  str: 2 },
  sHP: { startup: 9, active: 4, recovery: 19, dmg: 98, hitstun: 23, blockstun: 17, push: 10, hitstop: 11, level: 'mid',      box: [18, 92, 94, 40],  str: 3, step: 2.2, arc: true },
  cLP: { startup: 4, active: 3, recovery: 7,  dmg: 28, hitstun: 14, blockstun: 10, push: 5,  hitstop: 6,  level: 'mid',      box: [18, 52, 64, 22],  str: 1, crouch: true },
  cMK: { startup: 6, active: 4, recovery: 12, dmg: 56, hitstun: 18, blockstun: 13, push: 7,  hitstop: 8,  level: 'low',      box: [18, 4, 92, 26],   str: 2, crouch: true },
  cHP: { startup: 8, active: 5, recovery: 22, dmg: 84, hitstun: 20, blockstun: 17, push: 8,  hitstop: 11, level: 'low',      box: [18, 0, 104, 28],  str: 3, crouch: true, launch: [2.6, 7.5], arc: true },
  jLP: { startup: 4, active: 12, recovery: 0, dmg: 42, hitstun: 15, blockstun: 11, push: 5,  hitstop: 6,  level: 'overhead', box: [4, 24, 58, 50],   str: 1, air: true },
  jMK: { startup: 5, active: 12, recovery: 0, dmg: 62, hitstun: 19, blockstun: 13, push: 6,  hitstop: 8,  level: 'overhead', box: [0, -6, 78, 50],   str: 2, air: true },
  jHP: { startup: 7, active: 8,  recovery: 0, dmg: 88, hitstun: 22, blockstun: 16, push: 7,  hitstop: 10, level: 'overhead', box: [6, 6, 74, 64],    str: 3, air: true, arc: true },
};

const BUILD = { legU: 38, legL: 40, torso: 50, head: 16, armU: 25, armL: 25, legW: 13, armW: 10, shW: 32, hipW: 26 };

function mkPal(c) {
  const o = Object.assign({ hat: '#222', coat: '#333', metal: '#7c8594', mask: '#222' }, c);
  o.skinB = shade(o.skin, -0.28); o.shirtB = shade(o.shirt, -0.3); o.pantsB = shade(o.pants, -0.3); o.bootB = shade(o.boot, -0.3);
  return o;
}

const CHARS = [
  {
    id: 'caio', name: 'CAIO MARÉ', title: 'O Punho das Ondas', look: 'bandana',
    hp: 1000, walk: 3.5, back: 2.7, jumpV: 13.6, jumpX: 4.3, scale: 1.12, dmg: 1.05, reach: 1, startup: 0,
    stats: { 'FORÇA': 3, 'VELOCIDADE': 3, 'ALCANCE': 3, 'VIDA': 3 },
    build: BUILD,
    col: mkPal({ skin: '#e9b98f', shirt: '#f2ede2', pants: '#27477a', sash: '#e8b923', boot: '#4a2f1d', hair: '#2b1a12', acc: '#1f8fe0', fx: '#4fd0ff', fx2: '#e2f9ff' }),
    alt: mkPal({ skin: '#e9b98f', shirt: '#34343f', pants: '#7a2733', sash: '#f2ede2', boot: '#22171a', hair: '#2b1a12', acc: '#e0531f', fx: '#4fd0ff', fx2: '#e2f9ff' }),
    poses: {},
    sp: {
      proj: { name: 'Onda Cortante', p: { kind: 'wave', speed: 8, dmg: 70, w: 46, h: 46, y: 74 } },
      upper: { name: 'Maré Alta' },
      rush: { name: 'Correnteza', speed: 10.5, dmg: 105 },
      super: { name: 'TSUNAMI REAL', kind: 'proj', startup: 14, active: 2, recovery: 34,
        p: { kind: 'tsunami', speed: 10, dmg: 62, w: 110, h: 170, y: 0, hits: 5, rehit: 5, push: 12, hitstop: 6, launch: [7, 9.5] } },
    },
  },
  {
    id: 'rubra', name: 'RUBRA', title: 'A Lâmina Escarlate', look: 'tricorn', weapon: 'sword', coat: true,
    hp: 950, walk: 3.7, back: 2.9, jumpV: 13.8, jumpX: 4.5, scale: 1.1, dmg: 1, reach: 1.22, startup: 0,
    stats: { 'FORÇA': 3, 'VELOCIDADE': 4, 'ALCANCE': 5, 'VIDA': 2 },
    build: Object.assign({}, BUILD, { shW: 30, hipW: 24, legW: 12, armW: 9 }),
    col: mkPal({ skin: '#f0c4a0', shirt: '#a81f2d', pants: '#2a2230', sash: '#e8b923', boot: '#1d1418', hair: '#e2571f', acc: '#e8b923', hat: '#3a1620', coat: '#7d1622', fx: '#ff7a3a', fx2: '#ffe2a8' }),
    alt: mkPal({ skin: '#f0c4a0', shirt: '#1f5fa8', pants: '#22262e', sash: '#d8d2c2', boot: '#14181d', hair: '#f2e2b0', acc: '#d8d2c2', hat: '#16203a', coat: '#16447d', fx: '#ff7a3a', fx2: '#ffe2a8' }),
    poses: {
      idle:   P(6, 0,    48, 62,   20, 100,  28, -44, -18, -14, { wa: 15 }),
      sLP_w:  P(8, 0,    20, 100,  20, 100,  28, -44, -18, -14, { wa: -20 }),
      sLP_h:  P(16, 0,   86, 4,   -10, 100,  30, -44, -20, -12),
      sHP_w:  P(-8, -4, 150, 30,   20, 95,   24, -40, -22, -12, { wa: 10 }),
      sHP_h:  P(26, 4,   70, 0,   -30, 90,   38, -40, -30, -2,  { wa: 15 }),
      cLP_h:  P(18, -4,  84, 2,    30, 95,   70, -118, 22, -104, { wa: 4 }),
      rush_w: P(14, 0,  -20, 60,   20, 90,   40, -62, -20, -22, { wa: 60 }),
      rush_h: P(38, 6,   92, 0,   -40, 70,   52, -62, -46, -4),
      proj_w: P(-10, -4, 160, 20, -30, 60,   28, -40, -22, -12),
      proj_h: P(22, 2,   60, 10,  -40, 60,   38, -40, -30, -2,  { wa: 20 }),
    },
    sp: {
      proj: { name: 'Lâmina Rubra', startup: 11, p: { kind: 'slash', speed: 11, dmg: 58, w: 40, h: 64, y: 62 } },
      upper: { name: 'Corte Ascendente', vx: 3.4, dmg: 112, box: [0, 50, 84, 125] },
      rush: { name: 'Investida Escarlate', speed: 13.5, active: 12, dmg: 96, box: [8, 60, 104, 50] },
      super: { name: 'DANÇA DAS BRASAS', kind: 'rush', startup: 8, active: 48, recovery: 26, speed: 14, dash: 16, stopOnHit: true,
        hits: 7, rehit: 5, dmg: 42, finalDmg: 112, hitstun: 22, blockstun: 16, push: 1, hitstop: 5, level: 'mid',
        box: [8, 40, 112, 90], launch: [7, 11], w: 'rush_w', h: 'rush_h', cyc: ['sHP_h', 'rush_h', 'sLP_h', 'upper_h'], arc: true },
    },
  },
  {
    id: 'barao', name: 'BARÃO TROVÃO', title: 'O Canhão da Tempestade', look: 'captain', weapon: 'cannon', coat: true,
    hp: 1060, walk: 2.7, back: 2.1, jumpV: 13.0, jumpX: 3.7, scale: 1.26, dmg: 1, reach: 0.92, startup: 3,
    stats: { 'FORÇA': 5, 'VELOCIDADE': 1, 'ALCANCE': 3, 'VIDA': 4 },
    build: Object.assign({}, BUILD, { legW: 17, armW: 14, shW: 44, hipW: 36, torso: 53, head: 17 }),
    col: mkPal({ skin: '#c98f66', shirt: '#3d2a5c', pants: '#22202c', sash: '#b3202a', boot: '#16131c', hair: '#1c1620', acc: '#e8b923', hat: '#17141f', coat: '#2c1e45', metal: '#7c8594', fx: '#ffe14a', fx2: '#fffbd6' }),
    alt: mkPal({ skin: '#c98f66', shirt: '#5c2a2a', pants: '#2c2420', sash: '#e8b923', boot: '#1c1613', hair: '#d8d2c2', acc: '#d8d2c2', hat: '#2a1414', coat: '#451e1e', metal: '#a08a5c', fx: '#ffe14a', fx2: '#fffbd6' }),
    poses: {
      sHP_w:  P(-10, -4, 160, 25,  20, 95,   24, -40, -22, -12),
      sHP_h:  P(28, 6,   72, 0,   -30, 90,   38, -40, -30, -2),
      proj_w: P(-4, 0,   60, 60,   20, 95,   28, -44, -18, -14),
      proj_h: P(-10, 0,  90, 0,    60, 60,   32, -44, -24, -10),
    },
    sp: {
      proj: { name: 'Bala Trovejante', startup: 16, recovery: 28, p: { kind: 'ball', speed: 5.6, dmg: 100, w: 44, h: 44, y: 76, launch: [5, 7], hitstop: 12 } },
      upper: { name: 'Âncora Celeste', startup: 7, dmg: 138, vy: 11.5, invuln: 13, box: [0, 50, 80, 130] },
      rush: { name: 'Carga do Barão', startup: 13, speed: 8.5, active: 15, recovery: 27, dmg: 105, armor: true, box: [8, 40, 84, 100] },
      super: { name: 'IRA DA TEMPESTADE', kind: 'storm', startup: 16, active: 2, recovery: 50, bolts: 3, h: 'upper_h',
        p: { kind: 'bolt', dmg: 115, w: 84, h: GROUND, y: 0, hits: 1, hitstun: 24, blockstun: 20, push: 4, hitstop: 12, launch: [3, 10] } },
    },
  },
  {
    id: 'brisa', name: 'BRISA', title: 'A Sombra dos Ventos', look: 'hood', weapon: 'daggers',
    hp: 940, walk: 4.3, back: 3.4, jumpV: 14.2, jumpX: 5.0, scale: 1.04, dmg: 1, reach: 0.96, startup: -1,
    stats: { 'FORÇA': 3, 'VELOCIDADE': 5, 'ALCANCE': 2, 'VIDA': 2 },
    build: Object.assign({}, BUILD, { legW: 11, armW: 8, shW: 28, hipW: 22 }),
    col: mkPal({ skin: '#d9a47c', shirt: '#1f6b52', pants: '#1d2a2a', sash: '#d8d2c2', boot: '#2a2018', hair: '#f4f1e8', acc: '#2c8a68', mask: '#16332b', fx: '#7dffb4', fx2: '#eafff2' }),
    alt: mkPal({ skin: '#d9a47c', shirt: '#5a2a7a', pants: '#231d2c', sash: '#e8b923', boot: '#1c1622', hair: '#f4f1e8', acc: '#7a3aa8', mask: '#2a1638', fx: '#7dffb4', fx2: '#eafff2' }),
    poses: {
      upper_h: P(-10, 0, 100, 10, -100, -10, 88, -4, -30, -40),
    },
    sp: {
      proj: { name: 'Adaga de Vento', startup: 9, recovery: 20, p: { kind: 'dagger', speed: 13, dmg: 44, w: 42, h: 22, y: 94, hitstun: 16, blockstun: 11 } },
      upper: { name: 'Ciclone', hits: 3, rehit: 4, dmg: 44, vy: 12, vx: 2.8, box: [-34, 40, 104, 120], launch: [3, 11], arc: true },
      rush: { name: 'Passo Fantasma', teleport: true, startup: 14, active: 6, recovery: 16, speed: 3, dmg: 88, box: [8, 50, 90, 70] },
      super: { name: 'OLHO DO FURACÃO', kind: 'proj', startup: 14, active: 2, recovery: 30,
        p: { kind: 'tornado', speed: 3.6, dmg: 40, w: 90, h: 220, y: 0, hits: 8, rehit: 7, push: 0, hitstop: 5, suck: true, launch: [4, 12], life: 160 } },
    },
  },
];

function buildMoves(ch) {
  const m = {}, R = ch.reach, S = ch.startup;
  for (const id in NORMALS) {
    const n = NORMALS[id];
    m[id] = Object.assign({ id, type: 'normal', w: n.air ? id + '_h' : id + '_w', h: id + '_h' }, n, {
      startup: Math.max(3, n.startup + (n.str > 1 ? S : 0)),
      box: [n.box[0], n.box[1], n.box[2] * R, n.box[3]],
      arc: n.arc || (ch.weapon === 'sword' && id.endsWith('P')),
    });
  }
  const sp = ch.sp;
  m.proj = Object.assign({ id: 'proj', type: 'special', kind: 'proj', str: 2, startup: 12, active: 2, recovery: 24, w: 'proj_w', h: 'proj_h' }, sp.proj);
  m.upper = Object.assign({ id: 'upper', type: 'special', kind: 'upper', str: 3, startup: 4, active: 14, recovery: 12, invuln: 10, vy: 12.5, vx: 2.4,
    dmg: 120, hitstun: 20, blockstun: 20, push: 6, hitstop: 12, level: 'mid', box: [0, 50, 66, 120], launch: [3.2, 12.5], w: 'upper_w', h: 'upper_h', arc: true }, sp.upper);
  m.rush = Object.assign({ id: 'rush', type: 'special', kind: 'rush', str: 3, startup: 9, active: 13, recovery: 19, speed: 10,
    dmg: 100, hitstun: 20, blockstun: 18, push: 9, hitstop: 12, level: 'mid', box: [8, 50, 82, 70], launch: [6.5, 6.5], w: 'rush_w', h: 'rush_h', arc: true }, sp.rush);
  m.super = Object.assign({ id: 'super', type: 'super', str: 3, w: 'super_w', h: 'proj_h' }, sp.super);
  return m;
}
for (const ch of CHARS) ch.moves = buildMoves(ch);

const STAGES = [
  { name: 'Convés do Albatroz', night: false,
    sky: ['#2b1b4d', '#8a3566', '#ff8f4a', '#ffd98a'], sea: ['#c9703f', '#3a4f86', '#1b2f5c'], cloud: 'rgba(255,190,150,.55)',
    lights: [[330, 300], [1150, 300]] },
  { name: 'Porto da Meia-Noite', night: true,
    sky: ['#04071a', '#0b1838', '#1a2f5e', '#34507f'], sea: ['#27467a', '#0d2248', '#061226'], cloud: 'rgba(60,80,130,.35)',
    lights: [[260, 262], [740, 262], [1220, 262]] },
];
