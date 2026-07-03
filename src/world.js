// ============================================================
// WORLD MANAGER - map generation + resource nodes + loot containers.
// The map is deterministic (seeded RNG) so layout stays identical
// across sessions even though saves don't store every tree.
// Uses InstancedMesh for trees/rocks/fence = few draw calls on phones.
// To expand the map: raise this.halfSize, add entries to _scatter(),
// or add new structure builders like _house().
// ============================================================
import * as THREE from 'three';
import { rollLoot, ITEMS } from './items.js';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const SAFE_R = 16;          // safe zone radius
const NODE_RESPAWN = 60;    // seconds
const CRATE_RESPAWN = 120;

export class World {
  constructor(game) {
    this.game = game;
    this.halfSize = 110;
    this.nodes = [];      // trees + rocks (harvestable)
    this.crates = [];     // searchable containers
    this.lootAreas = [];  // used by enemy spawner
    this.rng = mulberry32(20260702);

    this._buildGround();
    this._buildSafeZone();
    this._buildHouses();
    this._scatter();
  }

  isInSafeZone(x, z) { return Math.hypot(x, z) < SAFE_R; }

  _mat(c) { return new THREE.MeshLambertMaterial({ color: c }); }

  _buildGround() {
    const s = this.game.scene;
    const size = this.halfSize * 2;
    const segments = 44;
    const groundGeo = new THREE.PlaneGeometry(size, size, segments, segments);
    const pos = groundGeo.attributes.position;
    const colors = [];
    const color = new THREE.Color();
    const lush = new THREE.Color(0x4f8541);
    const grass = new THREE.Color(0x3f7138);
    const dry = new THREE.Color(0x8a8348);
    const dirt = new THREE.Color(0x76613f);
    const dark = new THREE.Color(0x355d34);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = -pos.getY(i);
      const roadD = Math.min(Math.abs(x), Math.abs(z));
      const roadShoulder = roadD > 4.2 && roadD < 14;
      const safeBlend = Math.hypot(x, z) < SAFE_R + 7;
      const patch =
        Math.sin(x * 0.043 + z * 0.019) +
        Math.sin(z * 0.052 - x * 0.014) * 0.75 +
        Math.sin((x + z) * 0.027) * 0.55;
      const grain = Math.sin(x * 0.47 + z * 0.31) * 0.5 + Math.sin(x * 0.19 - z * 0.41) * 0.5;

      if (roadShoulder || safeBlend) color.copy(dirt);
      else if (patch > 1.05) color.copy(dry);
      else if (patch < -1.0) color.copy(dark);
      else color.copy(grass).lerp(lush, 0.35 + patch * 0.18);

      color.lerp(dirt, Math.max(0, grain) * 0.08);
      color.offsetHSL(0, 0, grain * 0.025);
      colors.push(color.r, color.g, color.b);

      const roadFlat = roadD < 8 || safeBlend;
      const height = roadFlat ? 0 : (patch + grain * 0.35) * 0.025;
      pos.setZ(i, height);
    }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();
    const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    s.add(ground);

