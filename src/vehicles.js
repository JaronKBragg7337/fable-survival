// ============================================================
// VEHICLES - broken wrecks as future repair targets (stubbed).
// Each wreck needs: 1 fuel, 1 battery, 2 wheels. Install parts from
// your inventory via the vehicle panel. When complete the car is
// marked repaired (engine "starts") - actual driving is the marked
// expansion point: give the repaired car a drive() update that moves
// it with the same joystick input and swap the camera target.
// ============================================================
import * as THREE from 'three';
import { ITEMS } from './items.js';

const REQUIRED = { fuel: 1, battery: 1, wheel: 2 };

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];
    // wrecks parked just off the roads
    this._wreck(9, 38, 0.3);
    this._wreck(-44, -8, 1.8);
  }

  _wreck(x, z, rotY) {
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

    const v = { x, z, mesh: g, bodyMat: body.material, wheels, installed: { fuel: 0, battery: 0, wheel: 0 }, repaired: false };
    this.list.push(v);
    this.game.interactables.push({
      x, z, r: 2.8,
      label: () => v.repaired ? '🚗 Repaired car (driving: coming soon)' : '🚗 Inspect wreck',
      onInteract: () => this.game.ui.openVehicle(v)
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
      this.game.ui.toast('🚗 The engine sputters to life! Driving arrives in a future update.');
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

  toJSON() { return this.list.map(v => ({ installed: v.installed, repaired: v.repaired })); }
  fromJSON(data) {
    if (!Array.isArray(data)) return;
    data.forEach((d, i) => {
      const v = this.list[i];
      if (!v || !d) return;
      v.installed = { fuel: 0, battery: 0, wheel: 0, ...d.installed };
      v.repaired = !!d.repaired;
      this._applyVisual(v);
    });
  }
}
