// ============================================================
// CAMERA CONTROLLER - third person orbit (default) + first person toggle.
// Reads look deltas from InputManager, follows the player.
// To expand: add camera collision (raycast from player to camera and
// shorten distance), shoulder offset, or zoom pinch gesture.
// ============================================================
import * as THREE from 'three';

export class CameraController {
  constructor(camera, player, input) {
    this.camera = camera;
    this.player = player;
    this.input = input;
    this.yaw = 0;
    this.pitch = 0.35;          // slightly above horizon
    this.dist = 5.5;            // third-person orbit distance
    this.firstPerson = false;
    this._pos = new THREE.Vector3();
  }

  toggleMode() { this.firstPerson = !this.firstPerson; }

  update() {
    const d = this.input.consumeLook();
    const v = this.player.inVehicle;
    if (v) {
      // Driving chase cam: lock the camera BEHIND the car's nose so "push up =
      // drive into the screen". Nose is local +X, so behind-yaw = rotation.y - PI/2
      // (verified: that offset equals -nose). Look-drag still tilts pitch only.
      this.yaw = v.mesh.rotation.y - Math.PI / 2;
      this.pitch = Math.max(0.05, Math.min(0.9, this.pitch + d.y));
    } else {
      this.yaw -= d.x;
      this.pitch = Math.max(-1.2, Math.min(1.35, this.pitch + d.y));
    }

    const p = v ? v.mesh.position : this.player.pos;
    if (this.firstPerson) {
      this.camera.position.set(p.x, p.y + 1.55, p.z);
      const look = new THREE.Vector3(
        p.x - Math.sin(this.yaw) * Math.cos(this.pitch),
        p.y + 1.55 - Math.sin(this.pitch),
        p.z - Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      this.camera.lookAt(look);
      this.player.mesh.visible = false;
    } else {
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      this._pos.set(
        p.x + Math.sin(this.yaw) * cp * this.dist,
        Math.max(0.4, p.y + 1.4 + sp * this.dist),
        p.z + Math.cos(this.yaw) * cp * this.dist
      );
      this.camera.position.copy(this._pos);
      this.camera.lookAt(p.x, p.y + 1.3, p.z);
      this.player.mesh.visible = !v; // hide player when driving; car has its own mesh
    }
  }
}
