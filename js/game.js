// =====================================================
//  LAST EMBER — main game (simulation, AI, rendering, UI)
// =====================================================
'use strict';
(() => {
const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rr = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const D = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const r1 = (v) => Math.round(v * 10) / 10;
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const MAT = Object.fromEntries(CONFIG.MATERIALS.map((m) => [m.id, m]));
const P = CONFIG.PLAYER;
const MC = () => CONFIG.MODES[S.mode];

// ---------------- canvas ----------------
const cv = $('game'), ctx = cv.getContext('2d');
const lc = document.createElement('canvas'), lctx = lc.getContext('2d');
let W = 0, H = 0, DPR = 1, Z = 1;
const isTouch = ('ontouchstart' in window) || matchMedia('(pointer:coarse)').matches;
if (isTouch) document.body.classList.add('touch');
function resize() {
  W = innerWidth; H = innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  lc.width = Math.ceil(cv.width / 2); lc.height = Math.ceil(cv.height / 2);
  Z = clamp(Math.min(W, H) / (isTouch ? 600 : 760), 0.62, 1.4);
}
addEventListener('resize', resize); resize();

// ---------------- assets ----------------
const IMG = {};
for (const [k, src] of Object.entries(CONFIG.IMAGES)) {
  if (!src) continue;
  const im = new Image(); im.onload = () => (IMG[k] = im); im.src = src;
}
function makeCanopy(seed) {
  const R = mulberry32(seed), c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d');
  for (let k = 0; k < 10; k++) {
    const x = 80 + (R() - 0.5) * 60, y = 80 + (R() - 0.5) * 60, r = 28 + R() * 26;
    const gr = g.createRadialGradient(x - 6, y - 6, 2, x, y, r);
    gr.addColorStop(0, k % 3 ? '#122014' : '#18281a'); gr.addColorStop(0.7, '#0a130b'); gr.addColorStop(1, 'rgba(4,8,5,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  return c;
}
const CANOPY = [1, 2, 3, 4].map(makeCanopy);
const GROUND = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); const R = mulberry32(7);
  const wrap = (x, y, fn) => { for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) fn(x + dx, y + dy); }; // seamless tile
  g.fillStyle = '#0a0e0f'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 320; i++) { const x = R() * 512, y = R() * 512, r = 3 + R() * 12;
    g.fillStyle = `rgba(${14 + R() * 16},${20 + R() * 16},${18 + R() * 12},${0.15 + R() * 0.2})`;
    wrap(x, y, (a, b) => { g.beginPath(); g.arc(a, b, r, 0, TAU); g.fill(); }); }
  g.strokeStyle = 'rgba(32,48,34,.4)'; g.lineWidth = 1.2;
  for (let i = 0; i < 800; i++) { const x = R() * 512, y = R() * 512, ex = (R() - 0.5) * 5, ey = -4 - R() * 5;
    wrap(x, y, (a, b) => { g.beginPath(); g.moveTo(a, b); g.lineTo(a + ex, b + ey); g.stroke(); }); }
  for (let i = 0; i < 160; i++) { const x = R() * 512, y = R() * 512, rot = R() * TAU, col = `rgba(${60 + R() * 40},${35 + R() * 20},15,.35)`;
    wrap(x, y, (a, b) => { g.fillStyle = col; g.save(); g.translate(a, b); g.rotate(rot); g.fillRect(-3, -1.5, 6, 3); g.restore(); }); }
  return ctx.createPattern(c, 'repeat');
})();

// ---------------- world ----------------
const WD = CONFIG.WORLD, C = { x: WD / 2, y: WD / 2 }, CAR = { x: WD / 2 + 130, y: WD / 2 + 40 };
let trees = []; const grid = new Map(); const CELL = 128;
const SOLIDS = [{ x: C.x, y: C.y, r: 26 }, { x: CAR.x - 28, y: CAR.y, r: 28 }, { x: CAR.x + 28, y: CAR.y, r: 28 }];
const gkey = (cx, cy) => cx * 4096 + cy;
function addTree(t) { const k = gkey(Math.floor(t.x / CELL), Math.floor(t.y / CELL)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t); trees.push(t); }
function eachTree(x, y, rad, cb) {
  const x0 = Math.floor((x - rad) / CELL), x1 = Math.floor((x + rad) / CELL), y0 = Math.floor((y - rad) / CELL), y1 = Math.floor((y + rad) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const a = grid.get(gkey(cx, cy)); if (a) for (const t of a) if (cb(t) === true) return true; }
  return false;
}
const nearTree = (x, y, rad) => eachTree(x, y, rad + 30, (t) => D(x, y, t.x, t.y) < rad + t.r);
function genWorld(seed) {
  const R = mulberry32(seed); trees = []; grid.clear();
  let n = 0, guard = 0;
  while (n < CONFIG.TREE_COUNT && guard++ < 30000) {
    const x = 80 + R() * (WD - 160), y = 80 + R() * (WD - 160);
    if (D(x, y, C.x, C.y) < 420) continue;
    const r = 9 + R() * 12;
    if (nearTree(x, y, r + 40)) continue;
    addTree({ x, y, r, cr: r * 2.4 + 22 + R() * 22, v: Math.floor(R() * 4), rot: R() * TAU }); n++;
  }
  for (let i = 0; i <= WD; i += 64) for (const [x, y] of [[i, 18], [i, WD - 18], [18, i], [WD - 18, i]])
    addTree({ x: x + (R() - 0.5) * 20, y: y + (R() - 0.5) * 20, r: 22, cr: 70, v: Math.floor(R() * 4), rot: R() * TAU });
}
function collide(e, r) {
  eachTree(e.x, e.y, r + 30, (t) => {
    const dx = e.x - t.x, dy = e.y - t.y, d = Math.hypot(dx, dy), m = r + t.r;
    if (d < m && d > 0.01) { e.x = t.x + (dx / d) * m; e.y = t.y + (dy / d) * m; }
  });
  for (const t of SOLIDS) { const dx = e.x - t.x, dy = e.y - t.y, d = Math.hypot(dx, dy), m = r + t.r;
    if (d < m && d > 0.01) { e.x = t.x + (dx / d) * m; e.y = t.y + (dy / d) * m; } }
  e.x = clamp(e.x, 50, WD - 50); e.y = clamp(e.y, 50, WD - 50);
}
function freeSpot(minD, maxD, ang) {
  for (let i = 0; i < 200; i++) {
    const a = ang != null ? ang + rr(-0.35, 0.35) : rr(0, TAU), d = rr(minD, maxD);
    const x = clamp(C.x + Math.cos(a) * d, 120, WD - 120), y = clamp(C.y + Math.sin(a) * d, 120, WD - 120);
    if (!nearTree(x, y, 26)) return { x, y };
  }
  return { x: C.x + 300, y: C.y };
}

// ---------------- state ----------------
const S = {
  phase: 'menu', mode: 'normal', myId: 'host', isHost: true,
  players: {}, order: [], monsters: [], items: [], itemsVer: 0, sentVer: -1, lastItemsSend: 0,
  fuel: 100, fireOut: false, fireOutT: 0, collected: [], required: [], time: 0,
  heat: new Array(8).fill(0), heatT: 0, nextEvent: 30, woodT: 0, spawnT: 0, mid: 0, iid: 0, warnT: 0, ended: false,
  chatGlitch: 0, blackout: 0, flicker: 0, shake: 0, spectate: null, cam: { x: WD / 2, y: WD / 2 }, snapT: 0, inT: 0,
  sel: 0, embers: [], stepT: 0, deaths: [],
};
let lobby = [];
const isHost = () => Net.role !== 'client';
const fireFrac = () => clamp(S.fuel / MC().fuelMax, 0, 1);
function fireRadius() { if (S.fireOut) return 0; const F = CONFIG.FIRE; return F.minRadius + (F.maxRadius - F.minRadius) * fireFrac(); }
const progress = () => S.collected.length / MC().materialsNeeded;
const me = () => S.players[S.myId];
const alivePlayers = () => S.order.map((id) => S.players[id]).filter((p) => p && p.state === 'alive');
const hasLit = (p) => p.inv.some((it) => it && it.k === 'w' && it.lit);
const inLight = (p, pad = 0) => !S.fireOut && dist(p, C) < fireRadius() + pad;

function mkPlayer(id, name, idx) {
  const a = (idx / 4) * TAU + 0.6;
  return { id, name, color: CONFIG.PLAYER_COLORS[idx % 4], x: C.x + Math.cos(a) * 70, y: C.y + Math.sin(a) * 70, rx: 0, ry: 0, vx: 0, vy: 0,
    lx: 0, ly: 0, state: 'alive', downT: 0, revive: 0, inv: [null, null], sprint: false, moving: false, use: false, stamina: P.staminaMax, face: 0 };
}

// ================= MENU / LOBBY UI =================
document.querySelectorAll('.ver').forEach((e) => (e.textContent = CONFIG.VERSION));
const screens = ['menu', 'lobby', 'ending', 'pauseMenu'];
function show(id) { screens.forEach((s) => $(s).classList.toggle('show', s === id)); }
function menuMsg(t) { $('menuMsg').textContent = t || ''; }
try { $('nameInput').value = localStorage.getItem('le_name') || ''; } catch (e) {}
const myName = () => ($('nameInput').value.trim() || 'Survivor').slice(0, 12);
function saveName() { try { localStorage.setItem('le_name', myName()); } catch (e) {} }
document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.mode-btn').forEach((x) => x.classList.toggle('sel', x === b)); S.mode = b.dataset.mode;
}));
$('btnMute').addEventListener('click', () => { SFX.init(); const m = SFX.toggleMute(); $('btnMute').textContent = m ? '🔇 Sound off' : '🔊 Sound on'; });

