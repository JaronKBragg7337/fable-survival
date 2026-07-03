# Changelog

All notable changes to Fable Survival. Newest first.

## v0.3.0 — 2026-07-03

- Added procedural vertex-colored ground variety: grass, darker grass, dry
  grass, dirt shoulders, and subtle terrain undulation with no texture assets.
- Fixed the small zombie visual-facing bug that could make infected appear to
  move backward; AI behavior was not rewritten.

## v0.2.1 — 2026-07-03

- Added a tiny inline SVG favicon so Chrome no longer logs a missing
  `/favicon.ico` 404 when loading the live game.

## v0.2.0 — 2026-07-02

- In-game feedback button (💬): nickname (made-up names enforced by copy),
  category picker, 500-char message → creates a GitHub issue labeled
  `player-feedback` via new `/api/feedback` Vercel serverless function
- Reports auto-include game version, device type/screen, player position, and
  in-game time — no personal data
- Spam guards: honeypot field, 60s client cooldown, length caps
- Typing in form fields no longer triggers game controls (input.js guard)
- Deploys now go from project root (vercel.json added) so api/ ships with the game

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
