// ============================================================
// PICKUPS - pooled ground items that can be collected by walking
// over them or pressing USE nearby. Keeps drops tangible without
// allocating meshes during play.
// To expand: serialize active pickups, add rarity beams, or let
// containers spill overflow here when the backpack is full.
// ============================================================
import * as THREE from 'three';
import { ITEMS } from './items.js';

const POOL_SIZE = 32;
const PICKUP_R = 1.6;

const ITEM_COLORS = {
  wood: 0x8a5a32,
  stone: 0x8d8d94,
  scrap: 0xb0a270,
  can: 0xb94a3a,
  water: 0x4aa3cf,
  bandage: 0xf2f0df,
  axe: 0xb46b3b,
  pickaxe: 0x7e8790,
  fuel: 0xd46a30,
  battery: 0x6bb06b,
  wheel: 0x2c2f35
};

export class Pickups {
  constructor(game) {
    this.game = game;
    this.pool = [];
    this.fullToastT = 0;
    for (let i = 0; i < POOL_SIZE; i++) this.pool.push(this._makePickup());
  }

  _makePickup() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.55), mat);
    body.position.y = 0.16;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 5), mat);
    stem.position.y = 0.48;
    g.add(body, stem);
    g.visible = false;
    this.game.scene.add(g);

    const p = {
      active: false,
      id: null,
      count: 0,
      x: 9999,
      z: 9999,
      bob: Math.random() * Math.PI * 2,
      mesh: g,
      mat,
      interactable: null
    };

    p.interactable = {
      x: p.x,
      z: p.z,
      r: PICKUP_R,
      label: () => p.active ? `${ITEMS[p.id].icon} Pick up ${ITEMS[p.id].name} x${p.count}` : '',
      onInteract: () => this.collect(p)
    };
    this.game.interactables.push(p.interactable);
    return p;
  }

  dropFromPlayer(id, count) {
    const facing = this.game.player.mesh.rotation.y;
    const x = this.game.player.pos.x + Math.sin(facing) * 1.2;
    const z = this.game.player.pos.z + Math.cos(facing) * 1.2;
    return this.spawn(id, count, x, z);
  }

  spawn(id, count, x, z) {
    if (!ITEMS[id] || count <= 0) return false;
    const p = this.pool.find(x => !x.active);
    if (!p) {
      this.game.ui.toast('No room on the ground for more drops.');
      return false;
    }
    p.active = true;
    p.id = id;
    p.count = count;
    p.x = x + (Math.random() - 0.5) * 0.3;
    p.z = z + (Math.random() - 0.5) * 0.3;
    p.mat.color.setHex(ITEM_COLORS[id] ?? 0xffffff);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.visible = true;
    p.interactable.x = p.x;
    p.interactable.z = p.z;
    p.interactable.r = PICKUP_R;
    return true;
  }

  collect(p) {
    if (!p.active) return;
    const def = ITEMS[p.id];
    const left = this.game.inventory.add(p.id, p.count);
    const taken = p.count - left;
    if (taken > 0) this.game.ui.toast(`Picked up +${taken} ${def.icon}`);
    if (left <= 0) this._clear(p);
    else {
      p.count = left;
      if (this.fullToastT <= 0) {
        this.fullToastT = 1.5;
        this.game.ui.toast('Backpack full.');
      }
    }
  }

  _clear(p) {
    p.active = false;
    p.id = null;
    p.count = 0;
    p.x = 9999;
    p.z = 9999;
    p.mesh.visible = false;
    p.interactable.x = p.x;
    p.interactable.z = p.z;
    p.interactable.r = 0;
  }

  update(dt) {
    this.fullToastT = Math.max(0, this.fullToastT - dt);
    const pos = this.game.player.pos;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.bob += dt * 3;
      p.mesh.position.y = Math.sin(p.bob) * 0.06;
      if (Math.hypot(p.x - pos.x, p.z - pos.z) < 0.85) this.collect(p);
    }
  }
}