$('btnSolo').addEventListener('click', () => {
  SFX.init(); saveName(); Net.close(); Net.role = 'solo'; S.myId = 'host';
  lobby = [{ id: 'host', name: myName() }]; hostStartGame();
});
$('btnHost').addEventListener('click', () => {
  SFX.init(); saveName();
  if (!Net.available()) return menuMsg('Online needs internet (PeerJS failed to load). Solo still works.');
  Net.close(); menuMsg('Opening camp...'); S.myId = 'host'; lobby = [{ id: 'host', name: myName() }];
  Net.host({
    onReady(code) { menuMsg(''); $('roomCode').textContent = code; renderLobby(); show('lobby'); },
    onJoin() {},
    onMsg: hostRecv,
    onLeave(id) { hostPlayerLeft(id); },
    onError(e) { menuMsg('Network error: ' + e); if (S.phase === 'menu') show('menu'); },
  });
});
$('btnJoin').addEventListener('click', () => {
  SFX.init(); saveName();
  const code = $('codeInput').value.trim().toUpperCase();
  if (code.length < 4) return menuMsg('Enter the 5-letter room code.');
  if (!Net.available()) return menuMsg('Online needs internet (PeerJS failed to load).');
  Net.close(); menuMsg('Searching the woods for camp ' + code + '...');
  Net.join(code, {
    onOpen() { S.myId = Net.peer.id; Net.send({ t: 'hello', name: myName() }); $('roomCode').textContent = code; menuMsg(''); },
    onMsg: clientRecv,
    onClose() { if (S.phase !== 'menu' && !S.ended) backToMenu('The host left. The fire went out.'); },
    onError(e) { menuMsg(String(e)); },
  });
});
$('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
$('btnCopy').addEventListener('click', () => { try { navigator.clipboard.writeText($('roomCode').textContent).then(() => ($('btnCopy').textContent = 'Copied!')); } catch (e) {} });
$('btnLeave').addEventListener('click', () => backToMenu());
$('btnStart').addEventListener('click', () => { if (Net.role === 'host') hostStartGame(); });
$('btnEndMenu').addEventListener('click', () => backToMenu());
$('btnMenuIG').addEventListener('click', () => show('pauseMenu'));
$('btnResume').addEventListener('click', () => show(null));
$('btnQuit').addEventListener('click', () => backToMenu());

function renderLobby() {
  $('lobbyMode').textContent = CONFIG.MODES[S.mode].label;
  $('lobbyList').innerHTML = lobby.map((p, i) => `<li style="border-color:${CONFIG.PLAYER_COLORS[i]}">${esc(p.name)}${p.id === 'host' ? ' <small>(host)</small>' : ''}${p.id === S.myId ? ' <small>— you</small>' : ''}</li>`).join('')
    + Array.from({ length: 4 - lobby.length }, () => '<li style="border-color:#222;opacity:.35">· · · empty · · ·</li>').join('');
  const host = Net.role === 'host';
  $('btnStart').style.display = host ? '' : 'none';
  $('lobbyMsg').textContent = host ? (lobby.length < 2 ? 'Waiting for friends... (you can also start alone)' : '') : 'Waiting for the host to light the fire...';
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function backToMenu(msg) {
  Net.close(); S.phase = 'menu'; S.ended = false;
  $('hud').classList.add('hidden'); cv.classList.remove('spectate'); $('danger').style.opacity = 0; SFX.setDanger(0); SFX.setFire(0);
  show('menu'); menuMsg(msg || '');
}

// ================= NETWORK MESSAGES =================
function broadcastAll(m) { if (Net.role === 'host') Net.broadcast(m); handleMsg(m); }
function deliver(m, to) { if (to === S.myId) handleMsg(m); else if (Net.role === 'host') Net.sendTo(to, m); }

function hostRecv(id, m) {
  if (m.t === 'hello') {
    if (S.phase === 'game') { Net.sendTo(id, { t: 'started' }); return; }
    if (lobby.length >= 4) { Net.sendTo(id, { t: 'full' }); return; }
    lobby.push({ id, name: String(m.name || 'Survivor').slice(0, 12) });
    Net.broadcast({ t: 'lobby', list: lobby, mode: S.mode }); renderLobby(); return;
  }
  const p = S.players[id]; if (!p || S.phase !== 'game') return;
  if (m.t === 'in') {
    if (p.state === 'alive') { p.x = clamp(+m.x || p.x, 0, WD); p.y = clamp(+m.y || p.y, 0, WD); }
    p.sprint = !!m.s; p.moving = !!m.m; p.use = !!m.u; if (typeof m.f === 'number') p.face = m.f;
  } else if (m.t === 'act') hostAct(id, m.a, m.s | 0);
  else if (m.t === 'chat') hostChat(id, m.text);
}
function hostPlayerLeft(id) {
  if (S.phase !== 'game') { lobby = lobby.filter((p) => p.id !== id); Net.broadcast({ t: 'lobby', list: lobby, mode: S.mode }); renderLobby(); return; }
  const p = S.players[id]; if (!p || p.state === 'dead') return;
  dropAll(p); p.state = 'dead'; p.left = true; sys(`${p.name} lost connection...`);
}
function clientRecv(m) {
  if (m.t === 'lobby') { lobby = m.list; S.mode = m.mode; renderLobby(); show('lobby'); }
  else if (m.t === 'full') backToMenu('That camp is full (4/4).');
  else if (m.t === 'started') backToMenu('That game already started.');
  else if (m.t === 'start') clientStartGame(m);
  else if (m.t === 's') applySnap(m);
  else handleMsg(m);
}
function handleMsg(m) {
  if (m.t === 'chat') addChat(m);
  else if (m.t === 'fx') doFx(m);
  else if (m.t === 'end') showEnding(m);
}

// ================= GAME START =================
function resetState() {
  Object.assign(S, { players: {}, order: [], monsters: [], items: [], itemsVer: 0, sentVer: -1, fuel: MC().fuelMax, fireOut: false, fireOutT: 0,
    collected: [], time: 0, heat: new Array(8).fill(0), heatT: 0, nextEvent: rr(...MC().eventEvery), woodT: 0, spawnT: 0, warnT: 0, ended: false,
    chatGlitch: 0, blackout: 0, flicker: 0, shake: 0, spectate: null, sel: 0, embers: [], deaths: [],
    awake: S.mode === 'hard', bubbles: {}, seenTypes: {} });
  lobby.forEach((l, i) => { S.players[l.id] = mkPlayer(l.id, l.name, i); S.order.push(l.id); });
  for (const p of Object.values(S.players)) { p.rx = p.x; p.ry = p.y; p.lx = p.x; p.ly = p.y; }
  $('chatLog').innerHTML = '';
}
function hostStartGame() {
  const seed = (Math.random() * 1e9) | 0, M = MC();
  const ids = CONFIG.MATERIALS.map((m) => m.id).sort(() => Math.random() - 0.5).slice(0, M.materialsNeeded);
  S.required = ids; resetState(); genWorld(seed);
  const n = ids.length, off = rr(0, TAU);
  ids.forEach((id, i) => { const s = freeSpot(650, 1580, off + (i / n) * TAU); S.items.push({ id: ++S.iid, k: 'm', m: id, x: s.x, y: s.y }); });
  const wood0 = M.woodInitial || M.woodTarget[0];
  for (let i = 0; i < wood0; i++) spawnWood(i < 3 ? 330 : 380, i < 3 ? 520 : 1500);
  const nm = monsterTarget(); for (let i = 0; i < nm; i++) spawnMonster();
  if (Net.role === 'host') Net.broadcast({ t: 'start', seed, mode: S.mode, list: lobby, required: ids });
  enterGame();
  sys(`Find ${n} car parts. Keep the fire alive. Stay together.`);
  if (!S.awake) sys('The forest is quiet... for now. Something sleeps until you take what belongs to it.');
}
function clientStartGame(m) {
  S.mode = m.mode; lobby = m.list; S.required = m.required; resetState(); genWorld(m.seed); enterGame();
}
function enterGame() {
  S.phase = 'game'; show(null); $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  $('modeTag').textContent = MC().label.toUpperCase();
  const mp = me(); if (mp) { S.cam.x = mp.x; S.cam.y = mp.y; }
  hudCache = {};
}

// ================= HOST SIMULATION =================
function spawnWood(minD = 300, maxD = 1550) { const s = freeSpot(minD, maxD); S.items.push({ id: ++S.iid, k: 'w', b: 1, x: s.x, y: s.y }); S.itemsVer++; }
function monsterTarget() { const M = MC(); if (!S.awake) return 0; return Math.round(lerp(M.monsters[0], M.monsters[1], progress()) + (S.order.length - 1) * 0.5); }
function spawnMonster() {
  let s = null;
  for (let i = 0; i < 40; i++) { const c = freeSpot(1150, 1650); if (alivePlayers().every((p) => dist(p, c) > 700)) { s = c; break; } s = c; }
  const type = pickType();
  const m = { id: ++S.mid, type, col: pick(S.order.map((id) => S.players[id].color)), mt: rr(10, 20), frozen: false, x: s.x, y: s.y, rx: s.x, ry: s.y, vx: 0, vy: 0, ang: 0, state: 'roam', tx: s.x, ty: s.y, idle: 0, target: null,
    role: 'chase', bidx: 0, lost: 0, searchT: 0, atkT: 0, retreatT: 0, lsx: s.x, lsy: s.y, scd: 0 };
  pickRoam(m); S.monsters.push(m);
}
function pickType() {
  const shift = S.mode === 'hard' ? 1 : 0, n = S.collected.length, have = {};
  for (const m of S.monsters) have[m.type] = (have[m.type] || 0) + 1;
  const ok = Object.entries(MONSTER_TYPES).filter(([, T]) => T.minParts - shift <= n);
  const w = ok.map(([k, T]) => T.weight / (1 + (have[k] || 0) * 1.5)), sum = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum; for (let i = 0; i < ok.length; i++) { r -= w[i]; if (r <= 0) return ok[i][0]; }
  return 'crawler';
}
function wakeUp() {
  if (S.awake) return; S.awake = true;
  const n = monsterTarget(); for (let i = 0; i < n; i++) spawnMonster();
  broadcastAll({ t: 'fx', e: 'awake' }); sys('Something woke up. It knows what you took.');
}
// Weeper rule: frozen while any living player is facing it and it is inside their light
function isWatched(m, T) {
  for (const p of alivePlayers()) {
    const d = dist(p, m), vr = (hasLit(p) ? P.torchVision : P.vision + 30) + 14 * T.size;
    if (d > vr) continue;
    let da = Math.abs(Math.atan2(m.y - p.y, m.x - p.x) - p.face) % TAU; if (da > Math.PI) da = TAU - da;
    if (da < 1.3 || d < 22) return true;
  }
  return false;
}
const TY = (m) => MONSTER_TYPES[m.type] || MONSTER_TYPES.crawler;
const sectorOf = (x, y) => Math.floor((((Math.atan2(y - C.y, x - C.x) + TAU) % TAU) / TAU) * 8) % 8;
function pickRoam(m) {
  const M = MC(); let a;
  if (M.memory) {
    const w = S.heat.map((h) => Math.pow(h, 1.4) + 0.25), sum = w.reduce((a, b) => a + b, 0); let r = Math.random() * sum, i = 0;
    for (; i < 7; i++) { r -= w[i]; if (r <= 0) break; }
    a = ((i + Math.random()) / 8) * TAU;
  } else a = rr(0, TAU);
  const d = rr(CONFIG.FIRE.maxRadius + 120, 1450);
  m.tx = clamp(C.x + Math.cos(a) * d, 100, WD - 100); m.ty = clamp(C.y + Math.sin(a) * d, 100, WD - 100);
}

function hostUpdate(dt) {
  const M = MC(), prog = progress(), alive = alivePlayers(), n = S.order.length;
  S.time += dt;
  // players: velocity estimate + torches
  for (const id of S.order) {
    const p = S.players[id];
    p.vx = lerp(p.vx, (p.x - p.lx) / dt, 0.3); p.vy = lerp(p.vy, (p.y - p.ly) / dt, 0.3); p.lx = p.x; p.ly = p.y;
    p.inv.forEach((it, i) => { if (it && it.lit) { it.b -= dt / P.torchBurn; if (it.b <= 0) p.inv[i] = null; } });
  }
  // fire
  if (!S.fireOut) {
    S.fuel -= M.burnPerSec * (1 + 0.55 * prog) * (1 + 0.12 * (n - 1)) * dt;
    if (S.fuel <= 0) { S.fuel = 0; S.fireOut = true; S.fireOutT = 0; broadcastAll({ t: 'fx', e: 'fireout' }); }
    else if (fireFrac() <= CONFIG.FIRE.warnAt) { S.warnT -= dt; if (S.warnT <= 0) { S.warnT = 9; broadcastAll({ t: 'fx', e: 'firewarn' }); } }
    else S.warnT = 0;
  }
  // downed / revive (normal)
  for (const id of S.order) {
    const p = S.players[id]; if (p.state !== 'down') continue;
    p.downT -= dt;
    const helper = alive.find((h) => h.use && dist(h, p) < 48);
    if (helper) { p.revive += dt; if (p.revive >= M.reviveTime) { p.state = 'alive'; p.revive = 0; p.stamina = P.staminaMax; sys(`${helper.name} saved ${p.name}!`); } }
    else p.revive = Math.max(0, p.revive - dt);
    if (p.downT <= 0 && p.state === 'down') { p.state = 'dead'; sys(`${p.name} is gone...`); deliver({ t: 'fx', e: 'gone' }, p.id); }
  }
  // wood spawning
  S.woodT -= dt;
  if (S.woodT <= 0) {
    S.woodT = M.woodRespawn;
    const target = Math.round(lerp(M.woodTarget[0], M.woodTarget[1], prog)), have = S.items.filter((i) => i.k === 'w').length;
    if (have < target) spawnWood();
  }
  // monster population
  S.spawnT -= dt;
  if (S.spawnT <= 0 && S.monsters.length < monsterTarget()) { S.spawnT = 3; spawnMonster(); }
  // memory heat (hard)
  if (M.memory) {
    S.heatT -= dt;
    if (S.heatT <= 0) { S.heatT = 1; for (let i = 0; i < 8; i++) S.heat[i] *= 0.985;
      for (const p of alive) if (!inLight(p)) S.heat[sectorOf(p.x, p.y)] += p.sprint ? 0.3 : 0.15; }
  }
  monstersUpdate(dt);
  // the Mimic fakes a teammate's voice (bubble appears over the Mimic itself)
  for (const m of S.monsters) {
    if (!TY(m).mimic || m.state === 'retreat') continue;
    m.mt -= dt; if (m.mt > 0) continue; m.mt = rr(14, 26);
    const near = alivePlayers().filter((p) => !inLight(p) && dist(p, m) < 650 && dist(p, m) > 110); if (!near.length) continue;
    const tg = pick(near), others = S.order.map((i) => S.players[i]).filter((q) => q.id !== tg.id);
    const f = others.find((q) => q.color === m.col) || (others.length ? pick(others) : { name: pick(['Minh', 'Lan', 'Alex', 'Jess']) });
    deliver({ t: 'chat', n: f.name, c: m.col, text: pick(CONFIG.FAKE_LINES), mid: m.id }, tg.id);
  }
  // horror events
  S.nextEvent -= dt;
  if (S.nextEvent <= 0 && alive.length) { S.nextEvent = rr(...M.eventEvery); horrorEvent(); }
  // fire out → everyone dies
  if (S.fireOut) { S.fireOutT += dt; if (S.fireOutT > 7) for (const p of alivePlayers()) killPlayer(p, null); }
  checkEnd();
  // network snapshot 15Hz
  S.snapT -= dt; if (S.snapT <= 0) { S.snapT = 1 / 15; sendSnap(); }
}

function checkEnd() {
  if (S.ended) return;
  const M = MC();
  if (S.collected.length >= M.materialsNeeded) {
    const lost = S.order.filter((id) => S.players[id].state !== 'alive').length;
    return endGame(lost ? 'bad' : 'good');
  }
  if (!alivePlayers().length) endGame('worst');
}
function endGame(k) {
  S.ended = true;
  const m = Math.floor(S.time / 60), s = String(Math.floor(S.time % 60)).padStart(2, '0');
  const lost = S.order.map((id) => S.players[id]).filter((p) => p.state !== 'alive').map((p) => p.name);
  const st = `Time in the forest: ${m}:${s}\nParts recovered: ${S.collected.length}/${MC().materialsNeeded} · Mode: ${MC().label}` + (lost.length ? `\nLeft behind: ${lost.join(', ')}` : '');
  setTimeout(() => broadcastAll({ t: 'end', k, st }), 1200);
}

function dropAll(p) {
  p.inv.forEach((it, i) => { if (!it) return; S.items.push({ id: ++S.iid, k: it.k, m: it.m, b: it.b, x: p.x + rr(-22, 22), y: p.y + rr(-22, 22) }); p.inv[i] = null; });
  S.itemsVer++;
}
function killPlayer(p, m) {
  if (p.state !== 'alive') return;
  const M = MC();
  dropAll(p);
  p.state = M.reviveWindow ? 'down' : 'dead'; p.downT = M.reviveWindow; p.revive = 0; p.moving = false;
  S.deaths.push(p.name);
  if (m) { m.state = 'retreat'; m.retreatT = 3.2; m.target = null; }
  for (const o of S.monsters) if (o.target === p.id && o !== m) { o.state = 'search'; o.searchT = 4; o.target = null; o.tx = p.x; o.ty = p.y; }
  broadcastAll({ t: 'fx', e: 'kill', id: p.id, x: p.x, y: p.y });
  sys(M.reviveWindow ? `${p.name} was dragged down! Save them within ${M.reviveWindow}s.` : `${p.name} was taken by the forest.`);
}

// ---------------- MONSTER AI ----------------
// states: roam → (hear) search / (see) hunt → attack → retreat (target back at fire / after a kill)
// Several hunters on one player split roles: 1 chases, others block the way home / intercept / flank.
function monstersUpdate(dt) {
  const M = MC(), prog = progress(), fr = fireRadius(), safe = fr + 30;
  const hs = lerp(M.monsterSpeed[0], M.monsterSpeed[1], prog);
  const alive = alivePlayers();

  for (const m of S.monsters) {
    m.scd -= dt; const T = TY(m);
    if (S.fireOut) {
      let best = null, bd = 1e9; for (const p of alive) { const d = dist(m, p); if (d < bd) { bd = d; best = p; } }
      m.state = 'hunt'; if (best) { m.tx = best.x; m.ty = best.y; if (bd < 34) killPlayer(best, null); }
      steer(m, 250, dt); continue;
    }
    if (m.state === 'retreat') {
      m.retreatT -= dt;
      const dx = m.x - C.x, dy = m.y - C.y, d = Math.hypot(dx, dy) || 1;
      m.tx = m.x + (dx / d) * 200; m.ty = m.y + (dy / d) * 200;
      steer(m, M.roamSpeed * 1.8 * T.roam, dt);
      if (m.retreatT <= 0) { m.state = 'search'; m.searchT = M.memory ? 9 : 4; m.tx = m.lsx; m.ty = m.lsy; }
      keepOut(m, safe); continue;
    }
    // --- perception ---
    let seen = null, sd = 1e9;
    for (const p of alive) {
      if (inLight(p, 6)) continue;
      const d = dist(m, p);
      let range = (hasLit(p) ? M.torchSight : M.sight) * T.sight;
      if ((m.state === 'hunt' || m.state === 'attack') && m.target === p.id) range *= 1.7;
      if (d < range) { if (d < sd) { sd = d; seen = p; } }
      else if (p.moving && m.state !== 'hunt' && m.state !== 'attack') {
        const hr = (p.sprint ? M.sprintHear : M.walkHear) * T.hear;
        if (d < hr) { m.state = 'search'; m.searchT = M.memory ? 9 : 5; m.lsx = m.tx = p.x + rr(-40, 40); m.lsy = m.ty = p.y + rr(-40, 40);
          if (M.memory) S.heat[sectorOf(p.x, p.y)] += 0.08; }
      }
    }
    // target ran back into the firelight → retreat
    if (m.target && (m.state === 'hunt' || m.state === 'attack')) {
      const tp = S.players[m.target];
      if (!tp || tp.state !== 'alive' || inLight(tp, 12)) { m.state = 'retreat'; m.retreatT = rr(1.8, 3); m.target = null; keepOut(m, safe); continue; }
    }
    if (seen) {
      if (m.state !== 'hunt' && m.state !== 'attack') onSpot(m, seen);
      if (m.state !== 'attack') { m.state = 'hunt'; m.target = seen.id; }
      m.lsx = seen.x; m.lsy = seen.y; m.lost = Math.min(m.lost, 0);
    } else if (m.state === 'hunt') {
      m.lost += dt;
      if (m.lost > 1.3) { m.state = 'search'; m.searchT = M.memory ? 10 : 4.5; m.tx = m.lsx; m.ty = m.lsy; m.target = null; }
    }
  }
  // --- role assignment: 1 chaser, the rest block ---
  const groups = {};
  for (const m of S.monsters) if (m.state === 'hunt' && m.target) (groups[m.target] = groups[m.target] || []).push(m);
  for (const id in groups) {
    const p = S.players[id]; const g = groups[id].sort((a, b) => dist(a, p) - dist(b, p));
    g.forEach((m, i) => { m.role = i === 0 ? 'chase' : 'block'; m.bidx = i; });
  }
  // --- movement ---
  for (const m of S.monsters) {
    if (S.fireOut || m.state === 'retreat') continue;
    const T = TY(m);
    if ((m.state === 'hunt' || m.state === 'attack') && !S.players[m.target]) { m.state = 'search'; m.searchT = 3; m.target = null; }
    m.frozen = !!T.freezeWhenSeen && isWatched(m, T);
    if (m.frozen) { m.vx = m.vy = 0; m.rx = m.x; m.ry = m.y; continue; } // the Weeper cannot move while seen
    let sp = M.roamSpeed * T.roam;
    if (m.state === 'roam') {
      if (D(m.x, m.y, m.tx, m.ty) < 30) { sp = 0; m.idle -= dt; if (m.idle <= 0) { pickRoam(m); m.idle = rr(0.6, 2.8); } }
    } else if (m.state === 'search') {
      sp = M.roamSpeed * 1.45 * T.roam; m.searchT -= dt;
      if (D(m.x, m.y, m.tx, m.ty) < 28) { const a = rr(0, TAU), r = rr(60, M.memory ? 280 : 200); m.tx = m.lsx + Math.cos(a) * r; m.ty = m.lsy + Math.sin(a) * r; }
      if (m.searchT <= 0) { m.state = 'roam'; pickRoam(m); }
    } else if (m.state === 'hunt') {
      const p = S.players[m.target]; sp = hs * T.speed;
      const dp = dist(m, p);
      if (m.role === 'chase' || dp < 120) { m.tx = p.x + p.vx * 0.25; m.ty = p.y + p.vy * 0.25; }
      else {
        const k = (m.bidx - 1) % 3;
        if (k === 0) { // cut off the way back to the fire
          const dx = C.x - p.x, dy = C.y - p.y, d = Math.hypot(dx, dy) || 1, off = Math.min(d - safe - 15, 190);
          if (off > 50) { m.tx = p.x + (dx / d) * off; m.ty = p.y + (dy / d) * off; } else { m.tx = p.x; m.ty = p.y; }
        } else if (k === 1) { m.tx = p.x + p.vx * 1.1; m.ty = p.y + p.vy * 1.1; } // intercept where they're heading
        else { const a = Math.atan2(p.vy, p.vx) + Math.PI / 2; m.tx = p.x + Math.cos(a) * 150; m.ty = p.y + Math.sin(a) * 150; } // flank
      }
      if (dp < 28 + T.size * 8) { m.state = 'attack'; m.atkT = 0.42; }
    } else if (m.state === 'attack') {
      const p = S.players[m.target]; sp = hs * 0.35 * T.speed; m.tx = p.x; m.ty = p.y; m.atkT -= dt;
      if (m.atkT <= 0) { if (p.state === 'alive' && dist(m, p) < 44 + T.size * 8 && !inLight(p, 4)) killPlayer(p, m); else m.state = 'hunt'; }
    }
    steer(m, sp, dt); keepOut(m, safe);
  }
}
function steer(m, sp, dt) {
  const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
  const tvx = d > 4 ? (dx / d) * sp : 0, tvy = d > 4 ? (dy / d) * sp : 0, k = Math.min(1, dt * (TY(m).turn || 7));
  m.vx = lerp(m.vx, tvx, k); m.vy = lerp(m.vy, tvy, k);
  m.x = clamp(m.x + m.vx * dt, 60, WD - 60); m.y = clamp(m.y + m.vy * dt, 60, WD - 60);
  if (Math.hypot(m.vx, m.vy) > 6) m.ang = Math.atan2(m.vy, m.vx);
  m.rx = m.x; m.ry = m.y;
}
function keepOut(m, safe) {
  if (S.fireOut) return;
  const dx = m.x - C.x, dy = m.y - C.y, d = Math.hypot(dx, dy) || 1;
  if (d < safe) { m.x = C.x + (dx / d) * safe; m.y = C.y + (dy / d) * safe; m.rx = m.x; m.ry = m.y; }
}
function onSpot(m, p) {
  const M = MC();
  if (m.scd <= 0) { m.scd = 7; broadcastAll({ t: 'fx', e: 'spot', x: m.x, y: m.y, to: p.id }); }
  if (M.memory) S.heat[sectorOf(p.x, p.y)] += 1;
  const ar = Math.max(M.alertRadius || 0, TY(m).alert || 0);
  if (ar) {
    for (const o of S.monsters) {
      if (o === m || o.state === 'hunt' || o.state === 'attack' || o.state === 'retreat') continue;
      if (dist(o, m) < ar) { o.state = 'hunt'; o.target = p.id; o.lsx = p.x; o.lsy = p.y; o.lost = -4; }
    }
  }
}

// ---------------- horror events ----------------
function horrorEvent() {
  const t = pick(alivePlayers()); if (!t) return;
  const e = pick(['steps', 'whisper', 'flicker', 'fake', 'blackout', 'roar', 'signal']);
  if (e === 'flicker') { S.fuel = Math.max(1, S.fuel - 9); broadcastAll({ t: 'fx', e }); }
  else if (e === 'roar' || e === 'signal') broadcastAll({ t: 'fx', e });
  else if (e === 'fake') {
    const others = S.order.filter((id) => id !== t.id).map((id) => S.players[id]);
    const f = others.length ? pick(others) : { name: pick(['Minh', 'Lan', 'Alex', 'Jess']), color: pick(CONFIG.PLAYER_COLORS) };
    deliver({ t: 'chat', n: f.name, c: f.color, text: pick(CONFIG.FAKE_LINES), id: f.id }, t.id);
  } else deliver({ t: 'fx', e, txt: e === 'whisper' ? pick(CONFIG.WHISPERS) : '' }, t.id);
}

// ---------------- player actions (host resolves) ----------------
function nearestItem(p, r = 44) { let best = null, bd = r; for (const it of S.items) { const d = dist(p, it); if (d < bd) { bd = d; best = it; } } return best; }
function hostAct(id, a, slot) {
  const p = S.players[id]; if (!p || p.state !== 'alive' || S.ended) return;
  const M = MC(); slot = slot ? 1 : 0;
  if (a === 'use') {
    if (M.reviveWindow && S.order.some((oid) => S.players[oid].state === 'down' && dist(S.players[oid], p) < 48)) return; // reviving (hold)
    if (dist(p, CAR) < 90 && p.inv.some((it) => it && it.k === 'm')) {
      p.inv.forEach((it, i) => {
        if (!it || it.k !== 'm') return; p.inv[i] = null;
        if (!S.collected.includes(it.m)) { S.collected.push(it.m); broadcastAll({ t: 'fx', e: 'fixed', n: p.name, m: it.m });
          sys(`${p.name} installed the ${MAT[it.m].name} (${S.collected.length}/${M.materialsNeeded})`); }
      });
      checkEnd(); return;
    }
    const wi = p.inv[slot] && p.inv[slot].k === 'w' ? slot : p.inv.findIndex((it) => it && it.k === 'w');
    if (dist(p, C) < 100 && wi >= 0 && !S.fireOut) {
      const it = p.inv[wi]; p.inv[wi] = null;
      S.fuel = Math.min(M.fuelMax, S.fuel + M.woodFuel * Math.max(0.3, it.b)); deliver({ t: 'fx', e: 'throw' }, id); return;
    }
    const free = p.inv.indexOf(null);
    const it = nearestItem(p);
    if (it && free >= 0) {
      S.items.splice(S.items.indexOf(it), 1); S.itemsVer++;
      p.inv[free] = it.k === 'w' ? { k: 'w', b: it.b ?? 1, lit: false } : { k: 'm', m: it.m };
      if (it.k === 'm' && !S.awake) wakeUp();
      deliver({ t: 'fx', e: 'pick' }, id);
    }
  } else if (a === 'torch') {
    const li = p.inv.findIndex((it) => it && it.lit);
    if (li >= 0) { p.inv[li].lit = false; return; }
    const wi = p.inv[slot] && p.inv[slot].k === 'w' ? slot : p.inv.findIndex((it) => it && it.k === 'w');
    if (wi < 0) return;
    if (inLight(p) || alivePlayers().some((o) => o !== p && hasLit(o) && dist(o, p) < 60)) { p.inv[wi].lit = true; deliver({ t: 'fx', e: 'lit' }, id); }
    else deliver({ t: 'fx', e: 'nolight' }, id);
  } else if (a === 'drop') {
    const i = p.inv[slot] ? slot : p.inv.findIndex((x) => x); if (i < 0) return;
    const it = p.inv[i]; p.inv[i] = null;
    S.items.push({ id: ++S.iid, k: it.k, m: it.m, b: it.b, x: p.x + Math.cos(p.face) * 18, y: p.y + Math.sin(p.face) * 18 }); S.itemsVer++;
  }
}
function hostChat(id, text) {
  const p = S.players[id]; text = String(text || '').trim().slice(0, 80);
  if (!p || !text || p.state !== 'alive' || !inLight(p, 6)) return;
  broadcastAll({ t: 'chat', n: p.name, c: p.color, text, id: p.id });
}
function sys(text) { broadcastAll({ t: 'chat', sys: 1, text }); }

// ---------------- snapshots ----------------
const encInv = (inv) => inv.map((it) => (!it ? 0 : it.k === 'w' ? ['w', Math.round(it.b * 100), it.lit ? 1 : 0] : ['m', it.m]));
const decInv = (a) => a.map((x) => (!x ? null : x[0] === 'w' ? { k: 'w', b: x[1] / 100, lit: !!x[2] } : { k: 'm', m: x[1] }));
function sendSnap() {
  if (Net.role !== 'host' || !Net.conns.size) return;
  const msg = { t: 's', tm: r1(S.time), fu: r1(S.fuel), fo: S.fireOut ? 1 : 0, col: S.collected,
    P: S.order.map((id) => { const p = S.players[id]; return [id, Math.round(p.x), Math.round(p.y), p.state, r1(p.downT), encInv(p.inv), p.sprint ? 1 : 0, p.moving ? 1 : 0, r1(p.revive)]; }),
    M: S.monsters.map((m) => [m.id, Math.round(m.x), Math.round(m.y), m.state, Math.round(m.ang * 100) / 100, m.type, m.col, m.frozen ? 1 : 0]) };
  if (S.itemsVer !== S.sentVer || S.time - S.lastItemsSend > 2) {
    msg.I = S.items.map((i) => [i.id, i.k, i.m || '', Math.round(i.x), Math.round(i.y), Math.round((i.b ?? 1) * 100)]);
    S.sentVer = S.itemsVer; S.lastItemsSend = S.time;
  }
  Net.broadcast(msg);
}
function applySnap(m) {
  if (S.phase !== 'game') return;
  S.time = m.tm; S.fuel = m.fu; S.fireOut = !!m.fo; S.collected = m.col;
  for (const [id, x, y, st, dt, inv, sp, mv, rev] of m.P) {
    const p = S.players[id]; if (!p) continue;
    if (id !== S.myId || st !== 'alive') { p.x = x; p.y = y; p.sprint = !!sp; p.moving = !!mv; }
    if (id === S.myId && p.state !== 'alive' && st === 'alive') { p.x = x; p.y = y; p.rx = x; p.ry = y; }
    p.state = st; p.downT = dt; p.inv = decInv(inv); p.revive = rev;
  }
  const old = new Map(S.monsters.map((x) => [x.id, x]));
  S.monsters = m.M.map(([id, x, y, st, ang, type, col, fz]) => { const o = old.get(id) || { id, rx: x, ry: y }; Object.assign(o, { x, y, state: st, ang, type, col, frozen: !!fz }); return o; });
  if (m.I) S.items = m.I.map(([id, k, mm, x, y, b]) => ({ id, k, m: mm, x, y, b: b / 100 }));
}

// ================= FX / CHAT (all clients) =================
function viewTarget() {
  const mp = me(); if (!mp) return { rx: C.x, ry: C.y, x: C.x, y: C.y };
  if (mp.state !== 'dead') return mp;
  let t = S.players[S.spectate];
  if (!t || t.state === 'dead') { t = alivePlayers()[0] || S.order.map((i) => S.players[i]).find((p) => p.state === 'down') || mp; S.spectate = t.id; }
  return t;
}
function panOf(x) { const v = viewTarget(); return clamp((x - v.rx) / 500, -1, 1); }
function distVol(x, y, far = 1600) { const v = viewTarget(); return clamp(1 - D(x, y, v.rx, v.ry) / far, 0.08, 1); }
let centerT = 0, eventT = 0;
function center(t, dur = 2.5) { $('centerMsg').textContent = t; centerT = dur; }
function eventText(t, dur = 3.5) { $('eventMsg').textContent = t; $('eventMsg').style.opacity = 1; eventT = dur; }
function doFx(m) {
  const mine = m.to === S.myId;
  switch (m.e) {
    case 'spot':
      if (mine) { SFX.scream(1, panOf(m.x)); S.shake = 16; center('IT FOUND YOU', 2); }
      else SFX.scream(distVol(m.x, m.y) * 0.7, panOf(m.x));
      break;
    case 'kill':
      if (m.id === S.myId) { SFX.death(); S.shake = 24; center(MC().reviveWindow ? 'YOU ARE DOWN' : 'YOU DIED', 4); }
      else { SFX.scream(distVol(m.x, m.y) * 0.8, panOf(m.x)); }
      break;
    case 'gone': center('NO ONE CAME', 3); break;
    case 'awake': SFX.sting(); SFX.scream(0.85, rr(-1, 1)); S.shake = 14; center('SOMETHING WOKE UP', 3.5); break;
    case 'steps': SFX.falseFootsteps(); break;
    case 'whisper': SFX.whisper(rr(-1, 1)); eventText(m.txt); break;
    case 'flicker': S.flicker = 1.8; SFX.whoosh(); eventText('The fire shudders...'); break;
    case 'blackout': S.blackout = 4.5; SFX.staticBurst(0.4); eventText('Your light is swallowed by the dark...'); break;
    case 'roar': SFX.scream(0.9, rr(-1, 1)); S.shake = 20; { const p = me(); if (p) p.stamina = 0; } eventText('Something screams. Your legs freeze.'); break;
    case 'signal': S.chatGlitch = 12; SFX.staticBurst(1.6); addChat({ sys: 1, text: '[ ...signal lost... ]' }); break;
    case 'firewarn': SFX.warn(); center('THE FIRE IS DYING', 2.5); break;
    case 'fireout': SFX.sting(); SFX.scream(1, 0); center('THE FIRE IS OUT', 30); break;
    case 'fixed': SFX.sting(); eventText(`${m.n} installed the ${MAT[m.m].name}. The forest grows restless...`, 4); break;
    case 'pick': SFX.pickup(); break;
    case 'throw': SFX.whoosh(); break;
    case 'lit': SFX.whoosh(); break;
    case 'nolight': eventText('Light it at the bonfire (or from a teammate\'s torch).', 2.5); break;
  }
}
function garble(s) { return s.split('').map((c) => (Math.random() < 0.45 ? pick(['▓', '░', '#', '%', '_', '?']) : c)).join(''); }
function addChat(m) {
  const d = document.createElement('div');
  let text = m.text; if (S.chatGlitch > 0) text = garble(text);
  if (m.sys) { d.className = 'sys'; d.textContent = text; }
  else d.innerHTML = `<b style="color:${m.c}">${esc(m.n)}:</b> ${esc(text)}`;
  const bt = CONFIG.BUBBLE_TIME + text.length * 0.04;
  if (m.id && S.players[m.id]) S.bubbles['p' + m.id] = { text, t: bt };
  if (m.mid) S.bubbles['m' + m.mid] = { text, t: bt };
  const log = $('chatLog'); log.appendChild(d); while (log.children.length > 7) log.removeChild(log.firstChild);
  setTimeout(() => { d.style.transition = 'opacity 2s'; d.style.opacity = 0.35; }, 20000);
}
function canChat() { const p = me(); return !!p && p.state === 'alive' && inLight(p, 6); }
$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault(); const v = $('chatInput').value.trim(); $('chatInput').value = ''; $('chatInput').blur();
  if (!v || !canChat()) return;
  if (isHost()) hostChat(S.myId, v); else Net.send({ t: 'chat', text: v });
  $('chat').classList.remove('open');
});

