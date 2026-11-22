// =====================================================
//  LAST EMBER — networking (PeerJS / WebRTC, host-authoritative)
//  The host's browser runs the simulation; clients send input.
//  No server of your own is needed (uses the free PeerJS cloud broker).
// =====================================================
const Net = {
  role: 'solo',     // 'solo' | 'host' | 'client'
  peer: null,
  conns: new Map(), // host: peerId -> DataConnection
  conn: null,       // client: connection to host
  code: '',
  handlers: {},

  available() { return typeof Peer !== 'undefined'; },

  makeCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
    for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  },

  host(h, tries = 0) {
    this.role = 'host'; this.handlers = h; this.code = this.makeCode();
    this.peer = new Peer(CONFIG.ROOM_PREFIX + this.code, { debug: 0 });
    this.peer.on('open', () => h.onReady && h.onReady(this.code));
    this.peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && tries < 4) { this.peer.destroy(); return this.host(h, tries + 1); }
      h.onError && h.onError(e.type || String(e));
    });
    this.peer.on('connection', (c) => {
      c.on('open', () => {
        if (this.conns.size >= 3) { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); return; }
        this.conns.set(c.peer, c); h.onJoin && h.onJoin(c.peer);
      });
      c.on('data', (m) => h.onMsg && h.onMsg(c.peer, m));
      const bye = () => { if (this.conns.delete(c.peer)) h.onLeave && h.onLeave(c.peer); };
      c.on('close', bye); c.on('error', bye);
    });
  },

  join(code, h) {
    this.role = 'client'; this.handlers = h; this.code = code.toUpperCase().trim();
    this.peer = new Peer(undefined, { debug: 0 });
    this.peer.on('open', () => {
      this.conn = this.peer.connect(CONFIG.ROOM_PREFIX + this.code, { reliable: true });
      const to = setTimeout(() => h.onError && h.onError('Room not found / no answer'), 9000);
      this.conn.on('open', () => { clearTimeout(to); h.onOpen && h.onOpen(); });
      this.conn.on('data', (m) => h.onMsg && h.onMsg(m));
      this.conn.on('close', () => h.onClose && h.onClose());
      this.conn.on('error', () => h.onClose && h.onClose());
    });
    this.peer.on('error', (e) => h.onError && h.onError(e.type === 'peer-unavailable' ? 'Room not found' : (e.type || String(e))));
  },

  send(m) { if (this.conn && this.conn.open) this.conn.send(m); },
  sendTo(id, m) { const c = this.conns.get(id); if (c && c.open) c.send(m); },
  broadcast(m) { for (const c of this.conns.values()) if (c.open) c.send(m); },

  close() {
    try { if (this.peer) this.peer.destroy(); } catch (e) {}
    this.peer = null; this.conn = null; this.conns.clear(); this.role = 'solo';
  }
};
