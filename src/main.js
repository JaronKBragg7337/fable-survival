// ============================================================
// MAIN - bootstraps every system and runs the game loop.
// The `game` object is the shared context passed to all systems:
//   game.colliders     - static collision shapes (see collision.js)
//   game.interactables - { x, z, r, label, onInteract } list
//   game.nearInteractable - closest one in range, set each frame
// Update order matters: input -> player -> camera -> AI -> world.
// To add a system: construct it here and call its update() below.
// ============================================================
import * as THREE from 'three';
import { InputManager } from './input.js';
import { Stats } from './stats.js';
import { Inventory } from './inventory.js';
import { World } from './world.js';
import { Player } from './player.js';
import { CameraController } from './cameraController.js';
import { Buildings } from './building.js';
import { Enemies } from './enemies.js';
import { Trader } from './trader.js';
import { Vehicles } from './vehicles.js';
import { DayNight } from './daynight.js';
import { SaveSystem } from './save.js';
import { UI } from './ui.js';
import { Pickups } from './pickups.js';
import { Multiplayer } from './multiplayer.js';

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap DPR: big mobile FPS win
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- game context ----------
const game = {
  scene, camera, renderer,
  colliders: [],
  interactables: [],
  nearInteractable: null,
  coins: 20,
  started: false
};

game.input = new InputManager(renderer.domElement);
game.stats = new Stats(game);
game.inventory = new Inventory(20);
game.world = new World(game);
game.player = new Player(game);
game.camCtl = new CameraController(camera, game.player, game.input);
game.buildings = new Buildings(game);
game.enemies = new Enemies(game);
game.trader = new Trader(game);
game.vehicles = new Vehicles(game);
game.pickups = new Pickups(game);
game.dayNight = new DayNight(game);
game.save = new SaveSystem(game);
game.ui = new UI(game);
game.multiplayer = new Multiplayer(game);

// starter kit for new survivors
if (!game.save.load()) {
  game.inventory.add('can', 1);
  game.inventory.add('water', 1);
  game.inventory.add('bandage', 2);
}

// ---------- input wiring ----------
game.input.on('interact', () => {
  if (game.player.inVehicle) {
    game.vehicles.exitVehicle(game.player.inVehicle);
  } else if (game.buildings.mode) {
    game.buildings.place();
  } else {
    game.player.interact();
  }
});
game.input.on('attack', () => {
  if (game.player.inVehicle) { game.vehicles.exitVehicle(game.player.inVehicle); return; }
  if (game.buildings.mode) { game.buildings.exitMode(); game.ui.toast('Placement cancelled.'); }
  else { game.player.attack(); game.multiplayer.markAction('attack'); }
});
game.input.on('jump', () => game.player.jump());
game.input.on('toggleBuild', () => game.ui.togglePanel('build'));
game.input.on('toggleInv', () => game.ui.togglePanel('inv'));
game.input.on('toggleCam', () => game.camCtl.toggleMode());
game.input.on('closeAll', () => { game.ui.closeAll(); game.buildings.exitMode(); });

// ---------- interactable proximity scan ----------
function findNearInteractable() {
  const p = game.player.inVehicle ? game.player.inVehicle.mesh.position : game.player.pos;
  let best = null, bestD = 1e9;
  for (const t of game.interactables) {
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    if (d < t.r && d < bestD) { bestD = d; best = t; }
  }
  game.nearInteractable = best;
}

// ---------- main loop ----------
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05); // clamp: no physics explosions after tab-switch
  if (game.started) {
    if (game.player.inVehicle) {
      game.vehicles.update(dt);
    } else {
      game.player.update(dt);
      game.enemies.update(dt);
      game.world.update(dt);
      game.pickups.update(dt);
      game.buildings.update();
      game.dayNight.update(dt);
      game.stats.update(dt, game.player.sprinting);
      game.save.update(dt);
      game.multiplayer.update(dt);
      findNearInteractable();
    }
  }
  game.camCtl.update();
  game.ui.updateHUD();
  renderer.render(scene, camera);
}
loop();
