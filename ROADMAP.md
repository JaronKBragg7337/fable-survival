# ROADMAP.md — The Backlog

This is THE spot for updates, improvements, and additions. Agents pick work from
here (top unchecked item in the current milestone first), check items off when
shipped, and add new ideas to the Icebox. Owner (Jaron) reorders priorities.

**Rules for every item:** must run well on a phone browser, must not break saves,
must not break the live link. See CLAUDE.md for the full protocol.

---

## Milestone 1 — Look & Feel (make it prettier without making it heavier)

- [x] Ground variety: vertex-colored patches (dirt/grass/dry grass), no textures
- [ ] Better trees: 2–3 tree variants (pine/oak/dead), still instanced
- [ ] Simple procedural texture pass: generate small canvas textures at runtime
      (wood grain, brick, road asphalt) — zero download cost, big realism win
- [ ] Player & zombie model upgrade: more box segments, simple walk-cycle leg swing
- [ ] Hit feedback: screen flash on damage, particle burst on chop/mine (pooled)
- [ ] Shadows: single low-res shadow map from the sun, measure FPS on phone first
- [ ] Ambient audio + SFX (chop, hit, zombie groan, night crickets) — small
      generated/CC0 sounds, Web Audio API, mute button. Prioritize zombie
      approach cues (player feedback: deaths feel sudden)
- [x] Difficulty tuning — OWNER DECISION 2026-07-03: **"Teach, don't nerf. Let
      players learn."** No grace period, no Easy/Normal toggle. Shipped the
      teaching path instead: start-screen night-danger warning + rotating
      survival tips on death (#15). Danger stays; players learn it. Do NOT add
      difficulty toggles/grace periods unless the owner reverses this.
- [ ] Damage telegraphing: zombie wind-up animation + screen-edge red vignette
      when one is close behind you

## Milestone 2 — Bigger World

- [ ] Grow map to 400×400: raise halfSize, add biome zones (dense forest, field,
      lakeside), keep fog distance so draw calls stay flat
- [x] New structures: gas station, barn (enterable), watchtower — each with
      loot + a zombie spawn area (world.js `_buildStructures`). Small village
      cluster still open as a future add.
- [ ] A lake/pond: drink water at the shore (thirst refill), visual only otherwise
- [ ] More loot variety: backpack (raises inventory size), matches, cooked meat
- [ ] Chunked world update: skip updating far-away nodes/crates (perf headroom
      before the map grows)

## Milestone 3 — Deeper Survival

- [ ] Driving: make repaired cars actually drive (vehicles.js has the stub notes)
- [ ] Crafting menu: planks→walls discount, bandage from cloth, torch
- [ ] Weapons: bat/spear from crafting, ranged slingshot (pooled projectiles)
- [ ] Cooking on campfires: raw→cooked food, better hunger restore
- [ ] Zombie variety: fast crawler, tanky brute (same pool, different stats/mesh)
- [x] Dropped items appear on the ground as pickups (no longer vanish)
      - OWNER PRIORITY 2026-07-03 (#16): structures first (DONE) → **dropped
        loot next** → then general pickups. Zombie loot / dropped-item drops
        should land on the ground and be walk-over/USE pickups (pool the
        ground-item meshes like enemies). Shipped v0.5.0: player inventory
        drops + infected bandage/scrap drops use a 32-item ground-pickup pool.

## Milestone 4 — Multiplayer-ish & Meta (research first, then decide)

- [x] Cloud-save foundation: Supabase project `fable-survival` plus
      `player_accounts` / `player_saves` schema with RLS and server-only grants
      (#5). See SUPABASE.md.
- [x] Cloud-save server API: Vercel `/api/account` + `/api/save` functions using
      `SUPABASE_SECRET_KEY` (#6). Requires owner to add the secret key in Vercel;
      never paste it into chat or commit it. Shipped v0.5.2: create/login/link
      account endpoints, short-lived bearer sessions, and save read/write.
- [ ] Optional cloud-save client bridge over localStorage (#7) and UI (#8)
- [x] Heartbeat multiplayer visibility MVP: remote survivors, shared games
      presence, attack hints, and live build-piece broadcasts over Heartbeat
      Supabase Realtime. This is not authoritative combat/co-op yet.
- [ ] Research: authoritative co-op/PVP model for combat, enemy ownership, and
      shared persistent bases without breaking phone/free-hosting constraints.
      Write findings to Research Notes below before building.
- [ ] Daily challenge seed: same world layout for all players that day
- [ ] Simple leaderboard (days survived) — needs a tiny backend or Vercel KV

## Recurring / maintenance (good for scheduled tasks)

- [ ] Triage `player-feedback` GitHub issues → PLAYER_FEEDBACK.md + roadmap items,
      close with comment (every session — see CLAUDE.md protocol)
- [ ] Check live URL loads with zero console errors (weekly)
- [ ] `npm outdated` — bump Three.js/Vite minor versions, build, verify (monthly)
- [ ] Research pass: what's new in browser gaming (WebGPU, Three.js releases,
      mobile browser changes) — append dated findings to Research Notes (monthly)
- [ ] Playtest report: play 5 minutes on phone, note friction, file items here
- [ ] ⚠️ BEFORE 2026-09-30: the GITHUB_TOKEN for the feedback pipeline expires.
      Owner must generate a new fine-grained PAT (fable-survival only, Issues R/W)
      and update the Vercel env var, then redeploy. Feedback silently stops if missed.

## Icebox (ideas, unprioritized)

- Weather (rain/fog days), seasons
- Pet dog companion
- Fishing at the lake
- Base raids: zombies attack your walls at night
- Gamepad support (desktop)
- PWA manifest so it installs to home screen with an icon
- "Ask the Dev Team" v2: feedback endpoint checks for duplicates/planned items
  and replies in-game ("already planned for Milestone 3!") — needs a small
  AI/API call in the serverless function; research cost first

## Research Notes

*(agents: append dated findings here — what's current, what's possible, links)*

- 2026-07-02: Foundation built on Three.js 0.160 / Vite 5. Bundle 131 KB gz.
  Known-good baseline: tag v0.1.0-foundation.
- 2026-07-04: Heartbeat Observatory already has a proven Supabase Realtime
  shell. Use presence only for identity and broadcast movement at <=10Hz with
  idle suppression; do not build a separate websocket stack for visibility.
