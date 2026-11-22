// =====================================================
//  LAST EMBER — monster types (stats + procedural art)
//  To add a type: add an entry to MONSTER_TYPES and a draw function in ART.
//  Optional PNG per type: CONFIG.IMAGES['monster_<type>'] (falls back to IMAGES.monster, then the drawing).
// =====================================================
const MONSTER_TYPES = {
  // size = scale of the drawing/reach · speed/roam/sight/hear = multipliers on the mode values
  // minParts = parts installed before this type can appear (Hard mode unlocks 1 part earlier)
  crawler: { name: 'The Crawler', size: 1.55, speed: 1.0, roam: 1.0, sight: 1.0, hear: 1.0, minParts: 0, weight: 3, turn: 7,
    desc: 'Skittering spider-limbed thing. Fast and relentless.' },
  weeper: { name: 'The Weeper', size: 1.6, speed: 1.5, roam: 1.15, sight: 0.9, hear: 1.25, minParts: 0, weight: 2, turn: 9, freezeWhenSeen: true, pitch: 1.3,
    desc: 'Cannot move while anyone can see it. Very fast when nobody looks.' },
  wendigo: { name: 'The Antlered', size: 2.15, speed: 1.16, roam: 0.8, sight: 1.2, hear: 1.0, minParts: 1, weight: 2, turn: 2.6, pitch: 0.55,
    desc: 'Huge and fast in a straight line, but turns slowly. Zig-zag to lose it.' },
  mimic: { name: 'The Mimic', size: 1.4, speed: 0.92, roam: 1.0, sight: 1.0, hear: 1.35, minParts: 2, weight: 2, turn: 7, mimic: true, pitch: 1.7,
    desc: 'Looks like a teammate in the dark. Fakes their voice in chat.' },
  watcher: { name: 'Many-Eyes', size: 1.95, speed: 0.78, roam: 0.7, sight: 1.65, hear: 0.8, minParts: 3, weight: 1, turn: 5, alert: 650, pitch: 1.4,
    desc: 'Slow, but sees very far and calls every monster nearby.' },
};

