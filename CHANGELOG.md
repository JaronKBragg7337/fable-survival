# Changelog

All notable changes to Fable Survival. Newest first.

## v0.1.0-foundation — 2026-07-02

Initial playable release, live at https://fable-survival.vercel.app

- Vite + Three.js project, 16 modular systems under src/
- Third-person camera (first-person toggle), touch joystick + desktop WASD/mouse
- Seeded 220×220 world: forests, rocks, crossing roads, 4 abandoned houses,
  fenced safe zone with trader NPC and campfire
- Harvesting (chop trees / mine rocks, axe & pickaxe double yield)
- Searchable loot crates/barrels with weighted loot table and respawn timers
- 20-slot stacking inventory with use/drop
- Base building: floor, wall, door (opens/closes), campfire (light), storage box
- 12 pooled infected: wander/chase/attack/return AI, night buffs, coin drops
- Trader buy/sell economy (coins)
- 2 wrecked cars, part-based repair stub (fuel/battery/2 wheels)
- Day/night cycle (8 real minutes), sky/fog/sun lerp
- Survival stats: health, stamina, hunger, thirst; death/respawn at safe zone
- localStorage save/load with 25s autosave
