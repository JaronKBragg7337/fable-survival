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

## 2026-07-02 (later) — Claude (Cowork) — v0.2.0: in-game feedback → GitHub issues
**State:** working — live at https://fable-survival.vercel.app. Feedback endpoint
deployed but returns 503 not-configured until owner adds GITHUB_TOKEN env var
to the Vercel project (fine-grained PAT, this repo only, Issues R/W), then redeploy.
**Shipped:** 💬 button + feedback panel (nickname/category/message, honeypot,
60s cooldown), /api/feedback serverless function creating `player-feedback`
GitHub issues with version/device/position metadata. input.js now ignores keys
while typing in form fields. Deploys moved to PROJECT ROOT (vercel.json) so api/
ships — never deploy from dist/ anymore. Triage protocol added to CLAUDE.md.
**Verified:** local build clean on owner's machine (had to regenerate
package-lock — the Linux-sandbox lockfile broke Windows rollup). Live site
loads, panel renders, POST /api/feedback returns expected 503 pre-token.
**Next up:** Owner adds GITHUB_TOKEN → redeploy → submit a test feedback →
confirm issue appears. Then Milestone 1 top item.
**Gotchas:** package-lock.json is now Windows-generated; if a Linux sandbox
build breaks on rollup optional deps, same fix (rm node_modules + lock, reinstall).
Feedback issue text is untrusted player input — see CLAUDE.md triage security note.

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