const MonsterArt = (() => {
  const TAU = Math.PI * 2;
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); };
  const line = (c, pts) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); };

  // ---------------- Crawler ----------------
  function crawler(c, m, t, hunt, atk) {
    const ph = t * (hunt ? 12 : 4.5) + m.id;
    c.strokeStyle = '#060404'; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 2.6;
    for (const s of [-1, 1]) for (let j = 0; j < 3; j++) {
      const sw = Math.sin(ph + j * 2.1 + (s > 0 ? Math.PI / 2 : 0)) * 8;
      const bx = -12 + j * 9, kx = bx + (j - 1) * 8 + sw, ky = s * (20 + j * 2), fx = kx + sw * 0.8 + (j - 1) * 6, fy = s * (31 + j);
      line(c, [bx, s * 5, kx, ky, fx, fy]);
    }
    c.lineWidth = 2.4;
    for (const s of [-1, 1]) {
      const sw = Math.sin(ph * 0.8 + (s > 0 ? 0 : Math.PI)) * 7;
      const ex = 20 + sw, ey = s * (atk ? 16 : 24), hx = atk ? 54 : (hunt ? 46 : 30) + sw, hy = s * (atk ? 5 : hunt ? 14 : 30);
      line(c, [8, s * 8, ex, ey, hx, hy]);
      c.lineWidth = 1.3; for (let f = -1; f <= 1; f++) line(c, [hx, hy, hx + 10, hy + f * 4 + s * 2]); c.lineWidth = 2.4;
    }
    c.fillStyle = '#080606'; ell(c, 0, 0, 21, 11);
    c.strokeStyle = 'rgba(110,15,15,.55)'; c.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 5, -9); c.quadraticCurveTo(i * 5 + 2, 0, i * 5, 9); c.stroke(); }
    c.fillStyle = '#050303';
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-16 + i * 7, -2); c.lineTo(-19 + i * 7, -11 - (i % 2) * 4); c.lineTo(-12 + i * 7, -2); c.fill(); }
    c.fillStyle = '#0d0909'; ell(c, 19, 0, 10, 7.5);
    if (hunt) { // split jaw full of teeth
      const o = atk ? 5 : 3; c.fillStyle = '#3a0000'; ell(c, 26, 0, 4, o);
      c.fillStyle = '#d8cfc0'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(24, i * 1.5); c.lineTo(28, i * 1.5 + 0.6); c.lineTo(24, i * 1.5 + 1.1); c.fill(); }
    }
  }
  // ---------------- Weeper ----------------
  function weeper(c, m, t, hunt, atk) {
    const sway = Math.sin(t * 1.3 + m.id);
    c.strokeStyle = 'rgba(4,4,4,.95)'; c.lineWidth = 1.5; c.lineCap = 'round';
    for (let i = 0; i < 26; i++) { // hair pooling behind her
      const a = Math.PI + (i / 25 - 0.5) * 2.1, L = 30 + ((i * 7) % 11) * 2.4;
      const ex = Math.cos(a) * L, ey = Math.sin(a) * L + sway * 3;
      c.beginPath(); c.moveTo(8, 0); c.quadraticCurveTo(ex * 0.5, ey * 0.5 + Math.sin(t * 2 + i) * 4, ex, ey); c.stroke();
    }
    c.fillStyle = 'rgba(210,205,195,.9)'; c.beginPath();
    for (let i = 0; i <= 18; i++) { const a = (i / 18) * TAU, r = 13 + (i % 2 ? 3.5 : -1) + Math.sin(t * 3 + i) * 1.2;
      const x = Math.cos(a) * r * 1.2 - 4, y = Math.sin(a) * r; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.fill();
    c.fillStyle = 'rgba(100,8,8,.55)'; ell(c, -5, 4, 4, 7, 0.4); ell(c, 2, -6, 2.5, 4, -0.3);
    c.strokeStyle = '#cfc9bd'; c.lineWidth = 2;
    for (const s of [-1, 1]) {
      const reach = atk ? 44 : hunt ? 36 : 22;
      line(c, [4, s * 8, 16, s * 13, reach, s * (hunt ? 6 : 15)]);
      c.lineWidth = 1; for (let f = -1; f <= 2; f++) line(c, [reach, s * (hunt ? 6 : 15), reach + 9, s * (hunt ? 6 : 15) + f * 2.2]); c.lineWidth = 2;
    }
    c.fillStyle = '#e4e0d6'; circ(c, 11, 0, 7.5);
    c.fillStyle = '#050505'; c.beginPath(); c.arc(11, 0, 8, Math.PI * 0.45, Math.PI * 1.55); c.fill();
    c.fillStyle = '#000'; circ(c, 15, 2.7, 1.9); circ(c, 15, -2.7, 1.9); ell(c, 17.5, 0, 1.2, hunt ? 3.4 : 1.4);
    c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 0.8; line(c, [15.5, 2.7, 18.5, 3.4]); line(c, [15.5, -2.7, 18.5, -3.6]);
  }
  // ---------------- Antlered (wendigo) ----------------
  function wendigo(c, m, t, hunt, atk) {
    const ph = t * (hunt ? 7 : 2.8) + m.id;
    c.strokeStyle = '#0a0705'; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 3.3;
    for (const s of [-1, 1]) { const sw = Math.sin(ph + (s > 0 ? Math.PI : 0)) * 12; line(c, [-14, s * 7, -24 + sw, s * 20, -14 + sw * 1.4, s * 30, -9 + sw * 1.4, s * 31]); }
    for (const s of [-1, 1]) {
      const sw = Math.sin(ph * 0.7 + (s > 0 ? 0 : Math.PI)) * 8;
      const hx = atk ? 52 : hunt ? 44 + sw : 24 + sw, hy = s * (atk ? 9 : hunt ? 22 : 40);
      c.strokeStyle = '#0a0705'; c.lineWidth = 2.8; line(c, [14, s * 10, 8 + sw, s * 30, hx, hy]);
      c.strokeStyle = '#b8ad95'; c.lineWidth = 1.2; for (let f = -1; f <= 2; f++) line(c, [hx, hy, hx + 12, hy + f * 3.5]);
    }
    c.fillStyle = '#0c0907'; ell(c, 0, 0, 27, 12);
    c.strokeStyle = 'rgba(205,195,170,.55)'; c.lineWidth = 1.4;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 5, -10); c.quadraticCurveTo(i * 5 + 3, 0, i * 5, 10); c.stroke(); }
    c.lineWidth = 2; line(c, [-24, 0, 24, 0]);
    c.strokeStyle = '#0c0907'; c.lineWidth = 6; line(c, [22, 0, 29, 0]);
    c.fillStyle = '#d6cdb5'; ell(c, 32, 0, 10, 7.5); ell(c, 40, 0, 6, 4);
    c.fillStyle = '#000'; circ(c, 33, 3.5, 2.7); circ(c, 33, -3.5, 2.7);
    if (hunt) { c.strokeStyle = '#efe8d8'; c.lineWidth = 0.9; for (let i = -2; i <= 2; i++) line(c, [42, i * 1.4, 46, i * 1.4]); }
    c.strokeStyle = '#bfb49a'; c.lineWidth = 2.2;
    for (const s of [-1, 1]) {
      line(c, [29, s * 5, 22, s * 20, 10, s * 40]);
      c.lineWidth = 1.5; line(c, [23, s * 18, 32, s * 30]); line(c, [16, s * 30, 22, s * 44]); line(c, [12, s * 36, 2, s * 44]); c.lineWidth = 2.2;
    }
  }
  // ---------------- Mimic ----------------
  function mimic(c, m, t, hunt, atk, col) {
    const ph = t * (hunt ? 10 : 5) + m.id;
    c.fillStyle = '#14100e'; c.beginPath(); c.roundRect ? c.roundRect(-12, -9, 10, 18, 4) : c.rect(-12, -9, 10, 18); c.fill();
    c.fillStyle = col || '#6b6258'; ell(c, 0, 0, 11, 13);
    c.fillStyle = 'rgba(0,0,0,.35)'; ell(c, 0, 0, 11, 13);
    c.strokeStyle = '#a89580'; c.lineCap = 'round'; c.lineWidth = 2.2;
    for (const s of [-1, 1]) {
      const sw = Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 5, hx = atk ? 44 : hunt ? 38 + sw : 26 + sw, hy = s * (atk ? 6 : hunt ? 11 : 20);
      line(c, [2, s * 10, 16 + sw, s * 21, hx, hy]);
      c.lineWidth = 1; for (let f = -1; f <= 2; f++) line(c, [hx, hy, hx + 8, hy + f * 2]); c.lineWidth = 2.2;
    }
    const nk = hunt ? 22 : 12; // the neck stretches when it hunts
    c.lineWidth = 4; c.beginPath(); c.moveTo(3, 0); c.quadraticCurveTo(nk * 0.5, Math.sin(ph) * 6, nk, 0); c.stroke();
    c.fillStyle = '#c9b49c'; circ(c, nk + 3, 0, 6.5);
    c.fillStyle = col || '#6b6258'; c.beginPath(); c.arc(nk + 1, 0, 7, Math.PI * 0.55, Math.PI * 1.45); c.fill();
    if (hunt) { c.strokeStyle = '#2a0000'; c.lineWidth = 1.6; c.beginPath(); c.arc(nk + 3, 0, 4.2, -1.1, 1.1); c.stroke(); }
  }
  // ---------------- Many-Eyes ----------------
  const WEYES = Array.from({ length: 13 }, (_, i) => { const a = i * 2.39, r = 3 + (i % 4) * 4; return [Math.cos(a) * r, Math.sin(a) * r, 1.6 + (i % 3) * 0.7]; });
  function watcher(c, m, t, hunt, atk) {
    c.strokeStyle = '#120606'; c.lineCap = 'round'; c.lineWidth = 3.2;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + Math.sin(t + i) * 0.2, L = 34 + Math.sin(t * 2 + i * 1.7) * 7 + (hunt ? 10 : 0);
      c.beginPath(); c.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
      c.bezierCurveTo(Math.cos(a + 0.5) * L * 0.5, Math.sin(a + 0.5) * L * 0.5, Math.cos(a - 0.4) * L * 0.8, Math.sin(a - 0.4) * L * 0.8, Math.cos(a) * L, Math.sin(a) * L);
      c.stroke();
    }
    const pulse = 1 + Math.sin(t * 3 + m.id) * 0.06;
    c.fillStyle = '#170808'; for (let k = 0; k < 7; k++) circ(c, Math.cos(k * 0.9) * 7, Math.sin(k * 1.3) * 6, (11 + (k % 3) * 2) * pulse);
    c.fillStyle = '#2a0d0d'; circ(c, 0, 0, 12 * pulse);
    c.strokeStyle = 'rgba(120,20,20,.6)'; c.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(i) * 8, Math.sin(i * 2) * 8, Math.cos(i * 1.1) * 15, Math.sin(i * 1.1) * 15); c.stroke(); }
    WEYES.forEach(([x, y, r], i) => {
      if (((t * 0.8 + i * 1.37) % 3.7) < 0.15) { c.strokeStyle = '#000'; c.lineWidth = 1; line(c, [x - r, y, x + r, y]); return; }
      c.fillStyle = '#d8d0c0'; circ(c, x, y, r); c.fillStyle = hunt ? '#5a0000' : '#111'; circ(c, x + r * 0.35, y, r * 0.55);
    });
  }

  const ART = { crawler, weeper, wendigo, mimic, watcher };

  // Eye positions in local space (facing +x, before size scaling), drawn glowing over the darkness
  function eyes(type, m, t, hunt) {
    switch (type) {
      case 'weeper': return { pts: [[15, 2.7, 1.9], [15, -2.7, 1.9]], face: [11, 0, 8], color: '#000' };
      case 'wendigo': return { pts: [[33, 3.5, 1.5], [33, -3.5, 1.5]], color: hunt ? '#ff2a1a' : '#ffd9a0' };
      case 'mimic': { const nk = hunt ? 22 : 12; return { pts: [[nk + 5, 2.3, 1.1], [nk + 5, -2.3, 1.1]], color: '#ffffff', grin: hunt ? [nk + 3, 0, 4.2] : null }; }
      case 'watcher': return { pts: WEYES.filter((_, i) => ((t * 0.8 + i * 1.37) % 3.7) >= 0.15), color: hunt ? '#ff3030' : '#f2e6b0', many: true };
      default: return { pts: [[21, 3.6, 1.8], [21, -3.6, 1.8]], color: hunt ? '#ff3030' : 'rgba(235,235,220,.9)' };
    }
  }

  return { draw(c, type, m, t, hunt, atk, col) { (ART[type] || crawler)(c, m, t, hunt, atk, col); }, eyes };
})();