// ================= INPUT =================
const keys = {}; let runHeld = false, runToggle = false, useHeld = false;
const joy = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
function act(a) {
  const p = me(); if (!p || p.state !== 'alive' || S.phase !== 'game') return;
  SFX.init();
  if (isHost()) hostAct(S.myId, a, S.sel); else Net.send({ t: 'act', a, s: S.sel });
}
addEventListener('keydown', (e) => {
  if (S.phase !== 'game') return;
  if (document.activeElement === $('chatInput')) { if (e.key === 'Escape') $('chatInput').blur(); return; }
  const k = e.key.toLowerCase(); keys[k] = true;
  if (e.repeat) return;
  if (k === 'e') { useHeld = true; act('use'); }
  else if (k === 'f' || k === 'q') act('torch');
  else if (k === 'g') act('drop');
  else if (k === '1') S.sel = 0; else if (k === '2') S.sel = 1;
  else if (k === ' ') { cycleSpectate(); e.preventDefault(); }
  else if (k === 'enter') { if (canChat()) { $('chatInput').focus(); e.preventDefault(); } else eventText('You can only talk by the fire.', 1.5); }
  else if (k === 'escape') show($('pauseMenu').classList.contains('show') ? null : 'pauseMenu');
  if (k === 'tab') e.preventDefault();
});
addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); keys[k] = false; if (k === 'e') useHeld = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; useHeld = false; });
function cycleSpectate() {
  const mp = me(); if (!mp || mp.state !== 'dead') return;
  const list = alivePlayers(); if (!list.length) return;
  const i = list.findIndex((p) => p.id === S.spectate); S.spectate = list[(i + 1) % list.length].id;
}
$('specLabel').addEventListener('click', cycleSpectate);
// touch stick (floating)
const zone = $('stickZone'), base = $('stickBase'), knob = $('stickKnob');
zone.addEventListener('touchstart', (e) => {
  SFX.init(); const t = e.changedTouches[0]; joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY;
  const zr = zone.getBoundingClientRect();
  base.style.left = (t.clientX - zr.left - 60) + 'px'; base.style.top = (t.clientY - zr.top - 60) + 'px'; base.style.bottom = 'auto';
  e.preventDefault();
}, { passive: false });
zone.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) if (t.identifier === joy.id) {
    let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy; const d = Math.hypot(dx, dy), mx = 50;
    if (d > mx) { dx = (dx / d) * mx; dy = (dy / d) * mx; }
    joy.x = dx / mx; joy.y = dy / mx; knob.style.transform = `translate(${dx}px,${dy}px)`;
  }
  e.preventDefault();
}, { passive: false });
const joyEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
zone.addEventListener('touchend', joyEnd); zone.addEventListener('touchcancel', joyEnd);
function tbtn(id, down, up) {
  const el = $(id);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); SFX.init(); down && down(); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); up && up(); }, { passive: false });
  el.addEventListener('mousedown', () => down && down()); el.addEventListener('mouseup', () => up && up());
}
tbtn('tbUse', () => { useHeld = true; act('use'); }, () => (useHeld = false));
tbtn('tbTorch', () => act('torch'));
tbtn('tbDrop', () => act('drop'));
tbtn('tbRun', () => { runToggle = !runToggle; $('tbRun').classList.toggle('on', runToggle); });
tbtn('tbChat', () => {
  if (!canChat()) { eventText('You can only talk by the fire.', 1.5); return; }
  $('chat').classList.toggle('open'); if ($('chat').classList.contains('open')) $('chatInput').focus();
});
document.querySelectorAll('.slot').forEach((s) => s.addEventListener('pointerdown', () => (S.sel = +s.dataset.i)));
$('matPanel').addEventListener('click', () => $('matPanel').classList.toggle('collapsed'));
if (isTouch) $('matPanel').classList.add('collapsed');

