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

## 2026-07-03 — Claude (claude-code) — #16 explorable structures (gas/barn/tower)
**State:** working — 3 new landmark structures. Live game safe; existing map
layout (trees/rocks/houses) unchanged.
**Shipped:** `src/world.js` — new `_buildStructures()` + `_gasStation`,
`_barn`, `_watchtower` builders following the `_house()` recipe (Group of
flat-colored meshes, axis-aligned box colliders + small circle colliders for
posts, loot crates/barrels, and each registered as a `lootArea` so zombies
spawn there). Called AFTER `_scatter()` so the seeded tree/rock layout is
byte-identical to before. Gas station at (11,56), barn (enterable via front
doorway) at (-62,-20), watchtower at (64,26). GAME_VERSION → 0.4.0, CHANGELOG
v0.4.0, ROADMAP Milestone-2 structures item checked off. Owner decisions also
recorded in ROADMAP: #15 "teach don't nerf" (no difficulty toggle), #16 next =
dropped loot then pickups. On PR #17 branch, not pushed to production.
**Verified:** `npm run build` green (134.05 KB gzip, under budget). Headless
Playwright: entered world, all 3 structures present as lootAreas, 153 colliders
/ 24 interactables registered, zero console errors. Collision probes — player
dropped inside the solid gas-station shop is ejected to open ground (finite
coords); barn interior stays walkable. Screenshotted all three facing-on: each
renders cleanly (no z-fighting/glitches), loot crates present, zombies spawn
nearby. Used a TEMP `window.game` debug handle for the QA and REMOVED it before
building/committing (verified absent; bundle hash matches the no-debug build).
**Next up:** #16 dropped loot (owner's stated next priority) — zombie/drop
loot lands on the ground as pooled pickups instead of vanishing. Then general
pickups. Damage telegraphing (#15 list) is also open but lower priority.
**Gotchas:** MULTIPLAYER_DESIGN.md referenced by issues #5–#12 is NOT in the
repo (never committed) — flagged to owner. Cloud-save direction decided
(username + password + recovery code) but backend provisioning (Supabase +
Vercel env vars) is owner-gated infra + COPPA-sensitive — do not build without
explicit go-ahead. Structures are unrotated on purpose (box colliders assume
no rotation).

## 2026-07-03 — Claude (claude-code) — #15 survival hints (start + death tips)
**State:** working — text-only UI, no gameplay/AI/balance change. Live game safe.
**Shipped:** `index.html` gains a `#start-tip` line and a `#death-tip` line
(+ CSS). `src/ui.js` sets a fixed start-screen night-danger warning and, on
death, shows one of six rotating survival tips (`DEATH_TIPS`) so a loss
teaches. Every tip is checked against the real mechanics (night detect
18m/12m, safe zone, bandage +25, food/water drain 2 HP/s at 0, heal only when
hunger & thirst > 60). Addresses the low-risk half of issue #15; balance
changes + damage telegraphing remain open (noted in ROADMAP). CHANGELOG →
v0.3.2. On PR branch `claude/game-maintenance-session-39zw54` (PR #17), not
pushed to production.
**Verified:** `npm run build` green (133.28 KB gzip, under budget). Headless
Playwright (393×851): start tip renders and is visible with the exact expected
text; zero console errors; entered world and start screen dismissed. Death
screen driven via DOM (game handle isn't global): death-tip renders, sits
above the Respawn button, no horizontal overflow, zero page errors.
**Next up:** issue #15 balance half (Day-1 grace / Easy-Normal toggle) or
damage telegraphing (red edge vignette) — both need an owner call on difficulty
feel. Or Milestone 1 "better trees." Cloud-save chain (#5–#8) still blocked on
the owner's account-model decision in #12.
**Gotchas:** the `game` context is not exposed on `window`; to drive gameplay
in a headless test you must add a temporary handle or play it out. Tips must
stay factually true to mechanics — update them if constants in stats.js /
enemies.js change.

## 2026-07-03 — Claude (claude-code) — Tech-debt #9: stable vehicle ids
**State:** working — serialization-only change, live game untouched.
**Shipped:** `src/vehicles.js` — each wreck now has a stable string `id`
(`wreck_a`, `wreck_b`). `toJSON` emits `{id, installed, repaired}`; `fromJSON`
matches saved entries by `id` and falls back to positional index for old
saves with no id (crash-proof, per CLAUDE.md save-compat contract). Removes a
latent hazard flagged in MULTIPLAYER_DESIGN.md §4.3 and is a prerequisite for
cross-device cloud saves. Not deployed to production by this branch (work is on
`claude/game-maintenance-session-39zw54` for PR review). CHANGELOG bumped to
v0.3.1; feedback metadata version left at v0.3.0 (unchanged).
**Verified:** clean `npm run build` before and after (132.83 KB gzip, under
budget). Wrote a standalone node test covering old-save (index fallback),
new-save (id match), reordered entries (correct car by id), stale/removed id,
and malformed entries — all pass. Headless mobile Playwright (393×851) boot of
`vite preview`: one canvas, zero console errors, zero 4xx.
**Next up:** Milestone 1 next item — better trees (2–3 instanced variants). Or
issue #15 (early-player survival tuning) / #14 (AI-workflow doc), both unblocked.
The Supabase cloud-save chain (#5–#8) is blocked on the owner's account-model
decision in #12.
**Gotchas:** Playwright is not a project dep; use the global at
`/opt/node22/lib/node_modules/playwright` (require it by absolute path from a
`.cjs` file). Preview server runs on any free port via `vite preview`.

## 2026-07-03 — Codex — Milestone 1 ground variety shipped
**State:** working — live game remains mobile-first and production deploy is
expected via `git push` to `main`.
**Shipped:** `src/world.js` now builds the base ground as one segmented
vertex-colored mesh with grass/darker grass/dry grass/dirt shoulder patches and
subtle static height variation, no textures or added assets. `src/enemies.js`
adds a 180-degree visual facing offset so zombie arms/front point in their
movement direction. `src/ui.js` feedback metadata bumped to v0.3.0. ROADMAP top
Milestone 1 item checked off. Deployed: https://fable-survival.vercel.app
**Verified:** clean temp build before edits passed; clean temp build after edits
passed (132.78 KB gzip JS, under budget). Local Chrome/Playwright Pixel 5 QA:
zero console/page/4xx events, entered world, touch controls visible, tapped HIT
near a deterministic tree and gained wood, moved with joystick, opened inventory
and saw wood. Visual screenshots inspected for road z-fighting, mobile overlap,
and ground patch readability. After push, production served the new bundle and
live Pixel 5 QA repeated the chop/move/inventory flow with zero console/page/4xx
events.
**Next up:** Milestone 1 next item: better trees with 2-3 variants, still
instanced.
**Gotchas:** Google Drive checkout still corrupts generated `node_modules`;
continue verifying builds from clean temp clones under `%TEMP%` when needed.

## 2026-07-03 — Codex — Fixed live favicon console 404
**State:** working — bootstrap found production loading with one console error:
Chrome requested missing `/favicon.ico`. Gameplay stayed playable, but the
"zero console errors" gate failed, so this session stopped at the bootstrap fix.
**Shipped:** added a tiny inline SVG favicon in `index.html` so browsers do not
request the missing default icon. Deployed by pushing `main` to Vercel Git
integration. URL: https://fable-survival.vercel.app
**Verified:** required docs read; `git log --oneline -10` matched the previous
top handoff; no open `player-feedback` issues. Clean temp clone build passed
before changes. Modified temp build passed. Local preview on Pixel 5 emulation:
entered world, mobile joystick/action buttons visible/tappable, one canvas,
zero console/page/4xx events.
**Next up:** Milestone 1 top item: ground variety / visual pass.
**Gotchas:** installing `node_modules` directly inside the Google Drive checkout
produced EBADF/invalid Vite package files. Clean temp clones under `%TEMP%`
install and build correctly; use that path for verification if Drive acts up.

## 2026-07-02 (night) — Claude (Cowork) — Clean-room test PASSED; push-to-deploy LIVE
**State:** working, 100% portable. Deploys are now `git push` (Vercel Git
integration, enabled by owner). A push IS a production deploy — verify first.
**Shipped:** BOOTSTRAP.md (first-contact protocol). CLAUDE.md deploy section
rewritten for push-to-deploy. PORTABILITY.md gap #1 marked resolved + clean-room
result recorded. Issues #2 and #4 closed.
**Verified:** Clean-room drill: fresh `gh repo clone` into an empty dir →
npm install (3s) → build produced a BYTE-IDENTICAL bundle. Zero undocumented
steps. Then pushed docs commit → Vercel auto-deployed production in 8s with no
CLI → game 200, /api/feedback 200, issue #4 created and closed.
**Next up:** Milestone 1 top item (ground variety / visual pass) — the
infrastructure era is done, back to the game itself.
**Gotchas:** since push = deploy, never push half-done work to main. If risky
work is needed, use a branch and merge when verified.

## 2026-07-02 (evening) — Claude (Cowork) — Portability audit, PORTABILITY.md
**State:** working — no gameplay changes this session (audit only)
**Shipped:** PORTABILITY.md (full new-machine recovery procedure, source-of-truth
map, secret recreation steps, disaster scenarios). AGENTS.md points to it.
GitHub issues #2 (enable Vercel-GitHub push-to-deploy — the last machine
dependency) and #3 (rotate GITHUB_TOKEN before 2026-09-30), label `portability`.
**Verified:** git ls-files vs local dir — all 32 files tracked, tree clean, no
untracked assets, both tags pushed, zero binary assets. Only gitignored items
are regenerable (node_modules, dist, .vercel). GITHUB_TOKEN lives in Vercel
cloud, not the laptop. Portability score: 95%.
**Next up:** Owner enables Vercel Git integration (issue #2) → then update
CLAUDE.md deploy section to "git push = deploy" and close the issue. After
that, Milestone 1 top item.
**Gotchas:** package-lock.json is platform-sensitive for rollup optional deps;
recovery steps for that are in PORTABILITY.md step 4.

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