    // Roads: two crossing strips. Objects avoid them in _spot().
    const roadMat = this._mat(0x3d3d42);
    const r1 = new THREE.Mesh(new THREE.PlaneGeometry(this.halfSize * 2, 6), roadMat);
    r1.rotation.x = -Math.PI / 2; r1.position.y = 0.01;
    const r2 = r1.clone(); r2.rotation.z = Math.PI / 2;
    s.add(r1, r2);
    // center line dashes
    const dashMat = this._mat(0xb8b23a);
    for (let i = -10; i <= 10; i++) {
      if (Math.abs(i) < 2) continue;
      const d = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(i * 10, 0.02, 0);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2.4), dashMat);
      d2.rotation.x = -Math.PI / 2; d2.position.set(0, 0.02, i * 10);
      s.add(d, d2);
    }
  }

  _buildSafeZone() {
    const s = this.game.scene;
    // dirt circle
    const dirt = new THREE.Mesh(new THREE.CircleGeometry(SAFE_R, 24), this._mat(0x8a7350));
    dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.03;
    s.add(dirt);

    // fence ring (instanced posts) with 4 gates at N/S/E/W
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 5);
    const posts = new THREE.InstancedMesh(postGeo, this._mat(0x6b4f2f), 40);
    const m = new THREE.Matrix4();
    let pi = 0;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      // gate gaps on the two road axes
      const deg = a % (Math.PI / 2);
      if (deg < 0.22 || deg > Math.PI / 2 - 0.22) continue;
      const x = Math.cos(a) * SAFE_R, z = Math.sin(a) * SAFE_R;
      m.makeTranslation(x, 0.8, z);
      posts.setMatrixAt(pi++, m);
      this.game.colliders.push({ x, z, r: 0.3 });
    }
    posts.count = pi;
    s.add(posts);

    // trader kiosk
    const hut = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 2), this._mat(0x7a5c3a)); base.position.y = 1.1;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 2.8), this._mat(0xa33b3b)); roof.position.y = 2.4;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 0.4), this._mat(0x8f6d45)); counter.position.set(0, 0.45, 1.15);
    hut.add(base, roof, counter);
    hut.position.set(-6, 0, -6);
    hut.rotation.y = Math.PI / 4;
    s.add(hut);
    this.game.colliders.push({ x: -6, z: -6, r: 2.2 });

    // trader NPC (simple figure)
    const npc = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), this._mat(0xc9a227)); body.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), this._mat(0xd9a066)); head.position.y = 1.6;
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), this._mat(0x333333)); hat.position.y = 1.83;
    npc.add(body, head, hat);
    const nx = -4.2, nz = -4.2;
    npc.position.set(nx, 0, nz);
    npc.lookAt(0, 0, 0);
    s.add(npc);
    this.game.interactables.push({
      x: nx, z: nz, r: 2.6,
      label: '🧑‍🌾 Talk to Trader',
      onInteract: () => this.game.ui.openTrader()
    });

    // campfire prop at the plaza
    this._campfireProp(4, 4);
  }

  _campfireProp(x, z) {
    const s = this.game.scene;
    const g = new THREE.Group();
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
    fire.position.y = 0.35;
    for (let i = 0; i < 5; i++) {
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), this._mat(0x777777));
      const a = i / 5 * Math.PI * 2;
      st.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
      g.add(st);
    }
    const light = new THREE.PointLight(0xff8c33, 1.2, 10);
    light.position.y = 1;
    g.add(fire, light);
    g.position.set(x, 0, z);
    s.add(g);
  }

  // Find a spawn spot avoiding roads, safe zone, and map edge.
  _spot(minR = 20) {
    for (let tries = 0; tries < 40; tries++) {
      const x = (this.rng() * 2 - 1) * (this.halfSize - 6);
      const z = (this.rng() * 2 - 1) * (this.halfSize - 6);
      if (Math.abs(x) < 5 || Math.abs(z) < 5) continue;          // roads
      if (Math.hypot(x, z) < minR) continue;                      // safe zone
      return { x, z };
    }
    return { x: 40, z: 40 };
  }

  _scatter() {
    const s = this.game.scene;

    // ----- TREES (instanced) -----
    const NT = 70;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.2, 6);
    const leafGeo = new THREE.ConeGeometry(1.5, 3.0, 6);
    this.trunks = new THREE.InstancedMesh(trunkGeo, this._mat(0x6b4a2c), NT);
    this.leaves = new THREE.InstancedMesh(leafGeo, this._mat(0x2e5d33), NT);
    const m = new THREE.Matrix4();
    for (let i = 0; i < NT; i++) {
      const p = this._spot(20);
      const sc = 0.8 + this.rng() * 0.6;
      m.makeScale(sc, sc, sc).setPosition(p.x, 1.1 * sc, p.z);
      this.trunks.setMatrixAt(i, m);
      m.makeScale(sc, sc, sc).setPosition(p.x, (2.2 + 1.5) * sc, p.z);
      this.leaves.setMatrixAt(i, m);
      const col = { x: p.x, z: p.z, r: 0.5 * sc };
      this.game.colliders.push(col);
      this.nodes.push({ type: 'wood', x: p.x, z: p.z, r: 0.6 * sc, hp: 4, maxHp: 4, i, alive: true, t: 0, col, sc });
    }
    s.add(this.trunks, this.leaves);

    // ----- ROCKS (instanced) -----
    const NR = 26;
    const rockGeo = new THREE.DodecahedronGeometry(0.95, 0);
    this.rocks = new THREE.InstancedMesh(rockGeo, this._mat(0x8d8d94), NR);
    for (let i = 0; i < NR; i++) {
      const p = this._spot(20);
      const sc = 0.7 + this.rng() * 0.8;
      m.makeScale(sc, sc * 0.75, sc).setPosition(p.x, 0.45 * sc, p.z);
      this.rocks.setMatrixAt(i, m);
      const col = { x: p.x, z: p.z, r: 0.95 * sc };
      this.game.colliders.push(col);
      this.nodes.push({ type: 'stone', x: p.x, z: p.z, r: 1.1 * sc, hp: 5, maxHp: 5, i, alive: true, t: 0, col, sc });
    }
    s.add(this.rocks);

    // ----- roadside crates & barrels -----
    for (let i = 0; i < 8; i++) {
      const along = (this.rng() * 2 - 1) * (this.halfSize - 15);
      const side = (this.rng() > 0.5 ? 1 : -1) * (4.5 + this.rng() * 3);
      const horiz = this.rng() > 0.5;
      const x = horiz ? along : side, z = horiz ? side : along;
      if (Math.hypot(x, z) < SAFE_R + 3) continue;
      this._crate(x, z, this.rng() > 0.5);
    }
  }

  _crate(x, z, barrel = false) {
    const geo = barrel ? new THREE.CylinderGeometry(0.45, 0.45, 1.0, 8) : new THREE.BoxGeometry(0.85, 0.85, 0.85);
    const mat = this._mat(barrel ? 0x365a7a : 0x9c7b46);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, barrel ? 0.5 : 0.43, z);
    mesh.rotation.y = this.rng() * Math.PI;
    this.game.scene.add(mesh);
    const crate = { x, z, mesh, mat, full: true, t: 0, baseColor: mat.color.getHex() };
    this.crates.push(crate);
    this.game.interactables.push({
      x, z, r: 2.0,
      label: () => crate.full ? (barrel ? '🛢 Search barrel' : '📦 Search crate') : '(empty)',
      onInteract: () => this._search(crate)
    });
  }

  _search(crate) {
    if (!crate.full) { this.game.ui.toast('Already searched.'); return; }
    crate.full = false; crate.t = CRATE_RESPAWN;
    crate.mat.color.setHex(0x4a4a4a);
    const loot = rollLoot(2);
    const got = [];
    for (const [id, n] of loot) {
      const left = this.game.inventory.add(id, n);
      if (left < n) got.push(`+${n - left} ${ITEMS[id].icon}`);
    }
    this.game.ui.toast(got.length ? 'Found: ' + got.join('  ') : 'Nothing fits in your bag!');
  }

  _buildHouses() {
    const spots = [[42, 34], [-52, 40], [38, -52], [-40, -46]];
    for (const [x, z] of spots) { this._house(x, z); this.lootAreas.push({ x, z }); }
    // extra loot areas deep in the woods for enemy spawns
    this.lootAreas.push({ x: 70, z: -10 }, { x: -70, z: 10 }, { x: 10, z: 75 }, { x: -12, z: -72 });
  }

  // Abandoned house: slab + 3 walls + roof, open front (+z). Crates inside.
  _house(x, z) {
    const s = this.game.scene, g = new THREE.Group();
    const wallMat = this._mat(0x9b9186), slabMat = this._mat(0x6e6e6e), roofMat = this._mat(0x5a4632);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 6), slabMat); slab.position.y = 0.1;
    const back = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 0.3), wallMat); back.position.set(0, 1.3, -2.85);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 6), wallMat); left.position.set(-3.85, 1.3, 0);
    const right = left.clone(); right.position.x = 3.85;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.2, 6.6), roofMat); roof.position.y = 2.7;
    g.add(slab, back, left, right, roof);
    g.position.set(x, 0, z);
    s.add(g);
    // box colliders (axis-aligned; houses are unrotated on purpose - cheap)
    this.game.colliders.push(
      { box: true, x, z: z - 2.85, hx: 4, hz: 0.3 },
      { box: true, x: x - 3.85, z, hx: 0.3, hz: 3 },
      { box: true, x: x + 3.85, z, hx: 0.3, hz: 3 }
    );
    this._crate(x - 2, z - 1.5);
    this._crate(x + 2, z + 0.5, true);
  }

  // Called by Player.attack() - chop/mine the node you're facing.
  hitNode(pos, facing, range) {
    let best = null, bestD = 1e9;
    for (const n of this.nodes) {
      if (!n.alive) continue;
      const dx = n.x - pos.x, dz = n.z - pos.z;
      const d = Math.hypot(dx, dz) - n.r;
      if (d > range) continue;
      let ang = Math.atan2(dx, dz) - facing;
      while (ang > Math.PI) ang -= Math.PI * 2;
      while (ang < -Math.PI) ang += Math.PI * 2;
      if (Math.abs(ang) > 1.2) continue;
      if (d < bestD) { bestD = d; best = n; }
    }
    if (!best) return;

    const toolId = best.type === 'wood' ? 'axe' : 'pickaxe';
    const hasTool = this.game.inventory.has(toolId);
    const dmg = hasTool ? 2 : 1;
    best.hp -= dmg;
    const gain = dmg + (best.hp <= 0 ? 2 : 0);
    const left = this.game.inventory.add(best.type, gain);
    const icon = ITEMS[best.type].icon;
    this.game.ui.toast(`+${gain - left} ${icon}${hasTool ? '' : ` (find ${ITEMS[toolId].icon} to gather faster)`}`);
    this.game.stats.stamina = Math.max(0, this.game.stats.stamina - 4);

    if (best.hp <= 0) this._depleteNode(best);
  }

  _depleteNode(n) {
    n.alive = false; n.t = NODE_RESPAWN; n.col.disabled = true;
    this._setNodeVisible(n, false);
  }

  _setNodeVisible(n, vis) {
    const m = new THREE.Matrix4();
    const sc = vis ? n.sc : 0.0001;
    if (n.type === 'wood') {
      m.makeScale(sc, sc, sc).setPosition(n.x, 1.1 * sc, n.z);
      this.trunks.setMatrixAt(n.i, m);
      m.makeScale(sc, sc, sc).setPosition(n.x, 3.7 * sc, n.z);
      this.leaves.setMatrixAt(n.i, m);
      this.trunks.instanceMatrix.needsUpdate = true;
      this.leaves.instanceMatrix.needsUpdate = true;
    } else {
      m.makeScale(sc, sc * 0.75, sc).setPosition(n.x, 0.45 * sc, n.z);
      this.rocks.setMatrixAt(n.i, m);
      this.rocks.instanceMatrix.needsUpdate = true;
    }
  }

  update(dt) {
    for (const n of this.nodes) {
      if (!n.alive) {
        n.t -= dt;
        if (n.t <= 0) { n.alive = true; n.hp = n.maxHp; n.col.disabled = false; this._setNodeVisible(n, true); }
      }
    }
    for (const c of this.crates) {
      if (!c.full) {
        c.t -= dt;
        if (c.t <= 0) { c.full = true; c.mat.color.setHex(c.baseColor); }
      }
    }
  }
}
