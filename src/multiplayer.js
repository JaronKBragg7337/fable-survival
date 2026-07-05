// ============================================================
// HEARTBEAT MULTIPLAYER - optional Supabase Realtime presence.
//
// Reuses Heartbeat Observatory's multiplayer laws:
// - Supabase Realtime broadcast, not a new server.
// - presence.track() only once for join/leave identity.
// - visible movement state broadcasts at <=10Hz with idle suppression.
// - remote players interpolate from a 250ms buffer.
// If realtime is unavailable, Fable Survival keeps running as singleplayer.
// ============================================================
import * as THREE from 'three';

const SUPA_URL = 'https://ygjpnvrwhkrowkrskftk.supabase.co';
const SUPA_KEY = 'sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN';
const GAME_CHANNEL = 'game-fable-survival-public';
const LOBBY_CHANNEL = 'observatory-games-public';
const COLORS = ['#6fbf58', '#4fa3ff', '#f6b45b', '#e36d7c', '#a67cff', '#47c7b8', '#f0d461', '#d987e8'];

export class Multiplayer {
  constructor(game) {
    this.game = game;
    this.supabase = null;
    this.channel = null;
    this.lobby = null;
    this.connected = false;
    this.lobbyConnected = false;
    this.id = getGuestId();
    this.name = defaultGuestName(this.id);
    this.color = COLORS[hash(this.id) % COLORS.length];
    this.remotes = new Map();
    this.lobbyIds = new Set();
    this.sendAccumulator = 0;
    this.lastSentSig = '';
    this.lastSentAt = 0;
    this.lastBuildSnapshotAt = new Map();
    this.reconnectTimer = null;
    this.action = '';
    this.actionUntil = 0;
    this.chip = document.getElementById('mp-chip');
    this.setChip('solo');
    this.connect();
    window.addEventListener('pagehide', () => this.disconnect());
  }

