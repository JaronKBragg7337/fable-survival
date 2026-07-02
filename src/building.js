// ============================================================
// BUILDING SYSTEM - place floors, walls, doors, campfires, storage.
// Flow: ui build panel -> enterMode(pieceId) -> ghost follows player,
// snapped to a 1m grid -> 'interact' places, 'attack' cancels.
// Each placed piece gets: mesh, optional collider, optional
// interactable (door toggle / storage open), and is serialized
// by save.js.
// To add a piece: add to PIECES + a case in _makeMesh/_finalize.
// ============================================================
import * as THREE from 'three';
import { Inventory } from './inventory.js';
import { ITEMS } from './items.js';

export const PIECES = {
  floor:    { name: 'Floor',       icon: '🟫', cost: { wood: 4 } },
  wall:     { name: 'Wall',        icon: '🧱', cost: { wood: 6 } },
  door:     { name: 'Doorway',     icon: '🚪', cost: { wood: 8 } },
  campfire: { name: 'Campfire',    icon: '🔥', cost: { wood: 5, stone: 3 } },
  storage:  { name: 'Storage Box', icon: '📦', cost: { wood: 10 } }
};

export class Buildings {
  constructor(game) {
    this.game = game;
    this.placed = [];      // { piece, x, y, z, rotY, ... }
    this.mode = null;      // active piece id while placing
    this.ghost = null;
    this.valid = false;
  }

  costText(id) {
    return Object.entries(PIECES[id].cost).map(([k, n]) => `${n}${ITEMS[k].icon}`).join(' ');
  }

  canAfford(id) {
    return Object.entries(PIECES[id].cost).every(([k, n]) => this.game.inventory.has(k, n));
  }

  enterMode(id) {
    this.exitMode();
    this.mode = id;
    this.ghost = this._makeMesh(id, true);
    this.game.scene.add(this.ghost);
    this.game.ui.toast(`Placing ${PIECES[id].name} — USE to place, HIT to cancel`);
  }

  exitMode() {
    if (this.ghost) { this.game.scene.remove(this.ghost); this.ghost = null; }
    this.mode = null;
  }

  // Ghost follows a point 3m in front of the player, snapped to grid.
  update() {
    if (!this.mode) return;
    const p = this.game.player.pos, yaw = this.game.player.mesh.rotation.y;
    const x = Math.round(p.x + Math.sin(yaw) * 3);
    const z = Math.round(p.z + Math.cos(yaw) * 3);
    const rotY = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
    this.ghost.position.set(x, 0, z);
    this.ghost.rotation.y = rotY;

    this.valid = this._isValid(x, z);
    this.ghost.traverse(o => {
      if (o.isMesh) o.material.color.setHex(this.valid ? 0x44cc55 : 0xcc4444);
    });
    this._pending = { x, z, rotY };
  }

  _isValid(x, z) {
    if (this.game.world.isInSafeZone(x, z)) return false;
    const B = this.game.world.halfSize - 3;
    if (Math.abs(x) > B || Math.abs(z) > B) return false;
    // don't stack on an existing piece of the same footprint
    for (const pl of this.placed) {
      if (Math.abs(pl.x - x) < 0.6 && Math.abs(pl.z - z) < 0.6 && pl.piece === this.mode) return false;
    }
    // keep clear of solid colliders (allow being near floors)
    for (const c of this.game.colliders) {
      if (c.disabled || c.box) continue;
      if (Math.hypot(c.x - x, c.z - z) < c.r + 0.8) return false;
    }
    return true;
  }

  place() {
    if (!this.mode || !this._pending) return;
    if (!this.valid) { this.game.ui.toast('Cannot place here.'); return; }
    const id = this.mode;
    if (!this.canAfford(id)) { this.game.ui.toast(`Need ${this.costText(id)}`); return; }
    for (const [k, n] of Object.entries(PIECES[id].cost)) this.game.inventory.remove(k, n);

    const { x, z, rotY } = this._pending;
    this._instantiate({ piece: id, x, z, rotY });
    this.game.ui.toast(`${PIECES[id].name} placed!`);
    // stay in build mode so you can chain-place walls
    if (!this.canAfford(id)) this.exitMode();
  }

