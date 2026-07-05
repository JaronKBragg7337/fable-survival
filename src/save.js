// ============================================================
// SAVE / LOAD - localStorage JSON snapshot, autosaved every 25s.
// World layout is seeded/deterministic so we only save dynamic
// state: player, stats, inventory, coins, time, buildings, vehicles.
// To expand: switch to IndexedDB for bigger saves, or add multiple
// save slots by parameterizing KEY.
// ============================================================
const KEY = 'fable_survival_v1';
const AUTOSAVE = 25; // seconds

export class SaveSystem {
  constructor(game) {
    this.game = game;
    this.timer = AUTOSAVE;
  }

  snapshot() {
    const g = this.game;
    return {
      v: 1,
      stats: g.stats.toJSON(),
      inv: g.inventory.toJSON(),
      coins: g.coins,
      pos: { x: g.player.pos.x, z: g.player.pos.z },
      dayNight: g.dayNight.toJSON(),
      buildings: g.buildings.toJSON(),
      vehicles: g.vehicles.toJSON()
    };
  }

  writeLocal(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  readLocal() {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  }

  apply(data) {
    const g = this.game;
    if (!data || typeof data !== 'object') return false;
    if (data.stats) g.stats.fromJSON(data.stats);
    if (data.inv) g.inventory.fromJSON(data.inv);
    if (typeof data.coins === 'number') g.coins = data.coins;
    if (data.pos) { g.player.pos.x = data.pos.x; g.player.pos.z = data.pos.z; }
    g.dayNight.fromJSON(data.dayNight);
    g.buildings.fromJSON(data.buildings);
    g.vehicles.fromJSON(data.vehicles);
    return true;
  }

  save(quiet = false) {
    const g = this.game;
    try {
      const data = this.snapshot();
      this.writeLocal(data);
      try { g.cloudSave?.onLocalSave(data); } catch { /* cloud save is best-effort */ }
      if (!quiet) g.ui.toast('💾 Game saved');
    } catch (e) {
      if (!quiet) g.ui.toast('Save failed (storage unavailable).');
    }
  }

  load() {
    try {
      const data = this.readLocal();
      return this.apply(data);
    } catch (e) {
      return false;
    }
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = AUTOSAVE; this.save(true); }
  }

  clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
}