  async connect() {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      this.supabase = createClient(SUPA_URL, SUPA_KEY, {
        realtime: { params: { eventsPerSecond: 24 } }
      });
      await this.loadHeartbeatIdentity();
      this.connectGameChannel();
      this.connectLobbyChannel();
    } catch (e) {
      this.connected = false;
      this.setChip('solo');
    }
  }

  async loadHeartbeatIdentity() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      this.id = uid;
      const { data } = await this.supabase
        .from('world_characters')
        .select('display_name, appearance')
        .eq('auth_user_id', uid)
        .maybeSingle();
      this.name = sanitize(data?.display_name) || sanitize(session.user.email) || this.name;
      const appearance = normalizeAppearance(data?.appearance);
      if (appearance?.color) this.color = appearance.color;
    } catch (e) {
      // Fable still works with a guest identity.
    }
  }

  connectGameChannel() {
    if (!this.supabase || this.channel) return;
    this.channel = this.supabase.channel(GAME_CHANNEL, {
      config: {
        presence: { key: this.id },
        broadcast: { self: false }
      }
    });
    this.channel.on('broadcast', { event: 'state' }, ({ payload }) => this.applyPeerState(payload));
    this.channel.on('broadcast', { event: 'build' }, ({ payload }) => this.applyBuildEvent(payload));
    this.channel.on('broadcast', { event: 'build-snapshot' }, ({ payload }) => this.applyBuildSnapshot(payload));
    this.channel.on('presence', { event: 'sync' }, () => this.syncPresence());
    this.channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      for (const p of leftPresences || []) {
        const id = p.id || p.key;
        if (id && id !== this.id) this.removeRemote(id);
      }
      this.updateChip();
    });
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.connected = true;
        this.trackSelf();
        this.sendState(true);
        this.broadcastBuildSnapshot();
        this.updateChip();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this.connected = false;
        this.updateChip();
        this.scheduleReconnect();
      }
    });
  }

  connectLobbyChannel() {
    if (!this.supabase || this.lobby) return;
    this.lobby = this.supabase.channel(LOBBY_CHANNEL, {
      config: {
        presence: { key: 'fable:' + this.id },
        broadcast: { self: false }
      }
    });
    this.lobby.on('presence', { event: 'sync' }, () => this.syncLobbyPresence());
    this.lobby.on('presence', { event: 'join' }, () => this.syncLobbyPresence());
    this.lobby.on('presence', { event: 'leave' }, () => this.syncLobbyPresence());
    this.lobby.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.lobbyConnected = true;
        this.trackLobby();
        this.syncLobbyPresence();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this.lobbyConnected = false;
        this.updateChip();
      }
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      try { if (this.channel) this.supabase.removeChannel(this.channel); } catch (e) {}
      this.channel = null;
      this.connectGameChannel();
    }, 2200);
  }

  disconnect() {
    try { this.channel?.untrack(); } catch (e) {}
    try { this.lobby?.untrack(); } catch (e) {}
  }

  trackSelf() {
    try {
      this.channel.track({
        id: this.id,
        name: this.name,
        color: this.color,
        game: 'fable-survival'
      });
    } catch (e) {}
  }

  trackLobby() {
    try {
      this.lobby.track({
        id: 'fable:' + this.id,
        playerId: this.id,
        name: this.name,
        color: this.color,
        game: 'fable-survival',
        label: 'Fable Survival'
      });
    } catch (e) {}
  }

  markAction(action) {
    this.action = action;
    this.actionUntil = performance.now() + 360;
    this.sendState(true);
  }

  broadcastBuild(rec) {
    if (!this.connected || !this.channel || !rec) return;
    try {
      this.channel.send({
        type: 'broadcast',
        event: 'build',
        payload: {
          id: this.id,
          rec: {
            piece: rec.piece,
            x: rec.x,
            z: rec.z,
            rotY: rec.rotY,
            open: rec.open
          }
        }
      });
    } catch (e) {}
  }

  broadcastBuildSnapshot(toId = '') {
    if (!this.connected || !this.channel || !this.game.buildings?.placed?.length) return;
    const key = toId || '*';
    const now = performance.now();
    const last = this.lastBuildSnapshotAt.get(key);
    if (last && now - last < 4000) return;
    this.lastBuildSnapshotAt.set(key, now);
    const records = this.game.buildings.placed
      .slice(0, 120)
      .map((rec) => ({
        piece: rec.piece,
        x: rec.x,
        z: rec.z,
        rotY: rec.rotY,
        open: !!rec.open
      }));
    try {
      this.channel.send({
        type: 'broadcast',
        event: 'build-snapshot',
        payload: { id: this.id, to: toId || '', records }
      });
    } catch (e) {}
  }

  applyBuildEvent(payload) {
    if (!payload || payload.id === this.id || !payload.rec || !this.game.buildings) return;
    if (this.applyBuildRecord(payload.rec)) this.game.ui.toast('A survivor built nearby.');
  }

  applyBuildSnapshot(payload) {
    if (!payload || payload.id === this.id || !this.game.buildings) return;
    if (payload.to && payload.to !== this.id) return;
    const records = Array.isArray(payload.records) ? payload.records.slice(0, 120) : [];
    let added = 0;
    for (const rec of records) {
      if (this.applyBuildRecord(rec)) added++;
    }
    if (added) this.game.ui.toast(`A survivor shared ${added} build ${added === 1 ? 'piece' : 'pieces'}.`);
  }

  applyBuildRecord(r) {
    if (!r || !r.piece || !Number.isFinite(r.x) || !Number.isFinite(r.z)) return false;
    const exists = this.game.buildings.placed.some((p) =>
      p.piece === r.piece && Math.abs(p.x - r.x) < 0.01 && Math.abs(p.z - r.z) < 0.01
    );
    if (!exists) {
      this.game.buildings._instantiate({
        piece: r.piece,
        x: r.x,
        z: r.z,
        rotY: Number.isFinite(r.rotY) ? r.rotY : 0,
        open: !!r.open,
        remote: true
      });
      return true;
    }
    return false;
  }

  update(dt) {
    this.sendAccumulator += dt;
    if (this.action && performance.now() > this.actionUntil) this.action = '';
    this.updateRemotes(dt);
    if (this.game.started) this.sendState(false);
  }

  localState() {
    const p = this.game.player;
    const vehicle = p.inVehicle || this.game.vehicles?.activeVehicle || null;
    const driving = !!(vehicle && vehicle.mesh);
    const pos = driving ? vehicle.mesh.position : p.pos;
    const yaw = driving ? vehicle.mesh.rotation.y : p.mesh.rotation.y;
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      game: 'fable-survival',
      mode: driving ? 'vehicle' : 'foot',
      vehicleId: driving ? String(vehicle.id || 'vehicle') : '',
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw,
      moving: !!p.moving,
      sprinting: !!p.sprinting,
      dead: !!this.game.stats.dead,
      action: this.action
    };
  }

  sendState(force = false) {
    if (!this.connected || !this.channel || !this.game.started) return;
    if (!force && this.sendAccumulator < 0.1) return;
    const state = this.localState();
    const sig = [
      state.x.toFixed(2),
      state.y.toFixed(2),
      state.z.toFixed(2),
      state.yaw.toFixed(2),
      state.mode || 'foot',
      state.vehicleId || '',
      state.moving ? 1 : 0,
      state.sprinting ? 1 : 0,
      state.dead ? 1 : 0,
      state.action || ''
    ].join('|');
    if (!force && sig === this.lastSentSig && performance.now() - this.lastSentAt < 5000) return;
    this.lastSentSig = sig;
    this.lastSentAt = performance.now();
    this.sendAccumulator = 0;
    try {
      this.channel.send({ type: 'broadcast', event: 'state', payload: state });
    } catch (e) {}
  }

  applyPeerState(state) {
    if (!validState(state) || state.id === this.id) return;
    let remote = this.remotes.get(state.id);
    if (!remote) {
      remote = createRemote(this.game.scene, state);
      this.remotes.set(state.id, remote);
      this.broadcastBuildSnapshot(state.id);
      this.updateChip();
    }
    const now = performance.now();
    remote.name = sanitize(state.name) || remote.name;
    remote.mode = state.mode === 'vehicle' ? 'vehicle' : 'foot';
    remote.vehicleId = sanitize(state.vehicleId) || '';
    remote.target.set(state.x, state.y, state.z);
    remote.targetYaw = Number.isFinite(state.yaw) ? state.yaw : remote.targetYaw;
    remote.targetScaleY = state.dead ? 0.18 : 1;
    remote.action = state.action || '';
    remote.lastUpdate = now;
    remote.buf.push({
      t: now,
      x: state.x,
      y: state.y,
      z: state.z,
      yaw: remote.targetYaw,
      mode: remote.mode,
      dead: !!state.dead,
      action: remote.action
    });
    if (remote.buf.length > 10) remote.buf.shift();
  }

  syncPresence() {
    if (!this.channel) return;
    const live = new Set();
    const state = this.channel.presenceState();
    for (const key in state) {
      const meta = state[key]?.[0];
      const id = meta?.id || key;
      if (id && id !== this.id) live.add(id);
    }
    for (const id of [...this.remotes.keys()]) {
      if (!live.has(id) && performance.now() - this.remotes.get(id).lastUpdate > 5000) this.removeRemote(id);
    }
    this.updateChip();
  }

  syncLobbyPresence() {
    if (!this.lobby) return;
    this.lobbyIds.clear();
    const state = this.lobby.presenceState();
    for (const key in state) {
      const meta = state[key]?.[0];
      const id = meta?.id || key;
      if (id) this.lobbyIds.add(id);
    }
    this.updateChip();
  }

  updateRemotes(dt) {
    const blend = Math.min(1, dt * 12);
    const renderT = performance.now() - 250;
    for (const [id, remote] of this.remotes) {
      if (performance.now() - remote.lastUpdate > 20000) {
        this.removeRemote(id);
        continue;
      }
      const buf = remote.buf;
      if (buf.length >= 2 && buf[buf.length - 1].t >= renderT) {
        while (buf.length > 2 && buf[1].t <= renderT) buf.shift();
        const a = buf[0], b = buf[1] || a;
        if (b.t - a.t > 1200) {
          buf.splice(0, buf.length - 1);
          remote.mesh.position.set(b.x, b.y, b.z);
          remote.mesh.rotation.y = b.yaw;
          remote.mode = b.mode === 'vehicle' ? 'vehicle' : 'foot';
        } else {
          const span = Math.max(1, b.t - a.t);
          const k = Math.max(0, Math.min(1, (renderT - a.t) / span));
          remote.mesh.position.set(
            a.x + (b.x - a.x) * k,
            a.y + (b.y - a.y) * k,
            a.z + (b.z - a.z) * k
          );
          remote.mesh.rotation.y = lerpAngle(a.yaw, b.yaw, k);
          remote.mode = (k > 0.5 ? b.mode : a.mode) === 'vehicle' ? 'vehicle' : 'foot';
        }
      } else if (buf.length) {
        const latest = buf[buf.length - 1];
        remote.target.set(latest.x, latest.y, latest.z);
        remote.targetYaw = latest.yaw;
        remote.mode = latest.mode === 'vehicle' ? 'vehicle' : 'foot';
        remote.mesh.position.lerp(remote.target, blend);
        remote.mesh.rotation.y = lerpAngle(remote.mesh.rotation.y, remote.targetYaw, blend);
      }
      const driving = remote.mode === 'vehicle';
      if (remote.survivor) remote.survivor.visible = !driving;
      if (remote.vehicle) remote.vehicle.visible = driving;
      remote.survivorScale.y += (remote.targetScaleY - remote.survivorScale.y) * blend;
      if (remote.survivor) remote.survivor.scale.y = remote.survivorScale.y;
      animateRemote(remote);
    }
  }

  removeRemote(id) {
    const remote = this.remotes.get(id);
    if (!remote) return;
    this.game.scene.remove(remote.mesh);
    disposeTree(remote.mesh);
    this.remotes.delete(id);
    this.updateChip();
  }

  updateChip() {
    const here = this.remotes.size;
    const games = Math.max(0, this.lobbyIds.size - 1);
    if (!this.connected) return this.setChip('solo');
    const hereText = here === 0 ? 'alone here' : here === 1 ? '1 survivor here' : `${here} survivors here`;
    const gamesText = games > here ? ` · ${games} in games` : '';
    this.setChip(`realtime · ${hereText}${gamesText}`);
  }

  setChip(text) {
    if (this.chip && this.chip.textContent !== text) this.chip.textContent = text;
  }
}

