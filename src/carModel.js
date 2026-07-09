// ============================================================================
// carModel.js — the one shaped car model (drivable wrecks + remote cars).
//
// OWNS: the visual car mesh: extruded side-profile hull (hood, windshield
//       rake, roof, trunk in ONE connected shape), wheels with dark wells,
//       glass cabin, bumpers, head/tail lights.
// DOES NOT OWN: driving physics, wreck/repair state, collision (vehicles.js),
//       multiplayer sync (multiplayer.js).
//
// makeCarMesh(bodyColor) -> { group, bodyMat, wheels[4] }
//   wheels order: [rear-left, rear-right, front-right, front-left] to match
//   the old wreck wheel-install order. Footprint ~3.6 x 1.7 m like before.
// ============================================================================

import * as THREE from 'three';

const M = (c) => new THREE.MeshLambertMaterial({ color: c });

export function makeCarMesh(bodyColor = 0x8a4a3a) {
  const g = new THREE.Group();
  const bodyMat = M(bodyColor);
  const darkM = M(0x1d2026);
  const glassM = new THREE.MeshLambertMaterial({ color: 0x9fc7d8, transparent: true, opacity: 0.65 });

  // --- Hull: one connected side profile, extruded across the width. -------
  // x = along the car (+x is the front), y = up. Origin at ground centre.
  const s = new THREE.Shape();
  s.moveTo(-1.75, 0.32);         // rear bottom
  s.lineTo(-1.78, 0.78);         // tail
  s.lineTo(-1.35, 0.86);         // trunk lid
  s.lineTo(-0.95, 1.28);         // rear window rake
  s.lineTo(-0.05, 1.32);         // roof
  s.lineTo(0.5, 0.92);           // windshield rake
  s.lineTo(1.55, 0.84);          // hood
  s.lineTo(1.78, 0.62);          // nose drop
  s.lineTo(1.75, 0.32);          // front bottom
  s.lineTo(1.2, 0.3);            // front wheel well area (kept simple)
  s.lineTo(-1.2, 0.3);
  s.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(s, { depth: 1.46, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2 });
  hullGeo.translate(0, 0, -0.73); // centre the width
  const hull = new THREE.Mesh(hullGeo, bodyMat);
  g.add(hull);

  // --- Glass: windshield, rear, sides — inset into the cabin band. --------
  const wind = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.32), glassM);
  wind.position.set(0.28, 1.08, 0); wind.rotation.z = -0.62;
  const rear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 1.28), glassM);
  rear.position.set(-0.78, 1.06, 0); rear.rotation.z = 0.72;
  const sideGeo = new THREE.BoxGeometry(1.0, 0.34, 0.05);
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(sideGeo, glassM);
    win.position.set(-0.25, 1.02, side * 0.81);
    g.add(win);
  }
  g.add(wind, rear);

  // --- Wheels + dark wells. wheels order matches old install order. -------
  const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.26, 12);
  const hubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.28, 8);
  const hubM = M(0x8f959c);
  const wellGeo = new THREE.BoxGeometry(0.95, 0.5, 0.2);
  const spots = [[-1.15, 0.85], [-1.15, -0.85], [1.15, -0.85], [1.15, 0.85]];
  const wheels = spots.map(([wx, wz]) => {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, darkM);
    const hub = new THREE.Mesh(hubGeo, hubM);
    tire.rotation.x = hub.rotation.x = Math.PI / 2;
    wheel.add(tire, hub);
    wheel.position.set(wx, 0.37, wz);
    const well = new THREE.Mesh(wellGeo, darkM);
    well.position.set(wx, 0.52, wz * 0.82);
    g.add(well, wheel);
    return wheel;
  });

  // --- Bumpers + lights. ---------------------------------------------------
  const bumperGeo = new THREE.BoxGeometry(0.18, 0.16, 1.62);
  const bF = new THREE.Mesh(bumperGeo, darkM); bF.position.set(1.82, 0.42, 0);
  const bR = new THREE.Mesh(bumperGeo, darkM); bR.position.set(-1.82, 0.42, 0);
  const headGeo = new THREE.BoxGeometry(0.06, 0.12, 0.3);
  const headM = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  const tailM = new THREE.MeshBasicMaterial({ color: 0xd23b2f });
  for (const side of [-0.55, 0.55]) {
    const h = new THREE.Mesh(headGeo, headM); h.position.set(1.8, 0.66, side);
    const t = new THREE.Mesh(headGeo, tailM); t.position.set(-1.8, 0.68, side);
    g.add(h, t);
  }
  g.add(bF, bR);

  return { group: g, bodyMat, wheels };
}
