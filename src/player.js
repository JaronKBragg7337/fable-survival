// ============================================================
// PLAYER CONTROLLER - movement, jumping, simple circle collision,
// melee attack, interaction with the nearest interactable.
// Collision model: everything static is a circle {x, z, r} or box
// in game.colliders (see collision.js). Cheap and mobile-friendly.
// To expand: swap in a physics lib, or add crouch/prone states.
// ============================================================
import * as THREE from 'three';
import { makeHumanoid } from './characters.js';
import { resolveCollisions } from './collision.js';

const WALK = 4.0, SPRINT = 6.6, GRAVITY = 22, JUMP_V = 7.5, RADIUS = 0.45;
const ATTACK_RANGE = 2.0, ATTACK_ARC = 1.0 /*radians half-angle*/, ATTACK_DMG = 12, ATTACK_CD = 0.5;

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(0, 0, 6);   // spawn in the safe zone
    this.velY = 0;
    this.onGround = true;
    this.attackTimer = 0;
    this.swingT = 0;                          // arm swing animation timer
    this.inVehicle = null;                    // current vehicle when driving
    this.mesh = this._buildMesh();
    game.scene.add(this.mesh);
  }

  // Low-poly "survivor": shaped humanoid (characters.js). No skeletal rig -
  // we bob and swing procedurally to stay cheap on phones.
  _buildMesh() {
    // Shaped survivor from the shared humanoid builder (characters.js).
    // armR pivots at the shoulder, so the existing swing code just works.
    const rig = makeHumanoid({ shirt: 0x3f5e3a, pants: 0x2b2b33, skin: 0xd9a066 });
    this.armR = rig.armR;
    return rig.group;
  }

  update(dt) {
    const { input, camCtl, stats } = this.game;
    if (stats.dead || this.inVehicle) return;  // skip movement when driving

    // --- movement (camera-relative) ---
    const sprinting = input.sprint && stats.stamina > 1 && (input.move.x || input.move.z);
    const speed = sprinting ? SPRINT : WALK;
    const sin = Math.sin(camCtl.yaw), cos = Math.cos(camCtl.yaw);
    // With camera yaw, forward = (-sin, -cos) and screen-right = (cos, -sin);
    // joystick-up / W gives move.z = -1.
    const dx = (input.move.x * cos + input.move.z * sin) * speed * dt;
    const dz = (-input.move.x * sin + input.move.z * cos) * speed * dt;
    this.pos.x += dx; this.pos.z += dz;
    this.moving = !!(input.move.x || input.move.z);
    this.sprinting = sprinting;

    // face travel direction
    if (this.moving) {
      const target = Math.atan2(dx, dz);
      let diff = target - this.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.mesh.rotation.y += diff * Math.min(1, dt * 12);
    }

    // --- gravity / jump ---
    this.velY -= GRAVITY * dt;
    this.pos.y += this.velY * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.velY = 0; this.onGround = true; }

    // --- collisions with static shapes ---
    resolveCollisions(this.pos, RADIUS, this.game.colliders);

    // --- map bounds ---
    const B = this.game.world.halfSize - 2;
    this.pos.x = Math.max(-B, Math.min(B, this.pos.x));
    this.pos.z = Math.max(-B, Math.min(B, this.pos.z));

    // --- animate ---
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.swingT > 0) {
      this.swingT -= dt;
      this.armR.rotation.x = -Math.sin((1 - this.swingT / 0.3) * Math.PI) * 1.8;
    } else this.armR.rotation.x = 0;
    const bob = this.moving ? Math.sin(performance.now() * 0.012) * 0.05 : 0;
    this.mesh.position.set(this.pos.x, this.pos.y + bob, this.pos.z);
  }

  jump() {
    if (this.onGround && !this.game.stats.dead && !this.inVehicle) { this.velY = JUMP_V; this.onGround = false; }
  }

  // Melee swing: damages enemies AND harvests resource nodes in front.
  attack() {
    if (this.attackTimer > 0 || this.game.stats.dead || this.inVehicle) return;
    this.attackTimer = ATTACK_CD;
    this.swingT = 0.3;
    const facing = this.mesh.rotation.y;
    let hit = false;

    // enemies
    for (const z of this.game.enemies.active()) {
      const dx = z.pos.x - this.pos.x, dz = z.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < ATTACK_RANGE) {
        let ang = Math.atan2(dx, dz) - facing;
        while (ang > Math.PI) ang -= Math.PI * 2;
        while (ang < -Math.PI) ang += Math.PI * 2;
        if (Math.abs(ang) < ATTACK_ARC) { this.game.enemies.damage(z, ATTACK_DMG); hit = true; }
      }
    }
    // resource nodes (trees/rocks) - hitting them also gathers
    if (!hit) this.game.world.hitNode(this.pos, facing, ATTACK_RANGE);
  }

  // Interact with nearest interactable within range (set by main loop).
  interact() {
    const t = this.game.nearInteractable;
    if (t && !this.game.stats.dead) t.onInteract();
  }

  respawn() {
    if (this.inVehicle) this.game.vehicles.exitVehicle(this.inVehicle);
    this.pos.set(0, 0, 6);
    this.velY = 0;
    this.game.stats.reset();
  }
}