function createRemote(scene, state) {
  const mesh = new THREE.Group();
  const survivor = buildSurvivor(state.color, sanitize(state.name) || 'Survivor');
  const vehicle = buildRemoteVehicle(state.color);
  vehicle.visible = state.mode === 'vehicle';
  survivor.visible = state.mode !== 'vehicle';
  mesh.add(survivor, vehicle);
  mesh.position.set(state.x || 0, state.y || 0, state.z || 0);
  mesh.rotation.y = state.yaw || 0;
  scene.add(mesh);
  return {
    mesh,
    survivor,
    vehicle,
    survivorScale: new THREE.Vector3(1, 1, 1),
    target: mesh.position.clone(),
    targetYaw: mesh.rotation.y,
    targetScaleY: 1,
    mode: state.mode === 'vehicle' ? 'vehicle' : 'foot',
    vehicleId: sanitize(state.vehicleId) || '',
    name: sanitize(state.name) || 'Survivor',
    lastUpdate: performance.now(),
    action: '',
    buf: []
  };
}

function buildSurvivor(colorHex, name) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const shirt = new THREE.Color(colorHex || '#6fbf58');
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), mat(0xd9a066));
  head.position.y = 1.6;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.2), mat(0x2b2b33));
  legL.position.set(-0.15, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), new THREE.MeshLambertMaterial({ color: shirt }));
  armR.position.set(0.38, 1.05, 0);
  const armL = armR.clone();
  armL.position.x = -0.38;
  const label = makeNameSprite(name);
  label.position.y = 2.05;
  g.add(body, head, legL, legR, armR, armL, label);
  g.userData.armR = armR;
  g.userData.legL = legL;
  g.userData.legR = legR;
  return g;
}

