// ============================================================
// CLOUD SAVE - optional transport layered over localStorage.
// Local save remains the source of truth on device. This module
// only wakes up when a future UI stores an opt-in flag + session.
// Network failures log and fall back to local play.
// ============================================================
import { GAME_VERSION } from './ui.js';
import {
  CLOUD_META_KEY,
  CLOUD_OPT_IN_KEY,
  CLOUD_SESSION_KEY
} from './cloudKeys.js';

const PUSH_DELAY = 4; // seconds; debounce autosaves/manual saves

export class CloudSave {
  constructor(game) {
    this.game = game;
    this.pendingPush = 0;
    this.latestLocal = null;
    this.pullStarted = false;
    this.pushing = false;
  }

  boot() {
    if (this.pullStarted || !this.canSync()) return;
    this.pullStarted = true;
    setTimeout(() => this.pull().catch((e) => this.log('pull failed', e)), 0);
  }

  update(dt) {
    if (!this.pendingPush) return;
    this.pendingPush -= dt;
    if (this.pendingPush > 0) return;
    this.pendingPush = 0;
    this.push().catch((e) => this.log('push failed', e));
  }

  onLocalSave(data) {
    this.latestLocal = data;
    this.writeMeta({ local_updated_at: new Date().toISOString() });
    if (this.canSync()) this.pendingPush = PUSH_DELAY;
  }

  connect(session) {
    try {
      localStorage.setItem(CLOUD_OPT_IN_KEY, '1');
      localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
    } catch { /* localStorage may be unavailable */ }
    this.pullStarted = false;
    const local = this.safeLocal();
    if (local) this.schedulePush(local);
    this.boot();
  }

  disconnect() {
    try {
      localStorage.removeItem(CLOUD_OPT_IN_KEY);
      localStorage.removeItem(CLOUD_SESSION_KEY);
    } catch { /* localStorage may be unavailable */ }
    this.pendingPush = 0;
    this.latestLocal = null;
    this.pullStarted = false;
  }

  async pull() {
    if (!this.canSync()) return false;
    const token = this.sessionToken();
    const res = await fetch('/api/save', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      this.log(`pull skipped: ${res.status}`);
      return false;
    }
    const body = await res.json().catch(() => ({}));
    const row = body?.save;
    if (!row?.save_blob) {
      const local = this.safeLocal();
      if (local) this.schedulePush(local);
      return true;
    }
    return this.reconcile(row);
  }

  async push(data = null) {
    if (!this.canSync() || this.pushing) return false;
    const save = data || this.latestLocal || this.game.save.snapshot();
    if (!save) return false;
    this.pushing = true;
    try {
      const res = await fetch('/api/save', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.sessionToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          save_blob: save,
          save_version: Number.isInteger(save.v) ? save.v : 1,
          client_version: GAME_VERSION,
          device_label: this.deviceLabel()
        })
      });
      if (!res.ok) {
        this.log(`push skipped: ${res.status}`);
        return false;
      }
      const body = await res.json().catch(() => ({}));
      this.writeMeta({
        cloud_updated_at: body?.save?.updated_at || new Date().toISOString(),
        local_updated_at: new Date().toISOString()
      });
      return true;
    } finally {
      this.pushing = false;
    }
  }

  reconcile(row) {
    const cloud = row.save_blob;
    const local = this.safeLocal();
    const cloudUpdatedAt = row.updated_at || new Date().toISOString();
    if (!local) {
      this.applyCloud(cloud, cloudUpdatedAt);
      return true;
    }
    if (stableString(local) === stableString(cloud)) {
      this.writeMeta({ cloud_updated_at: cloudUpdatedAt });
      return true;
    }

    const meta = this.readMeta();
    const localTime = Date.parse(meta.local_updated_at || '0') || 0;
    const cloudTime = Date.parse(cloudUpdatedAt) || 0;
    if (cloudTime > localTime) {
      if (this.confirmUseCloud(cloudUpdatedAt)) this.applyCloud(cloud, cloudUpdatedAt);
      return true;
    }
    if (this.confirmUploadLocal(cloudUpdatedAt)) this.schedulePush(local);
    return true;
  }

  applyCloud(save, updatedAt) {
    if (!this.game.save.apply(save)) return false;
    try { this.game.save.writeLocal(save); } catch (e) { this.log('local write failed', e); }
    this.writeMeta({
      cloud_updated_at: updatedAt,
      local_updated_at: updatedAt
    });
    this.latestLocal = save;
    this.game.ui?.toast?.('☁️ Cloud save loaded');
    return true;
  }

  schedulePush(data) {
    this.latestLocal = data;
    if (this.canSync()) this.pendingPush = PUSH_DELAY;
  }

  canSync() {
    return this.optedIn() && !!this.sessionToken() && navigator.onLine !== false;
  }

  optedIn() {
    try { return localStorage.getItem(CLOUD_OPT_IN_KEY) === '1'; }
    catch { return false; }
  }

  sessionToken() {
    try {
      const raw = localStorage.getItem(CLOUD_SESSION_KEY);
      if (!raw) return '';
      if (!raw.trim().startsWith('{')) return raw.trim();
      const session = JSON.parse(raw);
      if (session.expires_at && Date.parse(session.expires_at) <= Date.now()) return '';
      return String(session.token || '').trim();
    } catch {
      return '';
    }
  }

  readMeta() {
    try { return JSON.parse(localStorage.getItem(CLOUD_META_KEY) || '{}'); }
    catch { return {}; }
  }

  writeMeta(next) {
    try {
      localStorage.setItem(CLOUD_META_KEY, JSON.stringify({ ...this.readMeta(), ...next }));
    } catch { /* ignore */ }
  }

  safeLocal() {
    try { return this.game.save.readLocal(); }
    catch { return null; }
  }

  confirmUseCloud(updatedAt) {
    if (typeof window.confirm !== 'function') return false;
    return window.confirm(
      `A cloud save from ${formatDate(updatedAt)} is newer than this device's save. Load it here? Cancel keeps this device's save.`
    );
  }

  confirmUploadLocal(updatedAt) {
    if (typeof window.confirm !== 'function') return false;
    return window.confirm(
      `This device's save differs from the cloud save from ${formatDate(updatedAt)}. Upload this device's save to cloud? Cancel keeps both as-is.`
    );
  }

  deviceLabel() {
    const kind = this.game.input?.isTouch ? 'phone' : 'desktop';
    return `${kind} ${screen.width}x${screen.height}`;
  }

  log(message, error = null) {
    try { console.info('[cloud-save]', message, error || ''); } catch { /* ignore */ }
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'the server';
}

function stableString(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = sortValue(value[key]);
  return out;
}
