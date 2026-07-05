# Fable Survival

A DayZ-inspired, mobile-first browser survival prototype built with Three.js + Vite.
No install needed — it runs from a link in any phone or desktop browser.

**Play on Heartbeat: https://www.heartbeatobservatory.com/games/fable-survival/**

Original standalone deployment: https://fable-survival.vercel.app

## Controls

**Phone:** left virtual stick = move (push to the edge to sprint), drag the right side of the screen = look around, USE = interact/place buildings, HIT = attack/chop/mine (also cancels building placement), JMP = jump. Top-right buttons: 🎒 inventory, 🔨 build menu, 👁 first/third-person toggle, 💾 save, ☁ optional cloud save.

**Desktop:** WASD move, Shift sprint, click the game once to lock the mouse for looking, click = attack/chop, E = interact, I or Tab = inventory, B = build menu, V = camera toggle, Space = jump, Esc = close menus.

## How to play

You spawn in the fenced safe zone — infected never enter it. The trader there buys and sells gear. Hit trees for wood and rocks for stone (an axe/pickaxe doubles the yield), search crates and barrels near the roads and abandoned houses for food, water, medicine, and car parts. Keep hunger and thirst up or you'll start losing health. Killing infected earns coins. With wood and stone you can build floors, walls, doors, campfires, and storage boxes anywhere outside the safe zone. Two wrecked cars on the map can be repaired with 1 fuel can, 1 battery, and 2 wheels, then driven with WASD or the touch stick. Nights are dark and the infected see farther and move faster — build a campfire. Progress autosaves to your browser every 25 seconds. The ☁ panel can optionally create/login/link a cloud-save account for cross-device play; local saves continue working without it. When hosted on Heartbeat Observatory, the game also joins the shared Heartbeat Realtime layer: connected players can see each other's survivor markers, basic actions, live build placements, and driven vehicles. If realtime is unavailable, the game falls back to solo play.

## Local development

```bash
npm install
npm run dev        # dev server, --host is enabled so your phone can reach it on LAN
npm run build      # production build -> dist/
npm run preview    # serve the production build locally
```

## Deployment

The `dist/` folder is a plain static site — host it anywhere.

- **Vercel:** `cd dist && vercel deploy --prod` (this is how the live link above was made)
- **Netlify:** drag the `dist` folder onto https://app.netlify.com/drop
- **GitHub Pages:** push the repo, enable Pages, set the build output to `dist` (the Vite config uses `base: './'` so subpaths work)

## Architecture

Each system lives in its own module under `src/` with a header comment explaining how to expand it:

| Module | Role |
|---|---|
| `main.js` | bootstraps everything, shared `game` context, game loop |
| `input.js` | keyboard/mouse + virtual joystick/touch, action events |
| `player.js` | movement, jump, melee, interaction |
| `cameraController.js` | third-person orbit + first-person toggle |
| `collision.js` | circle/AABB push-out collision (no physics engine) |
| `world.js` | seeded map gen, resource nodes, loot containers, safe zone |
| `items.js` / `inventory.js` | item database, stacking slot inventory |
| `pickups.js` | pooled dropped-item meshes and walk-over/USE collection |
| `building.js` | ghost placement, floors/walls/doors/campfire/storage |
| `enemies.js` | pooled infected with wander/chase/attack/return AI |
| `trader.js` | safe-zone buy/sell economy |
| `vehicles.js` | repairable wrecks + driving |
| `stats.js` | health/stamina/hunger/thirst |
| `daynight.js` | sun cycle, sky/fog, night danger flag |
| `save.js` | localStorage save/load + autosave |
| `ui.js` | HUD, panels, toasts, start/death screens |

Performance choices for phones: instanced meshes for trees/rocks/fence, emoji "icons" instead of textures, capped pixel ratio, one pooled set of 12 zombies, no physics engine, fog to limit draw distance.

## Known limitations

Dropped pickups are runtime-only and do not persist across reloads yet; multiplayer is visibility/co-presence rather than authoritative co-op combat; zombies path straight at you and can snag on obstacles; death keeps your inventory (prototype-friendly); saves are per-browser/per-device unless optional cloud save is connected; houses are axis-aligned; no audio yet.