// ================= LOCAL PLAYER =================
function localUpdate(dt) {
  const p = me(); if (!p) return;
  let ix = 0, iy = 0;
  if (keys['w'] || keys['arrowup']) iy -= 1; if (keys['s'] || keys['arrowdown']) iy += 1;
  if (keys['a'] || keys['arrowleft']) ix -= 1; if (keys['d'] || keys['arrowright']) ix += 1;
  ix += joy.x; iy += joy.y;
  const mag = Math.hypot(ix, iy); if (mag > 1) { ix /= mag; iy /= mag; }
  runHeld = keys['shift'] || runToggle;
  const moving = p.state === 'alive' && mag > 0.15 && S.phase === 'game';
  const sprint = moving && runHeld && p.stamina > 1;
  if (sprint) p.stamina = Math.max(0, p.stamina - P.staminaDrain * dt);
  else p.stamina = Math.min(P.staminaMax, p.stamina + P.staminaRegen * dt * (moving ? 0.6 : 1));
  if (moving) {
    const sp = sprint ? P.sprint : P.walk;
    p.x += ix * sp * dt; p.y += iy * sp * dt; collide(p, P.radius);
    p.face = Math.atan2(iy, ix);
    S.stepT -= dt; if (S.stepT <= 0) { S.stepT = sprint ? 0.27 : 0.45; SFX.footstep(sprint ? 0.16 : 0.07, 0); }
  }
  p.moving = moving; p.sprint = sprint; p.use = useHeld; p.rx = p.x; p.ry = p.y;
  if (!isHost()) { S.inT -= dt; if (S.inT <= 0) { S.inT = 1 / 20; Net.send({ t: 'in', x: Math.round(p.x), y: Math.round(p.y), s: sprint ? 1 : 0, m: moving ? 1 : 0, u: useHeld ? 1 : 0, f: Math.round(p.face * 100) / 100 }); } }
}

