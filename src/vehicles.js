// ============================================================
// VEHICLES - broken wrecks that can be repaired and driven.
// Each wreck needs: 1 fuel, 1 battery, 2 wheels. Install parts
// from your inventory via the vehicle panel. When complete, the car
// can be entered and driven: WASD / joystick to drive, E / USE to
// enter and exit. Driving is faster than sprinting and zombies
// can't catch a moving car, but the car can't attack or gather.
// ============================================================
import * as THREE from 'three';
import { ITEMS } from './items.js';

const REQUIRED = { fuel: 1, battery: 1, wheel: 2 };
const CAR_SPEED = 12.0;          // faster than sprint (6.6)
const CAR_REVERSE = 6.0;
const CAR_TURN_RATE = 2.4;       // rad/s
const CAR_EXIT_DIST = 2.5;

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.activeVehicle = null;   // the one the player is currently driving
    this._wreck('wreck_a', 9, 38, 0.3);
    this._wreck('wreck_b', -44, -8, 1.8);
  }

  _wreck(id, x, z, rotY) {
    const mat = c => new THREE.MeshLambertMaterial({ color: c });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.7), mat(0x8a4a3a)); body.position.y = 0.75;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 1.5), mat(0x6a3a30)); cabin.position.set(-0.2, 1.55, 0);
    g.add(body, cabin);
    // 3 wheels present, front-right missing (added when you install one)
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 8);
    const wheelMat = mat(0x222222);
    const wheelSpots = [[-1.2, 0.38, 0.85], [-1.2, 0.38, -0.85], [1.2, 0.38, -0.85], [1.2, 0.38, 0.85]];
    const wheels = wheelSpots.map(([wx, wy, wz], i) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2; w.position.set(wx, wy, wz);
      w.visible = i < 2; // two wheels missing -> matches REQUIRED.wheel = 2
      g.add(w);
      return w;
    });
    g.position.set(x, 0, z); g.rotation.y = rotY;
    // wreck sits tilted because of the missing wheels
    g.rotation.z = 0.045;
    this.game.scene.add(g);
    this.game.colliders.push({ box: true, x, z, hx: 1.9, hz: 1.4 });

    const v = { id, x, z, mesh: g, bodyMat: body.material, wheels, installed: { fuel: 0, battery: 0, wheel: 0 }, repaired: false, driving: false };
    this.list.push(v);
    this.game.interactables.push({
      x, z, r: 2.8,
      label: () => {
        if (v.driving) return '🚗 Exit car';
        if (v.repaired) return '🚗 Enter car';
        return '🚗 Inspect wreck';
      },
      onInteract: () => {
        if (v.driving) this.exitVehicle(v);
        else if (v.repaired) this.enterVehicle(v);
        else this.game.ui.openVehicle(v);
      }
    });
  }

  required() { return REQUIRED; }

  install(v, part) {
    if (v.installed[part] >= REQUIRED[part]) return;
    if (!this.game.inventory.remove(part, 1)) {
      this.game.ui.toast(`You need a ${ITEMS[part].icon} ${ITEMS[part].name}.`);
      return;
    }
    v.installed[part]++;
    this._applyVisual(v);
    this.game.ui.toast(`Installed ${ITEMS[part].icon} ${ITEMS[part].name}`);
    if (Object.keys(REQUIRED).every(k => v.installed[k] >= REQUIRED[k])) {
      v.repaired = true;
      this._applyVisual(v);
      this.game.ui.toast('🚗 The engine sputters to life! Interact to enter.');
    }
    this.game.ui.renderVehicle(v);
  }

  _applyVisual(v) {
    // show installed wheels, level the car, fresh paint when repaired
    v.wheels[2].visible = v.installed.wheel >= 1;
    v.wheels[3].visible = v.installed.wheel >= 2;
    v.mesh.rotation.z = v.installed.wheel >= 2 ? 0 : 0.045;
    if (v.repaired) v.bodyMat.color.setHex(0x3a6a8a);
  }

  // ---------- driving ----------
  enterVehicle(v) {
    if (!v.repaired || v.driving) return;
    const p = this.game.player;
    v.driving = true;
    this.activeVehicle = v;
    p.inVehicle = v;
    p.mesh.visible = false;
    this.game.ui.toast('🚗 Driving — WASD / stick to drive, E / USE to exit');
    this.game.ui.closeAll();
  }

  exitVehicle(v) {
    if (!v.driving) return;
    const p = this.game.player;
    v.driving = false;
    this.activeVehicle = null;
    p.inVehicle = null;
    // place player beside the car
    const exitAngle = v.mesh.rotation.y + Math.PI / 2;
    p.pos.set(v.mesh.position.x + Math.sin(exitAngle) * CAR_EXIT_DIST, 0, v.mesh.position.z + Math.cos(exitAngle) * CAR_EXIT_DIST);
    p.mesh.visible = true;
    this.game.ui.toast('Exited car');
  }

  update(dt) {
    if (!this.activeVehicle) return;
    const v = this.activeVehicle;
    const input = this.game.input;
    const move = input.move;

    // forward/backward
    const fwd = move.z;
    const speed = fwd > 0 ? CAR_SPEED : fwd < 0 ? -CAR_REVERSE : 0;
    if (Math.abs(fwd) > 0.1) {
      const s = speed * dt;
      v.mesh.position.x += Math.sin(v.mesh.rotation.y) * s;
      v.mesh.position.z += Math.cos(v.mesh.rotation.y) * s;
    }

    // turn (only when moving, like a real car)
    const turn = move.x;
    if (Math.abs(turn) > 0.1 && Math.abs(fwd) > 0.05) {
      const dir = fwd < 0 ? -1 : 1; // reverse turns opposite
      v.mesh.rotation.y += turn * CAR_TURN_RATE * dir * dt;
    }

    // world bounds
    const B = this.game.world.halfSize - 3;
    v.mesh.position.x = Math.max(-B, Math.min(B, v.mesh.position.x));
    v.mesh.position.z = Math.max(-B, Math.min(B, v.mesh.position.z));

    // update collider to follow car
    const col = this.game.colliders.find(c => c.box && Math.abs(c.x - v.x) < 1 && Math.abs(c.z - v.z) < 1);
    if (col) { col.x = v.mesh.position.x; col.z = v.mesh.position.z; }
    v.x = v.mesh.position.x;
    v.z = v.mesh.position.z;

    // update interactable position
    const inter = this.game.interactables.find(i => i.onInteract && i.r === 2.8 && Math.abs(i.x - v.x) < 1 && Math.abs(i.z - v.z) < 1);
    if (inter) { inter.x = v.mesh.position.x; inter.z = v.mesh.position.z; }
  }

  toJSON() { return this.list.map(v => ({ id: v.id, installed: v.installed, repaired: v.repaired, driving: v.driving, x: v.mesh.position.x, z: v.mesh.position.z, rotY: v.mesh.rotation.y })); }
  fromJSON(data) {
    if (!Array.isArray(data)) return;
    data.forEach((d, i) => {
      if (!d) return;
      const v = (d.id && this.list.find(w => w.id === d.id)) || this.list[i];
      if (!v) return;
      v.installed = { fuel: 0, battery: 0, wheel: 0, ...d.installed };
      v.repaired = !!d.repaired;
      if (d.x !== undefined && d.z !== undefined) {
        v.mesh.position.set(d.x, 0, d.z);
        v.x = d.x; v.z = d.z;
      }
      if (d.rotY !== undefined) v.mesh.rotation.y = d.rotY;
      this._applyVisual(v);
      // restore driving state if saved while driving
      if (d.driving) {
        v.driving = true;
        this.activeVehicle = v;
        this.game.player.inVehicle = v;
        this.game.player.mesh.visible = false;
      }
    });
  }
}