  // Creates mesh + collider + interactable for a piece record and
  // stores it in this.placed. Used by place() and save-loading.
  _instantiate(rec) {
    const mesh = this._makeMesh(rec.piece, false);
    mesh.position.set(rec.x, 0, rec.z);
    mesh.rotation.y = rec.rotY;
    this.game.scene.add(mesh);
    rec.mesh = mesh;

    const rotated = Math.abs(Math.sin(rec.rotY)) > 0.5; // 90/270 degrees
    switch (rec.piece) {
      case 'wall': {
        rec.col = { box: true, x: rec.x, z: rec.z, hx: rotated ? 0.12 : 1, hz: rotated ? 1 : 0.12 };
        this.game.colliders.push(rec.col);
        break;
      }
      case 'door': {
        rec.open = rec.open ?? false;
        rec.col = { box: true, x: rec.x, z: rec.z, hx: rotated ? 0.12 : 1, hz: rotated ? 1 : 0.12, disabled: rec.open };
        this.game.colliders.push(rec.col);
        this._applyDoorVisual(rec);
        this.game.interactables.push({
          x: rec.x, z: rec.z, r: 2.2,
          label: () => rec.open ? '🚪 Close door' : '🚪 Open door',
          onInteract: () => { rec.open = !rec.open; rec.col.disabled = rec.open; this._applyDoorVisual(rec); }
        });
        break;
      }
      case 'storage': {
        rec.inv = new Inventory(12);
        if (rec.invData) rec.inv.fromJSON(rec.invData);
        this.game.colliders.push({ x: rec.x, z: rec.z, r: 0.55 });
        this.game.interactables.push({
          x: rec.x, z: rec.z, r: 2.2,
          label: '📦 Open storage',
          onInteract: () => this.game.ui.openStorage(rec.inv)
        });
        break;
      }
      case 'campfire': {
        const light = new THREE.PointLight(0xff8c33, 1.1, 9);
        light.position.y = 1;
        mesh.add(light);
        this.game.colliders.push({ x: rec.x, z: rec.z, r: 0.5 });
        break;
      }
    }
    this.placed.push(rec);
  }

  _applyDoorVisual(rec) {
    // open door slides down to a stub so you can walk through
    rec.mesh.scale.y = rec.open ? 0.08 : 1;
  }

  _makeMesh(id, ghost) {
    const mat = c => new THREE.MeshLambertMaterial({ color: c, transparent: ghost, opacity: ghost ? 0.55 : 1 });
    const g = new THREE.Group();
    switch (id) {
      case 'floor': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(2, 0.14, 2), mat(0x8a6b42)); m.position.y = 0.07;
        g.add(m); break;
      }
      case 'wall': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 0.2), mat(0x9c7c50)); m.position.y = 1.2;
        g.add(m); break;
      }
      case 'door': {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 0.2), mat(0x7a5c38)); frame.position.y = 1.2;
        const knob = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), mat(0xd9c36a)); knob.position.set(0.6, 1.1, 0);
        g.add(frame, knob); break;
      }
      case 'campfire': {
        const fire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.65, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: ghost, opacity: ghost ? 0.55 : 1 }));
        fire.position.y = 0.33;
        for (let i = 0; i < 4; i++) {
          const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), mat(0x777777));
          const a = i / 4 * Math.PI * 2;
          st.position.set(Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5);
          g.add(st);
        }
        g.add(fire); break;
      }
      case 'storage': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.7), mat(0xb08d57)); m.position.y = 0.4;
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.1, 0.74), mat(0x8a6b42)); lid.position.y = 0.85;
        g.add(m, lid); break;
      }
    }
    return g;
  }

  toJSON() {
    return this.placed.map(r => ({
      piece: r.piece, x: r.x, z: r.z, rotY: r.rotY,
      open: r.open, invData: r.inv ? r.inv.toJSON() : undefined
    }));
  }

  fromJSON(data) {
    if (!Array.isArray(data)) return;
    for (const rec of data) this._instantiate({ ...rec });
  }
}