// ================= RENDER =================
let fl = 1; // fire flicker
function render(dt, t) {
  const v = viewTarget();
  S.cam.x = lerp(S.cam.x, v.rx, Math.min(1, dt * 8)); S.cam.y = lerp(S.cam.y, v.ry, Math.min(1, dt * 8));
  let cx = S.cam.x, cy = S.cam.y;
  if (S.shake > 0) { cx += rr(-1, 1) * S.shake; cy += rr(-1, 1) * S.shake; S.shake = Math.max(0, S.shake - dt * 30); }
  const k = DPR * Z, ox = DPR * W / 2 - cx * k, oy = DPR * H / 2 - cy * k;
  const hw = W / 2 / Z + 120, hh = H / 2 / Z + 120, x0 = cx - hw, x1 = cx + hw, y0 = cy - hh, y1 = cy + hh;
  const vis = (x, y, m = 0) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;

  fl = lerp(fl, 0.92 + Math.random() * 0.12, 0.25);
  if (S.flicker > 0) { S.flicker -= dt; fl *= 0.55 + Math.random() * 0.2; }
  const fr = fireRadius() * fl, frac = fireFrac();

  // interpolate remote entities
  const ik = 1 - Math.exp(-dt * 12);
  for (const id of S.order) { const p = S.players[id]; if (id !== S.myId) { p.rx = lerp(p.rx, p.x, ik); p.ry = lerp(p.ry, p.y, ik);
    const mvx = p.x - p.rx, mvy = p.y - p.ry; if (!isHost() && Math.hypot(mvx, mvy) > 1.5) p.face = Math.atan2(mvy, mvx); } }
  if (!isHost()) for (const m of S.monsters) { m.rx = lerp(m.rx, m.x, ik); m.ry = lerp(m.ry, m.y, ik); }

  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(k, 0, 0, k, ox, oy);
  ctx.fillStyle = GROUND; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  drawCamp(t, frac);
  for (const it of S.items) if (vis(it.x, it.y)) drawItem(it, t);
  for (const id of S.order) { const p = S.players[id]; if (vis(p.rx, p.ry)) drawPlayer(p, t); }
  for (const m of S.monsters) if (vis(m.rx, m.ry, 140)) drawMonster(m, t);
  // first sighting of each monster type → short description
  for (const m of S.monsters) {
    const T = TY(m); if (S.seenTypes[m.type]) continue;
    const seeR = (hasLit(v) ? P.torchVision : P.vision) + 25 * T.size;
    if (D(m.rx, m.ry, v.rx, v.ry) < seeR) { S.seenTypes[m.type] = 1; eventText(`${T.name.toUpperCase()} — ${T.desc}`, 6); }
  }
  // canopies
  const mp = me();
  for (const tr of trees) {
    if (!vis(tr.x, tr.y, tr.cr)) continue;
    ctx.fillStyle = '#140d08'; ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, TAU); ctx.fill();
    const near = D(tr.x, tr.y, v.rx, v.ry) < tr.cr + 10;
    ctx.globalAlpha = near ? 0.35 : 0.93;
    ctx.save(); ctx.translate(tr.x, tr.y); ctx.rotate(tr.rot); const s = tr.cr * 2.2; ctx.drawImage(CANOPY[tr.v], -s / 2, -s / 2, s, s); ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ---- darkness / light ----
  const lk = k / 2;
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = 'rgba(1,2,5,0.975)'; lctx.fillRect(0, 0, lc.width, lc.height);
  lctx.globalCompositeOperation = 'destination-out';
  lctx.setTransform(lk, 0, 0, lk, ox / 2, oy / 2);
  const hole = (x, y, r, a = 1, inner = 0.45) => {
    if (r <= 1) return; const g = lctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(inner, `rgba(0,0,0,${a * 0.88})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g; lctx.beginPath(); lctx.arc(x, y, r, 0, TAU); lctx.fill();
  };
  if (!S.fireOut) hole(C.x, C.y, fr * 1.12, 1, 0.62);
  const blind = S.blackout > 0;
  for (const id of S.order) {
    const p = S.players[id]; if (p.state === 'dead') continue;
    const isV = p === v, tf = 0.94 + Math.random() * 0.08;
    if (hasLit(p) && !(isV && blind)) hole(p.rx, p.ry, P.torchVision * tf, 1, 0.4);
    if (isV) hole(p.rx, p.ry, blind ? 26 : (p.state === 'down' ? 70 : P.vision), 1, 0.35);
    else hole(p.rx, p.ry, 46, 0.55, 0.3);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lc, 0, 0, cv.width, cv.height);

  // warm glow
  ctx.setTransform(k, 0, 0, k, ox, oy); ctx.globalCompositeOperation = 'lighter';
  if (!S.fireOut) { const g = ctx.createRadialGradient(C.x, C.y, 10, C.x, C.y, fr * 1.15); g.addColorStop(0, 'rgba(255,140,40,.32)'); g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C.x, C.y, fr * 1.15, 0, TAU); ctx.fill(); }
  for (const id of S.order) { const p = S.players[id]; if (p.state === 'dead' || !hasLit(p) || (p === v && blind)) continue;
    const g = ctx.createRadialGradient(p.rx, p.ry, 4, p.rx, p.ry, P.torchVision); g.addColorStop(0, 'rgba(255,130,40,.22)'); g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.rx, p.ry, P.torchVision, 0, TAU); ctx.fill(); }
  // embers
  if (!S.fireOut && Math.random() < frac * 0.9) S.embers.push({ x: C.x + rr(-14, 14), y: C.y + rr(-8, 8), vx: rr(-12, 12), vy: rr(-50, -25), l: rr(1, 2.4) });
  ctx.fillStyle = 'rgba(255,160,60,.85)';
  S.embers = S.embers.filter((e) => { e.l -= dt; e.x += (e.vx + Math.sin(t * 3 + e.y) * 10) * dt; e.y += e.vy * dt; if (e.l > 0) { ctx.globalAlpha = Math.min(1, e.l); ctx.fillRect(e.x, e.y, 2, 2); } return e.l > 0; });
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  // eyes in the dark (+ the Weeper's pale shape, faintly visible)
  for (const m of S.monsters) {
    const d = D(m.rx, m.ry, v.rx, v.ry); if (d > 750 || !vis(m.rx, m.ry, 80)) continue;
    const T = TY(m), sz = T.size, hunt = m.state === 'hunt' || m.state === 'attack' || S.fireOut;
    const im = IMG['monster_' + m.type] || IMG.monster;
    if (im) { ctx.fillStyle = hunt ? 'rgba(255,0,0,.25)' : 'rgba(200,200,200,.08)'; ctx.beginPath(); ctx.arc(m.rx, m.ry - 20 * sz, 14 * sz, 0, TAU); ctx.fill(); continue; }
    if (m.type === 'weeper' && d < 480) {
      ctx.save(); ctx.globalAlpha = 0.13 * (1 - d / 480); ctx.translate(m.rx, m.ry); ctx.rotate(m.ang); ctx.scale(sz, sz);
      MonsterArt.draw(ctx, m.type, m, t, hunt, m.state === 'attack', m.col); ctx.restore(); ctx.globalAlpha = 1; continue;
    }
    if (m.type !== 'watcher' && ((t * 0.6 + m.id * 1.7) % 4.5) < 0.15) continue; // blink
    const E = MonsterArt.eyes(m.type, m, t, hunt); if (!E || E.color === '#000') continue;
    const ca = Math.cos(m.ang), sa = Math.sin(m.ang);
    ctx.shadowColor = hunt ? '#ff0000' : '#ffffff'; ctx.shadowBlur = E.many ? 6 : 10; ctx.fillStyle = E.color;
    ctx.beginPath();
    for (const [x, y, r] of E.pts) {
      const wx = m.rx + (x * ca - y * sa) * sz, wy = m.ry + (x * sa + y * ca) * sz, rr2 = (E.many ? r * 0.55 : r) * sz * (hunt ? 1.15 : 1);
      ctx.moveTo(wx + rr2, wy); ctx.arc(wx, wy, rr2, 0, TAU);
    }
    ctx.fill(); ctx.shadowBlur = 0;
    if (E.grin) { const [gx, gy, gr] = E.grin; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.2 * sz;
      ctx.beginPath(); ctx.arc(m.rx + gx * ca * sz, m.ry + gx * sa * sz, gr * sz, m.ang - 1.1, m.ang + 1.1); ctx.stroke(); }
  }
  // glints of nearby items (help find things at the edge of vision)
  for (const it of S.items) {
    const d = D(it.x, it.y, v.rx, v.ry); if (d > P.vision * 2.6 || d < P.vision * 0.8) continue;
    const s = Math.sin(t * 4 + it.id * 2.3); if (s < 0.75) continue;
    ctx.fillStyle = it.k === 'm' ? `rgba(255,230,160,${(s - 0.75) * 2.4})` : `rgba(200,160,110,${(s - 0.75) * 1.4})`;
    ctx.fillRect(it.x - 1, it.y - 4, 2, 8); ctx.fillRect(it.x - 4, it.y - 1, 8, 2);
  }
  // fog
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 9; i++) {
    const fx = Math.floor(cx / 400) * 400 + ((i % 3) - 1) * 400 + Math.sin(t * 0.05 + i) * 140, fy = Math.floor(cy / 400) * 400 + (Math.floor(i / 3) - 1) * 400 + Math.cos(t * 0.04 + i * 2) * 140;
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 260); g.addColorStop(0, 'rgba(70,80,90,.07)'); g.addColorStop(1, 'rgba(70,80,90,0)');
    ctx.fillStyle = g; ctx.fillRect(fx - 260, fy - 260, 520, 520);
  }
  ctx.globalCompositeOperation = 'source-over';
  if (vis(CAR.x, CAR.y)) { ctx.textAlign = 'center'; ctx.fillStyle = '#fbbf24'; ctx.font = '13px "Special Elite", monospace'; ctx.fillText(`${S.collected.length}/${MC().materialsNeeded}`, CAR.x, CAR.y - 44); }

  // screen-space arrows
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const arrow = (wx, wy, col, label) => {
    const sx = (wx - cx) * Z + W / 2, sy = (wy - cy) * Z + H / 2;
    if (sx > 30 && sx < W - 30 && sy > 30 && sy < H - 30) return;
    const a = Math.atan2(sy - H / 2, sx - W / 2), r = Math.min(W, H) / 2 - 46;
    const ax = W / 2 + Math.cos(a) * r, ay = H / 2 + Math.sin(a) * r;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = col; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.fill(); ctx.restore();
    ctx.fillStyle = col; ctx.globalAlpha = 0.8; ctx.font = 'bold 14px serif'; ctx.textAlign = 'center'; ctx.fillText(label, ax - Math.cos(a) * 18, ay - Math.sin(a) * 18 + 5); ctx.globalAlpha = 1;
  };
  // teammates: colored ring + name always readable over the darkness
  const SX = (wx) => (wx - cx) * Z + W / 2, SY = (wy) => (wy - cy) * Z + H / 2;
  ctx.textAlign = 'center';
  for (const id of S.order) {
    const p = S.players[id]; if (p.state === 'dead' || !vis(p.rx, p.ry)) continue;
    const x = SX(p.rx), y = SY(p.ry), self = id === S.myId;
    ctx.strokeStyle = p.state === 'down' ? '#ef4444' : p.color; ctx.lineWidth = 2.5; ctx.globalAlpha = self ? 0.45 : 0.85;
    ctx.beginPath(); ctx.arc(x, y, 20 * Z + 3, 0, TAU); ctx.stroke();
    if (!self) {
      ctx.font = 'bold 12px "Special Elite", monospace'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.globalAlpha = 1;
      const lbl = p.name + (p.state === 'down' ? ` (${Math.ceil(p.downT)}s)` : '');
      ctx.strokeText(lbl, x, y - 22 * Z - 10); ctx.fillStyle = p.state === 'down' ? '#ef4444' : p.color; ctx.fillText(lbl, x, y - 22 * Z - 10);
    }
  }
  ctx.globalAlpha = 1;
  // chat bubbles above heads (players, or a Mimic pretending to be one)
  for (const key in S.bubbles) {
    const b = S.bubbles[key]; b.t -= dt;
    let wx, wy;
    if (key[0] === 'p') { const p = S.players[key.slice(1)]; if (!p || p.state === 'dead') b.t = 0; else { wx = p.rx; wy = p.ry; } }
    else { const m = S.monsters.find((o) => String(o.id) === key.slice(1)); if (!m) b.t = 0; else { wx = m.rx; wy = m.ry - 8 * TY(m).size; } }
    if (b.t <= 0) { delete S.bubbles[key]; continue; }
    if (!vis(wx, wy)) continue;
    drawBubble(SX(wx), SY(wy) - 22 * Z - 28, b.text, Math.min(1, b.t * 2));
  }
  if (!S.fireOut) arrow(C.x, C.y, '#f97316', '🔥');
  for (const id of S.order) { const p = S.players[id]; if (p.state === 'alive' && id !== S.myId) arrow(p.rx, p.ry, p.color, p.name[0].toUpperCase()); }
  for (const id of S.order) { const p = S.players[id]; if (p.state === 'down' && id !== S.myId) arrow(p.rx, p.ry, '#ef4444', '✚'); }
}

function drawBubble(x, y, text, a) {
  ctx.font = '13px "Special Elite", monospace';
  const words = String(text).split(' '), lines = []; let cur = '';
  for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (ctx.measureText(tst).width > 170 && cur) { lines.push(cur); cur = w; } else cur = tst; }
  if (cur) lines.push(cur);
  const lw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16, lh = lines.length * 16 + 10;
  const bx = x - lw / 2, by = y - lh;
  ctx.globalAlpha = 0.92 * a; ctx.fillStyle = '#efe7d6';
  ctx.beginPath(); ctx.moveTo(bx + 6, by); ctx.arcTo(bx + lw, by, bx + lw, by + lh, 6); ctx.arcTo(bx + lw, by + lh, bx, by + lh, 6);
  ctx.lineTo(x + 6, by + lh); ctx.lineTo(x, by + lh + 7); ctx.lineTo(x - 6, by + lh); ctx.arcTo(bx, by + lh, bx, by, 6); ctx.arcTo(bx, by, bx + lw, by, 6); ctx.fill();
  ctx.fillStyle = '#1a120c'; ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, x, by + 18 + i * 16));
  ctx.globalAlpha = 1;
}
function drawCamp(t, frac) {
  // car
  ctx.save(); ctx.translate(CAR.x, CAR.y); ctx.rotate(-0.12);
  ctx.fillStyle = 'rgba(0,0,0,.5)'; rrect(-62, -26, 130, 60, 12); ctx.fill();
  ctx.fillStyle = '#3a2a22'; rrect(-60, -30, 120, 58, 12); ctx.fill();
  ctx.fillStyle = '#4a3328'; rrect(-60, -30, 120, 58, 12); ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#0d1418'; rrect(-24, -24, 40, 46, 6); ctx.fill();
  ctx.fillStyle = '#5a3a28'; rrect(22, -26, 34, 50, 5); ctx.fill(); // open hood
  ctx.fillStyle = '#111'; for (const [x, y] of [[-40, -33], [36, -33], [-40, 27], [36, 27]]) { ctx.fillRect(x, y, 16, 7); }
  for (let i = 0; i < S.collected.length; i++) { ctx.fillStyle = '#7c6a40'; ctx.fillRect(26 + (i % 3) * 9, -20 + Math.floor(i / 3) * 12, 6, 8); }
  ctx.restore();
  // fire pit
  ctx.fillStyle = '#1b1612';
  for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU; ctx.beginPath(); ctx.arc(C.x + Math.cos(a) * 30, C.y + Math.sin(a) * 30, 7, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#2a1a10'; ctx.strokeStyle = '#120a05'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(i * 0.8 + 0.3); rrect(-22, -4, 44, 8, 3); ctx.fill(); ctx.stroke(); ctx.restore(); }
  if (S.fireOut) { ctx.fillStyle = 'rgba(80,80,80,.4)'; ctx.beginPath(); ctx.arc(C.x, C.y, 14, 0, TAU); ctx.fill(); return; }
  ctx.globalCompositeOperation = 'lighter';
  const sz = 10 + 22 * frac;
  for (let i = 0; i < 9; i++) {
    const a = t * 6 + i * 2.1, x = C.x + Math.sin(a) * sz * 0.3, y = C.y - Math.abs(Math.cos(a * 0.7)) * sz * 0.6;
    const r = sz * (0.5 + 0.5 * Math.abs(Math.sin(a * 1.3))) * fl;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,240,170,.55)'); g.addColorStop(0.4, 'rgba(255,140,30,.35)'); g.addColorStop(1, 'rgba(200,40,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawWood(x, y, rot, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = '#5b3a1e'; ctx.strokeStyle = '#2a1708'; ctx.lineWidth = 1.5;
  rrect(-13, -7, 26, 6, 3); ctx.fill(); ctx.stroke(); rrect(-11, 1, 24, 6, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a07040'; ctx.beginPath(); ctx.arc(13, -4, 2.4, 0, TAU); ctx.arc(13, 4, 2.4, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawItem(it, t) {
  if (it.k === 'w') { drawWood(it.x, it.y, it.id * 1.3, 1); return; }
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 8, 15, 6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b2621'; rrect(it.x - 13, it.y - 12, 26, 22, 4); ctx.fill();
  ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(MAT[it.m].icon, it.x, it.y - 1 + Math.sin(t * 2 + it.id) * 1.2);
  ctx.textBaseline = 'alphabetic';
}
function drawPlayer(p, t) {
  const x = p.rx, y = p.ry;
  if (p.state !== 'alive') {
    ctx.fillStyle = 'rgba(90,0,0,.6)'; ctx.beginPath(); ctx.ellipse(x, y, 24, 15, 0.3, 0, TAU); ctx.fill();
    if (p.left) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(1.2);
    ctx.fillStyle = p.state === 'dead' ? '#2a2420' : p.color; ctx.globalAlpha = p.state === 'dead' ? 0.7 : 0.9;
    rrect(-14, -8, 26, 16, 7); ctx.fill(); ctx.fillStyle = '#c9a888'; ctx.beginPath(); ctx.arc(15, 0, 6, 0, TAU); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
    if (p.state === 'down' && MC().reviveWindow) {
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 26, -Math.PI / 2, -Math.PI / 2 + TAU * (p.downT / MC().reviveWindow)); ctx.stroke();
      if (p.revive > 0) { ctx.strokeStyle = '#4ade80'; ctx.beginPath(); ctx.arc(x, y, 31, -Math.PI / 2, -Math.PI / 2 + TAU * (p.revive / MC().reviveTime)); ctx.stroke(); }
    }
    return;
  }
  const bob = p.moving ? Math.sin(t * (p.sprint ? 18 : 11)) * 1.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x, y + 8, 14, 7, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(x, y + 2, 19, 17, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  if (IMG.player) { ctx.save(); ctx.translate(x, y + bob); if (Math.cos(p.face) < 0) ctx.scale(-1, 1); ctx.drawImage(IMG.player, -22, -34, 44, 44); ctx.restore(); }
  else {
    ctx.save(); ctx.translate(x, y + bob); ctx.rotate(p.face);
    ctx.fillStyle = '#1d1712'; rrect(-12, -9, 10, 18, 4); ctx.fill(); // backpack
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, 11, 13, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = '#c9a888'; ctx.beginPath(); ctx.arc(5, 0, 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(3, 0, 7, Math.PI * 0.55, Math.PI * 1.45); ctx.fill(); // hood
    ctx.restore();
  }
  // carried items
  const lit = p.inv.find((it) => it && it.lit);
  if (lit && !(p === viewTarget() && S.blackout > 0)) {
    const hx = x + Math.cos(p.face + 0.7) * 14, hy = y + Math.sin(p.face + 0.7) * 14 + bob;
    ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(p.face) * 10, hy + Math.sin(p.face) * 10 - 6); ctx.stroke();
    const fx = hx + Math.cos(p.face) * 10, fy = hy + Math.sin(p.face) * 10 - 9;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const r = (5 + Math.random() * 4) * (0.5 + lit.b * 0.5); const g = ctx.createRadialGradient(fx, fy - i * 2, 0, fx, fy - i * 2, r);
      g.addColorStop(0, 'rgba(255,230,150,.8)'); g.addColorStop(1, 'rgba(255,90,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy - i * 2, r, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  const carry = p.inv.filter((it) => it && !it.lit);
  carry.forEach((it, i) => {
    const bx = x - Math.cos(p.face) * 10 + (i ? 6 : -6), by = y - Math.sin(p.face) * 10 - 4;
    if (it.k === 'w') drawWood(bx, by, p.face + 1.57, 0.5);
    else { ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.fillText(MAT[it.m].icon, bx, by); }
  });
}
function drawMonster(m, t) {
  const T = TY(m), sz = T.size;
  const hunt = m.state === 'hunt' || m.state === 'attack' || S.fireOut, atk = m.state === 'attack';
  const j = hunt && !m.frozen ? 1.8 : 0;
  ctx.save(); ctx.translate(m.rx + rr(-j, j), m.ry + rr(-j, j));
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(0, 7 * sz, 26 * sz, 13 * sz, 0, 0, TAU); ctx.fill();
  const im = IMG['monster_' + m.type] || IMG.monster;
  if (im) {
    const s = CONFIG.MONSTER_IMG_SIZE * sz * 0.7, bob = m.frozen ? 0 : Math.sin(t * (hunt ? 12 : 4) + m.id) * 2;
    if (Math.cos(m.ang) < 0) ctx.scale(-1, 1);
    ctx.drawImage(im, -s / 2, -s * 0.8 + bob, s, s); ctx.restore(); return;
  }
  ctx.rotate(m.ang); ctx.scale(sz, sz);
  MonsterArt.draw(ctx, m.type, m, m.frozen ? m.id * 3.1 : t, hunt, atk, m.col); // frozen = no animation at all
  ctx.restore();
}

// ================= HUD =================
let hudCache = {};
function setH(id, html, prop = 'innerHTML') { if (hudCache[id + prop] === html) return; hudCache[id + prop] = html; $(id)[prop] = html; }
function hud(dt) {
  const M = MC(), p = me(), frac = fireFrac();
  setH('firePct', S.fireOut ? 'OUT' : Math.ceil(frac * 100) + '%');
  $('fireBar').style.width = (frac * 100).toFixed(1) + '%';
  $('firePanel').classList.toggle('warn', frac <= CONFIG.FIRE.warnAt);
  setH('clock', `${Math.floor(S.time / 60)}:${String(Math.floor(S.time % 60)).padStart(2, '0')}`);
  setH('matCount', `${S.collected.length}/${M.materialsNeeded}`);
  const carried = new Set(); for (const id of S.order) for (const it of S.players[id].inv) if (it && it.k === 'm') carried.add(it.m);
  setH('matList', S.required.map((id) => `<div class="${S.collected.includes(id) ? 'got' : carried.has(id) ? 'carry' : ''}">${MAT[id].icon} ${MAT[id].name}</div>`).join(''));
  setH('teamPanel', S.order.map((id) => { const q = S.players[id];
    const st = q.state === 'alive' ? (hasLit(q) ? '🔥' : '●') : q.state === 'down' ? `⏳${Math.ceil(q.downT)}s` : '✝';
    return `<div style="color:${q.state === 'alive' ? q.color : q.state === 'down' ? '#ef4444' : '#57534e'}">${esc(q.name)} ${st}</div>`; }).join(''));
  if (!p) return;
  // slots
  document.querySelectorAll('.slot').forEach((el, i) => {
    const it = p.inv[i];
    const html = !it ? '' : it.k === 'w' ? `🪵${it.lit ? '<span class="lit">🔥</span>' : ''}<div class="burn" style="width:${Math.round(it.b * 46)}px"></div>` : MAT[it.m].icon;
    if (el._h !== html) { el._h = html; el.innerHTML = html; }
    el.classList.toggle('sel', S.sel === i);
  });
  $('stamBar').style.width = (p.stamina / P.staminaMax * 100) + '%';
  // chat
  const cc = canChat(); $('chatInput').disabled = !cc;
  setH('chatInput', cc ? 'Say something... (Enter)' : (p.state === 'alive' ? 'Return to the fire to speak...' : 'The dead cannot speak...'), 'placeholder');
  $('chatLog').classList.toggle('glitch', S.chatGlitch > 0);
  // spectate
  const spec = p.state === 'dead';
  cv.classList.toggle('spectate', spec);
  $('specLabel').classList.toggle('hidden', !spec);
  if (spec) { const v = viewTarget(); setH('specLabel', v && v !== p ? `👁 You are dead — watching ${esc(v.name)} ${alivePlayers().length > 1 ? '(Space / tap to switch)' : ''}` : '👁 You are dead'); }
  // prompt
  setH('prompt', promptText(p));
  // timers
  if (centerT > 0) { centerT -= dt; if (centerT <= 0) $('centerMsg').textContent = ''; }
  if (eventT > 0) { eventT -= dt; if (eventT <= 0) $('eventMsg').style.opacity = 0; }
}
function promptText(p) {
  const K = (k) => (isTouch ? { E: 'USE', F: '🔥', G: 'DROP' }[k] : k);
  if (p.state === 'down') return `You are down — a teammate must hold ${K('E')} on you (${Math.ceil(p.downT)}s)`;
  if (p.state !== 'alive') return '';
  const M = MC();
  const downed = S.order.map((i) => S.players[i]).find((q) => q.state === 'down' && dist(q, p) < 48);
  if (downed && M.reviveWindow) return `Hold ${K('E')} to save ${esc(downed.name)}`;
  const hasMat = p.inv.some((it) => it && it.k === 'm'), hasWood = p.inv.some((it) => it && it.k === 'w');
  if (dist(p, CAR) < 90 && hasMat) return `${K('E')}: install parts in the car`;
  const parts = [];
  if (dist(p, C) < 100 && hasWood && !S.fireOut) parts.push(`${K('E')}: throw wood into the fire`);
  const it = nearestItem(p);
  if (it) parts.push(p.inv.includes(null) ? `${K('E')}: pick up ${it.k === 'w' ? 'wood' : MAT[it.m].name}` : `Hands full (${K('G')} to drop)`);
  if (hasWood && !hasLit(p) && inLight(p)) parts.push(`${K('F')}: light a torch`);
  if (hasLit(p)) parts.push(`${K('F')}: put out torch`);
  return parts.join(' · ');
}

// ================= ENDING =================
function showEnding(m) {
  if (S.phase !== 'game') return;
  S.phase = 'end'; S.ended = true;
  const E = CONFIG.ENDINGS[m.k];
  $('hud').classList.add('hidden'); cv.classList.remove('spectate'); SFX.setDanger(0); $('danger').style.opacity = 0;
  $('endTag').textContent = E.tag.toUpperCase(); $('endTitle').textContent = E.title; $('endTitle').classList.toggle('good', m.k === 'good');
  $('endStats').textContent = m.st || ''; $('endText').textContent = '';
  show('ending');
  m.k === 'good' ? SFX.whoosh() : SFX.sting();
  let i = 0; const txt = E.text;
  const iv = setInterval(() => { $('endText').textContent = txt.slice(0, ++i); if (i >= txt.length) clearInterval(iv); }, 38);
  if (m.k === 'good') setTimeout(() => SFX.growl(0.4, 0.8), 4200);
}

// ================= LOOP =================
let last = performance.now();
function frame(now) {
  try { step(now); } catch (e) { console.error(e); } // one bad frame must never freeze the game
  requestAnimationFrame(frame);
}
function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  if (S.phase === 'game' || S.phase === 'end') {
    if (S.phase === 'game') {
      localUpdate(dt);
      if (isHost() && !S.ended) hostUpdate(dt);
      if (S.blackout > 0) S.blackout -= dt;
      if (S.chatGlitch > 0) S.chatGlitch -= dt;
      hud(dt);
    }
    render(dt, t);
    // danger / heartbeat / growls
    const v = viewTarget(); let danger = 0;
    for (const m of S.monsters) {
      const d = D(m.rx, m.ry, v.rx, v.ry);
      const hunt = m.state === 'hunt' || m.state === 'attack';
      danger = Math.max(danger, clamp(1 - d / (hunt ? 520 : 260), 0, 1) * (hunt ? 1 : 0.5));
      if (d < 600 && Math.random() < dt * (hunt ? 0.35 : 0.1)) {
        const T = TY(m), vol = (1 - d / 600) * 0.9, pan = clamp((m.rx - v.rx) / 400, -1, 1);
        if (m.type === 'weeper') SFX.sob(vol * 0.8, pan);
        else if (m.type === 'mimic') { if (Math.random() < 0.3) SFX.whisper(pan); }
        else SFX.growl(vol * (T.size > 2 ? 1.2 : 1), pan, T.pitch || 1);
      }
    }
    if (S.phase !== 'game') danger = 0;
    SFX.setDanger(danger); $('danger').style.opacity = (danger * 0.85).toFixed(2);
    const fd = D(v.rx, v.ry, C.x, C.y);
    SFX.setFire(S.fireOut || S.phase !== 'game' ? 0 : clamp(1 - fd / 500, 0, 1) * (0.4 + fireFrac() * 0.6));
  } else {
    // menu backdrop: drifting embers
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (Math.random() < 0.3) S.embers.push({ x: rr(0, W), y: H + 5, vx: rr(-10, 10), vy: rr(-60, -20), l: rr(3, 7) });
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = 'rgba(255,140,50,.8)';
    S.embers = S.embers.filter((e) => { e.l -= dt; e.x += e.vx * dt; e.y += e.vy * dt; ctx.globalAlpha = clamp(e.l / 3, 0, 1); ctx.fillRect(e.x, e.y, 2, 2); return e.l > 0; });
    ctx.globalAlpha = 1;
  }
  SFX.update(dt);
}
requestAnimationFrame(frame);

// Keep the host simulation alive when its tab is hidden (rAF stops in background tabs).
// A Worker timer is not throttled like page timers, so friends' games don't freeze.
try {
  const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),50)'], { type: 'text/javascript' })));
  let lastBg = performance.now();
  wk.onmessage = () => {
    const now = performance.now(), dt = Math.min(0.1, (now - lastBg) / 1000); lastBg = now;
    if (!document.hidden || S.phase !== 'game' || !isHost() || S.ended) return;
    last = now; // so the next visible frame doesn't double-step
    if (S.blackout > 0) S.blackout -= dt;
    hostUpdate(dt);
  };
} catch (e) {}

// debug hook for testing
window.__LE = { S, hostAct, killPlayer, endGame };
})();
