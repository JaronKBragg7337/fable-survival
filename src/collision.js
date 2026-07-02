// ============================================================
// COLLISION HELPER - resolves a moving circle (player/zombie)
// against static colliders. Two collider shapes:
//   circle: { x, z, r }
//   box:    { box: true, x, z, hx, hz }  (axis-aligned half-extents)
// Set collider.disabled = true to temporarily turn one off
// (depleted trees, open doors).
// To expand: add rotated boxes by transforming the point into the
// box's local space first.
// ============================================================
export function resolveCollisions(pos, radius, colliders) {
  for (const c of colliders) {
    if (c.disabled) continue;
    if (c.box) {
      // nearest point on AABB to circle center
      const nx = Math.max(c.x - c.hx, Math.min(c.x + c.hx, pos.x));
      const nz = Math.max(c.z - c.hz, Math.min(c.z + c.hz, pos.z));
      let dx = pos.x - nx, dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = nx + dx / d * radius;
          pos.z = nz + dz / d * radius;
        } else {
          // center inside box: push out the shallow axis
          const px = c.hx - Math.abs(pos.x - c.x), pz = c.hz - Math.abs(pos.z - c.z);
          if (px < pz) pos.x = c.x + Math.sign(pos.x - c.x || 1) * (c.hx + radius);
          else pos.z = c.z + Math.sign(pos.z - c.z || 1) * (c.hz + radius);
        }
      }
    } else {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const min = radius + c.r, d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = c.x + dx / d * min;
        pos.z = c.z + dz / d * min;
      }
    }
  }
}
