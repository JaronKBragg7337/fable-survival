# HANDOFF.md — Session Log

Newest entry goes at the TOP. Every agent session (Cowork, Claude Code, scheduled
task) adds an entry before ending. This is how sessions with no shared memory
continue each other's work.

## Entry template (copy this)

```
## YYYY-MM-DD — <agent/session name> — <one-line summary>
**State:** working / broken / in-progress (details)
**Shipped:** what changed, files touched, deployed? (URL)
**Verified:** how you checked it (build, browser test, phone test)
**Next up:** the single most useful next step
**Gotchas:** anything surprising the next session must know
```

---

## 2026-07-02 — Claude (Cowork) — Built v0.1.0 foundation, deployed, repo created
**State:** working — live at https://fable-survival.vercel.app
**Shipped:** Entire game from scratch: Vite + Three.js, 16 modules in src/.
Movement (touch joystick + WASD/mouse), third/first-person camera, seeded world
(trees/rocks/roads/4 houses/safe zone), harvesting, 20-slot inventory, building
(floor/wall/door/campfire/storage), 12 pooled zombies with wander/chase/attack AI,
trader economy, vehicle repair stub (2 wrecks), 8-min day/night, localStorage
autosave. Deployed static dist/ to Vercel (project: fable-survival, account
kylerbragg73-2101). Tagged v0.1.0-foundation.
**Verified:** vite build clean (131 KB gz), loaded live URL in Chrome — zero console
errors, tested movement/inventory/HUD. Fixed one bug pre-deploy: camera-relative
movement signs were inverted in player.js.
**Next up:** Top of ROADMAP.md Milestone 1 (visual upgrade pass). Also: sound is
completely absent and cheap wins exist (see roadmap).
**Gotchas:**
- Deploys go from `dist/` (`cd dist && vercel deploy --prod --yes`), NOT project root.
- The sandbox mount of this folder syncs slowly/stale — if building from a Cowork
  sandbox, copy src to /tmp, build there, copy dist back. Claude Code running
  directly on the machine won't have this problem.
- `dist/assets/` may contain old hashed bundles that can't be deleted from the
  sandbox (permission); harmless, index.html references the right one. Can be
  cleaned from a normal shell.
- Owner's audience: his son + friends on phones. Fun and stability beat realism.
