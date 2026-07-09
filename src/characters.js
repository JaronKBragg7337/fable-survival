// ============================================================================
// characters.js — shaped humanoid builder. The end of box people.
//
// OWNS: the one shared low-poly PERSON model (player, remote players, zombies,
//       trader). Capsule limbs, tapered torso, sphere head with hair cap —
//       reads as a stylized person from any distance (silhouette test).
// DOES NOT OWN: movement, animation timing, collision (callers keep their own
//       capsule colliders; visual proportions match the old 1.75 m box rig).
//
// USAGE: makeHumanoid({ shirt, skin, pants, kind }) -> { group, armR, armL,
//        head, legL, legR }. armR/armL pivot at the SHOULDER so existing
//        rotation.x swing code produces a natural arm arc with zero changes.
// Phone budget: ~450 tris per character.
// ============================================================================

import * as THREE from 'three';

const M = (c) => new THREE.MeshLambertMaterial({ color: c });
const DARK = 0x24262c;

export function makeHumanoid(opts = {}) {
  const skin = opts.skin ?? 0xd9a066;
  const shirt = opts.shirt ?? 0x3f5e3a;
  const pants = opts.pants ?? 0x2b2b33;
  const hair = opts.hair ?? 0x3a2c1e;
  const kind = opts.kind || 'survivor';

  const g = new THREE.Group();
  const skinM = M(skin), shirtM = M(shirt), pantsM = M(pants), darkM = M(DARK);

  // Legs: tapered capsules + rounded boots.
  const legGeo = new THREE.CapsuleGeometry(0.085, 0.4, 3, 8);
  const legL = new THREE.Mesh(legGeo, pantsM); legL.position.set(-0.13, 0.34, 0);
  const legR = new THREE.Mesh(legGeo, pantsM); legR.position.set(0.13, 0.34, 0);
  const bootGeo = new THREE.SphereGeometry(0.105, 8, 6);
  for (const s of [-0.13, 0.13]) {
    const boot = new THREE.Mesh(bootGeo, darkM);
    boot.scale.set(1, 0.62, 1.5);
    boot.position.set(s, 0.07, 0.03);
    g.add(boot);
  }

  // Torso: shoulders wider than waist (lathe-like taper via cylinder).
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.56, 10), shirtM);
  torso.position.y = 0.9;
  torso.scale.z = 0.72; // flatten front-to-back so it's a chest, not a tube
  // Hips joining legs to torso.
  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), pantsM);
  hips.scale.set(1.08, 0.62, 0.8); hips.position.y = 0.62;
  // Shoulders.
  const shGeo = new THREE.SphereGeometry(0.095, 8, 6);
  const shL = new THREE.Mesh(shGeo, shirtM); shL.position.set(-0.245, 1.14, 0);
  const shR = new THREE.Mesh(shGeo, shirtM); shR.position.set(0.245, 1.14, 0);

  // Arms: capsule hanging from a shoulder-pivot group (swing-friendly).
  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.265, 1.14, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.34, 3, 8), shirtM);
    arm.position.y = -0.24;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skinM);
    hand.position.y = -0.47;
    pivot.add(arm, hand);
    pivot.rotation.z = side * -0.06; // slight natural outward hang
    return pivot;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Neck + head + hair cap + face.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.09, 8), skinM);
  neck.position.y = 1.22;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), skinM);
  head.scale.set(0.94, 1.12, 0.94); head.position.y = 1.42;
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.163, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M(hair));
  hairCap.scale.copy(head.scale); hairCap.position.y = 1.435;
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.032, 0.03), darkM);
  eyes.position.set(0, 1.44, 0.145);

  g.add(legL, legR, hips, torso, shL, shR, armL, armR, neck, head, hairCap, eyes);

  if (kind === 'infected') {
    // Hunched, arms reaching forward, no hair cap, sicklier posture.
    hairCap.visible = false;
    torso.rotation.x = 0.22;
    torso.position.z = 0.05;
    head.position.z = 0.14; head.position.y = 1.36; head.rotation.z = 0.14;
    eyes.position.set(0, 1.38, 0.28);
    neck.position.z = 0.1; neck.rotation.x = 0.4;
    armL.rotation.x = -1.25; armR.rotation.x = -1.35;
    shL.position.z = shR.position.z = 0.04;
  } else if (kind === 'trader') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.03, 12), M(0x4a3524));
    brim.position.y = 1.54;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.13, 10), M(0x4a3524));
    crown.position.y = 1.61;
    hairCap.visible = false;
    g.add(brim, crown);
    // Apron over the shirt.
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.4, 0.05), M(0x7a5c38));
    apron.position.set(0, 0.86, 0.14);
    g.add(apron);
  }

  return { group: g, armR, armL, head, legL, legR, torso };
}
