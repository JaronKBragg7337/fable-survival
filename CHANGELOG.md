# Changelog

All notable changes to Fable Survival. Newest first.

## v0.6.2 — 2026-07-05

- Added cloud-save UI (#8): a top-right cloud panel for create, login, recovery
  code linking, manual upload, disconnect, and recovery-code copy.
- Cloud save remains optional. Local browser saves still work without an
  account, and the cloud bridge only calls `/api/account` or `/api/save` after
  the player opens the panel and connects.

## v0.6.1 — 2026-07-05

- Added optional cloud-save client bridge (#7) layered over the existing
  localStorage save system. The bridge stays dormant unless a future UI opts in
  and stores a session token, so current players still start and autosave
  locally exactly as before.
- Added async cloud pull, debounced `PUT /api/save` after local saves, bearer
  session handling, cloud/local divergence prompts, and metadata tracking.
  Network failures log and continue on local play.

## v0.6.0 — 2026-07-04

- Added Heartbeat Observatory multiplayer visibility MVP using the existing
  Heartbeat Supabase Realtime system, not Fable's separate cloud-save backend.
  Remote survivors now appear with nameplates, interpolated movement, sprint/
  death state, and attack swing hints. The realtime chip shows solo/connected
  status and shared games presence.
- Local saves are unchanged and the game remains playable if realtime cannot
  connect. Player-built pieces are broadcast to other connected clients as a
  live playtest convenience.
- Prepared the build for hosting inside Heartbeat Observatory at
  `/games/fable-survival/`.

## v0.5.2 — 2026-07-03

- Cloud-save server API added (#6): Vercel functions now support account
  creation, username/password login, recovery-code linking, and authenticated
  save read/write. Passwords and recovery codes are hashed with `bcryptjs`;
  save access uses short-lived bearer session tokens stored only as SHA-256
  hashes. The game UI still does not call cloud save yet; this unblocks the
  client bridge/UI work in #7/#8.

## v0.5.1 — 2026-07-03

- Supabase cloud-save foundation added (#5): project `fable-survival`
  (`ukguppzfpvdcemyxzdbn`) now has a committed/applied migration for
  `player_accounts` and `player_saves`, with RLS enabled and no browser table
  grants. Added `.env.example` and `SUPABASE.md` documenting the safe
  publishable-key/server-secret split. No live gameplay calls Supabase yet.

## v0.5.0 — 2026-07-03

- Dropped loot is now tangible ground pickups instead of vanishing. Player
  inventory drops spawn just ahead of the survivor and can be collected by
  pressing USE nearby or walking over them. Infected still grant coins
  immediately, but their bandage/scrap bonus loot now drops at the body as a
  pickup. Implemented as a fixed 32-item mesh pool (`src/pickups.js`) to avoid
  runtime allocation churn on phones.

## v0.4.0 — 2026-07-03

- Three explorable landmark structures added to the world (#16): a roadside
  **gas station** (shop + forecourt canopy + pumps), a large enterable **barn**
  (walk in through the front doorway to loot/hide), and a **watchtower**
  lookout you can spot from a distance. Each has its own loot crates/barrels
  and is a zombie spawn area, so the map now has real places to loot, hide,
  and discover. All flat-colored low-poly, built after the deterministic
  scatter so existing tree/rock/house layout is unchanged. Bundle +~1 KB gzip.

## v0.3.2 — 2026-07-03

- Survival guidance so early deaths teach instead of feeling random (#15): the
  start screen now warns that zombies get faster and see farther at night and
  that the fenced plaza is safe, and the death screen shows a rotating,
  mechanically-accurate survival tip (night danger, safe zone, bandages,
  food/water drain, healing threshold, quick walls). Text-only — no change to
  zombie AI, balance, or night danger.

## v0.3.1 — 2026-07-03

- Vehicles now carry stable string ids (`wreck_a`, `wreck_b`) and saves store
  repair progress keyed by id instead of array index (tech-debt #9). Old saves
  still load via positional fallback, so adding or reordering wrecks in the
  future no longer risks attaching repair progress to the wrong car. No
  gameplay or save-format break.

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
