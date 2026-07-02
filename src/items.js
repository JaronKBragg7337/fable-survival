// ============================================================
// ITEM DATABASE
// To add a new item: add an entry here. Fields:
//   name  - display name
//   icon  - emoji used as the "sprite" (cheap, no texture download)
//   stack - max per inventory slot
//   value - base coin value (trader sells at 2x, buys at 1x)
//   use   - optional { health, hunger, thirst } restored when used
//   tool  - optional: 'wood' | 'stone' -> 3x harvest speed on that node type
//   part  - optional: true -> counts as a vehicle repair part
// Everything else (trader stock, loot tables) references these ids.
// ============================================================
export const ITEMS = {
  wood:    { name: 'Wood',        icon: '🪵', stack: 50, value: 2 },
  stone:   { name: 'Stone',       icon: '🪨', stack: 50, value: 3 },
  scrap:   { name: 'Scrap',       icon: '⚙️', stack: 30, value: 5 },
  can:     { name: 'Canned Food', icon: '🥫', stack: 10, value: 8,  use: { hunger: 35 } },
  water:   { name: 'Water Bottle',icon: '🧴', stack: 10, value: 6,  use: { thirst: 40 } },
  bandage: { name: 'Bandage',     icon: '🩹', stack: 10, value: 10, use: { health: 25 } },
  axe:     { name: 'Axe',         icon: '🪓', stack: 1,  value: 25, tool: 'wood' },
  pickaxe: { name: 'Pickaxe',     icon: '⛏️', stack: 1,  value: 25, tool: 'stone' },
  fuel:    { name: 'Fuel Can',    icon: '🛢️', stack: 3,  value: 30, part: true },
  battery: { name: 'Car Battery', icon: '🔋', stack: 3,  value: 30, part: true },
  wheel:   { name: 'Wheel',       icon: '🛞', stack: 4,  value: 20, part: true }
};

// Loot table for searchable containers: [itemId, min, max, weight]
// To tune loot: adjust weights (higher = more common).
export const LOOT_TABLE = [
  ['can', 1, 2, 22], ['water', 1, 2, 22], ['bandage', 1, 2, 14],
  ['scrap', 1, 3, 16], ['wood', 2, 5, 8], ['stone', 2, 5, 8],
  ['axe', 1, 1, 3], ['pickaxe', 1, 1, 3],
  ['fuel', 1, 1, 2], ['battery', 1, 1, 2], ['wheel', 1, 1, 4]
];

export function rollLoot(rolls = 2) {
  const total = LOOT_TABLE.reduce((s, e) => s + e[3], 0);
  const out = [];
  for (let i = 0; i < rolls; i++) {
    let r = Math.random() * total;
    for (const [id, min, max, w] of LOOT_TABLE) {
      r -= w;
      if (r <= 0) { out.push([id, min + Math.floor(Math.random() * (max - min + 1))]); break; }
    }
  }
  return out;
}
