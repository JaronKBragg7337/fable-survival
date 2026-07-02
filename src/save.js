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

  save(quiet = false) {
    const g = this.game;
    try {
      const data = {
        v: 1,
        stats: g.stats.toJSON(),
        inv: g.inventory.toJSON(),
        coins: g.coins,
        pos: { x: g.player.pos.x, z: g.player.pos.z },
        dayNight: g.dayNight.toJSON(),
        buildings: g.buildings.toJSON(),
        vehicles: g.vehicles.toJSON()
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      if (!quiet) g.ui.toast('💾 Game saved');
    } catch (e) {
      if (!quiet) g.ui.toast('Save failed (storage unavailable).');
    }
  }

  load() {
    const g = this.game;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.stats) g.stats.fromJSON(d.stats);
      if (d.inv) g.inventory.fromJSON(d.inv);
      if (typeof d.coins === 'number') g.coins = d.coins;
      if (d.pos) { g.player.pos.x = d.pos.x; g.player.pos.z = d.pos.z; }
      g.dayNight.fromJSON(d.dayNight);
      g.buildings.fromJSON(d.buildings);
      g.vehicles.fromJSON(d.vehicles);
      return true;
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
