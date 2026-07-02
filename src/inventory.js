// ============================================================
// INVENTORY - slot-based with stacking.
// Used for the player (20 slots) AND placed storage boxes (12 slots).
// To expand: add weight limits, equipment slots, or hotbar by
// reading/writing the same slots array.
// ============================================================
import { ITEMS } from './items.js';

export class Inventory {
  constructor(size = 20) {
    this.size = size;
    this.slots = new Array(size).fill(null); // null | { id, count }
    this.onChange = null; // UI hook
  }

  changed() { if (this.onChange) this.onChange(); }

  // Add items; returns amount that did NOT fit.
  add(id, count = 1) {
    const def = ITEMS[id];
    if (!def) return count;
    // 1) top up existing stacks
    for (const s of this.slots) {
      if (count <= 0) break;
      if (s && s.id === id && s.count < def.stack) {
        const take = Math.min(def.stack - s.count, count);
        s.count += take; count -= take;
      }
    }
    // 2) fill empty slots
    for (let i = 0; i < this.size && count > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(def.stack, count);
        this.slots[i] = { id, count: take }; count -= take;
      }
    }
    this.changed();
    return count;
  }

  count(id) { return this.slots.reduce((s, x) => s + (x && x.id === id ? x.count : 0), 0); }
  has(id, n = 1) { return this.count(id) >= n; }

  // Remove n of item id; returns true on success (all-or-nothing).
  remove(id, n = 1) {
    if (!this.has(id, n)) return false;
    for (let i = 0; i < this.size && n > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, n);
        s.count -= take; n -= take;
        if (s.count === 0) this.slots[i] = null;
      }
    }
    this.changed();
    return true;
  }

  removeSlot(i, n = 1) {
    const s = this.slots[i];
    if (!s) return null;
    const id = s.id;
    const take = Math.min(s.count, n);
    s.count -= take;
    if (s.count === 0) this.slots[i] = null;
    this.changed();
    return { id, count: take };
  }

  toJSON() { return this.slots; }
  fromJSON(data) {
    if (!Array.isArray(data)) return;
    this.slots = new Array(this.size).fill(null);
    data.slice(0, this.size).forEach((s, i) => { if (s && ITEMS[s.id]) this.slots[i] = { id: s.id, count: s.count }; });
    this.changed();
  }
}
