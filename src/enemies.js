// ============================================================
// ENEMY AI - pooled infected. Fixed pool of POOL_SIZE zombies that
// are recycled on death (object pooling: no allocation during play).
// State machine per zombie: wander -> chase -> attack -> return.
// Zombies never enter the safe zone. They see farther and move
// faster at night.
// To expand: add ranged infected (new state), loot drops (edit
// _kill), or hordes (spawn several at one lootArea).
// ============================================================
import * as THREE from 'three';
import { makeHumanoid } from './characters.js';
import { resolveCollisions } from './collision.js';

const POOL_SIZE = 12;
const RADIUS = 0.45;
const DETECT_DAY = 12, DETECT_NIGHT = 18, LOSE_DIST = 24;
const SPEED_WANDER = 1.3, SPEED_CHASE = 3.1, NIGHT_MULT = 1.2;
const ATTACK_RANGE = 1.5, ATTACK_CD = 1.2, ATTACK_DMG = 8;
const RESPAWN_T = 35, HP = 30;
const FACE_OFFSET = Math.PI; // zombie arms point down local -Z, so rotate the visual front toward travel

export class Enemies {
  constructor(game) {
    this.game = game;
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) this.pool.push(this._makeZombie());
    // initial spawn spread across loot areas
    this.pool.forEach((z, i) => this._spawn(z, i));
  }

  _makeZombie() {
    // Shaped infected: hunched humanoid, arms reaching forward (characters.js).
    const rig = makeHumanoid({ kind: 'infected', shirt: 0x5a6e4a, pants: 0x3a3a30, skin: 0x8fa07a });
    const g = rig.group;
    g.visible = false;
    this.game.scene.add(g);
    return {
      mesh: g, bodyMat: rig.torso.material,
      pos: new THREE.Vector3(), home: new THREE.Vector3(), target: new THREE.Vector3(),
      hp: HP, alive: false, state: 'wander', wanderT: 0, atkT: 0, respawnT: 0, flashT: 0
    };
  }

  _spawn(z, seedIdx = null) {
    const areas = this.game.world.lootAreas;
    const a = areas[(seedIdx ?? Math.floor(Math.random() * areas.length)) % areas.length];
    const ang = Math.random() * Math.PI * 2, d = 3 + Math.random() * 8;
    z.home.set(a.x + Math.cos(ang) * d, 0, a.z + Math.sin(ang) * d);
    z.pos.copy(z.home);
    z.hp = HP; z.alive = true; z.state = 'wander'; z.wanderT = 0;
    z.mesh.visible = true;
    z.bodyMat.color.setHex(0x5a6e4a);
  }

  active() { return this.pool.filter(z => z.alive); }

  damage(z, n) {
    if (!z.alive) return;
    z.hp -= n;
    z.flashT = 0.15;
    z.bodyMat.color.setHex(0xc23b3b);
    z.state = 'chase'; // hitting one always aggros it
    if (z.hp <= 0) this._kill(z);
  }

  _kill(z) {
    z.alive = false;
    z.mesh.visible = false;
    z.respawnT = RESPAWN_T;
    const coins = 3 + Math.floor(Math.random() * 4);
    this.game.coins += coins;
    let msg = `Infected down! +${coins} 🪙`;
    if (Math.random() < 0.25 && this.game.pickups.spawn('bandage', 1, z.pos.x, z.pos.z)) msg += ' dropped 🩹';
    if (Math.random() < 0.2 && this.game.pickups.spawn('scrap', 1, z.pos.x, z.pos.z)) msg += ' dropped ⚙️';
    this.game.ui.toast(msg);
  }

  update(dt) {
    const p = this.game.player.pos;
    const night = this.game.dayNight.isNight;
    const detect = night ? DETECT_NIGHT : DETECT_DAY;
    const speedMult = night ? NIGHT_MULT : 1;
    const playerSafe = this.game.world.isInSafeZone(p.x, p.z);
    const dead = this.game.stats.dead;

    for (const z of this.pool) {
      if (!z.alive) {
        z.respawnT -= dt;
        if (z.respawnT <= 0) this._spawn(z);
        continue;
      }
      if (z.flashT > 0) { z.flashT -= dt; if (z.flashT <= 0) z.bodyMat.color.setHex(0x5a6e4a); }

      const distP = z.pos.distanceTo(p);

      switch (z.state) {
        case 'wander': {
          z.wanderT -= dt;
          if (z.wanderT <= 0) {
            z.wanderT = 3 + Math.random() * 5;
            const a = Math.random() * Math.PI * 2, d = Math.random() * 8;
            z.target.set(z.home.x + Math.cos(a) * d, 0, z.home.z + Math.sin(a) * d);
          }
          this._moveToward(z, z.target, SPEED_WANDER * dt);
          if (distP < detect && !playerSafe && !dead) z.state = 'chase';
          break;
        }
        case 'chase': {
          if (playerSafe || dead || distP > LOSE_DIST) { z.state = 'return'; break; }
          if (distP < ATTACK_RANGE) { z.state = 'attack'; z.atkT = 0.4; break; }
          this._moveToward(z, p, SPEED_CHASE * speedMult * dt);
          break;
        }
        case 'attack': {
          if (playerSafe || dead) { z.state = 'return'; break; }
          if (distP > ATTACK_RANGE * 1.3) { z.state = 'chase'; break; }
          z.atkT -= dt;
          if (z.atkT <= 0) {
            z.atkT = ATTACK_CD;
            this.game.stats.damage(ATTACK_DMG, 'Torn apart by the infected.');
            this.game.ui.toast('🧟 You are being attacked!');
          }
          this._face(z, p);
          break;
        }
        case 'return': {
          this._moveToward(z, z.home, SPEED_WANDER * 1.5 * dt);
          if (z.pos.distanceTo(z.home) < 1.5) z.state = 'wander';
          if (distP < detect * 0.8 && !playerSafe && !dead) z.state = 'chase';
          break;
        }
      }

      // never walk into the safe zone
      const dHome = Math.hypot(z.pos.x, z.pos.z);
      if (dHome < 17) {
        const push = 17 / (dHome || 1);
        z.pos.x *= push; z.pos.z *= push;
        if (z.state === 'chase' || z.state === 'attack') z.state = 'return';
      }

      resolveCollisions(z.pos, RADIUS, this.game.colliders);
      this._separate(z);

      const bob = Math.abs(Math.sin(performance.now() * 0.008 + z.home.x)) * 0.06;
      z.mesh.position.set(z.pos.x, bob, z.pos.z);
    }
  }

  _separate(z) { // keep zombies from stacking (cheap O(n^2), n=12)
    for (const o of this.pool) {
      if (o === z || !o.alive) continue;
      const dx = z.pos.x - o.pos.x, dz = z.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.64 && d2 > 1e-4) {
        const d = Math.sqrt(d2), push = (0.8 - d) * 0.5;
        z.pos.x += dx / d * push; z.pos.z += dz / d * push;
      }
    }
  }

  _moveToward(z, target, step) {
    const dx = target.x - z.pos.x, dz = target.z - z.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    z.pos.x += dx / d * step;
    z.pos.z += dz / d * step;
    z.mesh.rotation.y = Math.atan2(dx, dz) + FACE_OFFSET;
  }

  _face(z, target) {
    z.mesh.rotation.y = Math.atan2(target.x - z.pos.x, target.z - z.pos.z) + FACE_OFFSET;
  }
}