function animateRemote(remote) {
  const t = performance.now();
  const swing = remote.action === 'attack' ? Math.sin(t * 0.04) * 1.35 : 0;
  if (remote.survivor?.userData?.armR) remote.survivor.userData.armR.rotation.x = -Math.abs(swing);
}

function buildRemoteVehicle(colorHex) {
  const g = new THREE.Group();
  const color = new THREE.Color(colorHex || '#4fa3ff');
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.7), mat(color));
  body.position.y = 0.75;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.7, 1.35), mat(0xd7e2ea));
  cabin.position.set(-0.25, 1.55, 0);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 1.25), mat(0xf0d461));
  nose.position.set(1.98, 1.03, 0);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 10);
  const wheelMat = mat(0x1d2026);
  for (const [x, y, z] of [[-1.15, 0.38, 0.88], [-1.15, 0.38, -0.88], [1.18, 0.38, 0.88], [1.18, 0.38, -0.88]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, y, z);
    g.add(wheel);
  }
  g.add(body, cabin, nose);
  return g;
}

function makeNameSprite(name) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '600 28px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(8,12,16,0.58)';
  const w = Math.min(246, ctx.measureText(name).width + 28);
  ctx.fillRect((256 - w) / 2, 10, w, 44);
  ctx.fillStyle = '#eef4fa';
  ctx.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.1, 0.52, 1);
  return sprite;
}

function getGuestId() {
  try {
    const key = 'hb_guest_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'guest:' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
      localStorage.setItem(key, id);
    }
    return id;
  } catch (e) {
    return 'guest:' + Math.random().toString(36).slice(2, 10);
  }
}

function defaultGuestName(id) {
  return 'Survivor ' + String(id).replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
}

function sanitize(raw) {
  const s = String(raw || '').replace(/[<>&"']/g, '').trim().slice(0, 24);
  return s || null;
}

function normalizeAppearance(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const color = typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : null;
  return color ? { color } : null;
}

function validState(s) {
  return s && typeof s.id === 'string'
    && Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z);
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
  return Math.abs(h);
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}
