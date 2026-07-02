// ============================================================
// DAY/NIGHT CYCLE - one game day = DAY_LENGTH real seconds.
// Drives the sun (directional light), hemisphere ambient, sky and
// fog colors. enemies.js reads .isNight for speed/detection buffs.
// To expand: add weather by lerping fog density, or a moon light.
// ============================================================
import * as THREE from 'three';

const DAY_LENGTH = 480; // 8 real minutes per in-game day

const SKY_DAY = new THREE.Color(0x87b5d6), SKY_NIGHT = new THREE.Color(0x0a1024);
const FOG_DAY = new THREE.Color(0x9cc0d8), FOG_NIGHT = new THREE.Color(0x0a1024);

export class DayNight {
  constructor(game) {
    this.game = game;
    this.time = 8;    // start 08:00
    this.day = 1;

    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.0);
    this.hemi = new THREE.HemisphereLight(0xbcd8ee, 0x3a5232, 0.7);
    game.scene.add(this.sun, this.hemi);
    game.scene.fog = new THREE.Fog(0x9cc0d8, 40, 150);
    this._sky = new THREE.Color();
    this._fog = new THREE.Color();
  }

  get isNight() { return this.time < 5.5 || this.time > 19.5; }

  clockText() {
    const h = Math.floor(this.time), m = Math.floor((this.time - h) * 60);
    return `Day ${this.day} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${this.isNight ? ' 🌙' : ''}`;
  }

  update(dt) {
    this.time += dt * 24 / DAY_LENGTH;
    if (this.time >= 24) { this.time -= 24; this.day++; this.game.ui.toast(`☀️ Day ${this.day} begins`); }

    // daylight factor: 0 at night, 1 at noon
    const f = Math.max(0, Math.sin((this.time - 6) / 12 * Math.PI));
    const smooth = f * f * (3 - 2 * f);

    const a = (this.time / 24) * Math.PI * 2 - Math.PI / 2;
    this.sun.position.set(Math.cos(a) * 60, Math.max(4, Math.sin(a) * 80), 25);
    this.sun.intensity = 0.15 + smooth * 0.95;
    this.hemi.intensity = 0.18 + smooth * 0.6;

    this._sky.lerpColors(SKY_NIGHT, SKY_DAY, smooth);
    this._fog.lerpColors(FOG_NIGHT, FOG_DAY, smooth);
    this.game.scene.background = this._sky;
    this.game.scene.fog.color.copy(this._fog);
  }

  toJSON() { return { time: this.time, day: this.day }; }
  fromJSON(d) { if (d) { this.time = d.time ?? 8; this.day = d.day ?? 1; } }
}
