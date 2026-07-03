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

## 2026-07-03 — Claude (Claude Code) — Phase 1 account model refined (owner decision, docs only)
**State:** working — no gameplay code touched. No build risk (docs + issues only).
Live game untouched; nothing deployed.
**Shipped:** Refined MULTIPLAYER_DESIGN.md for the owner's approved Phase 1
direction: **instant play, no login, + optional persistent accounts so survival
progress isn't lost.** Accounts = **username+password OR one-tap player-code, no
email in Phase 1** (email deferred, rationale in §2.4). Rewrote §2 (two account
types, shared recovery-code backup, password hashed server-side). §3.1 now spells
out that the cloud save protects the entire blob — inventory, stats, coins,
position, day/night, buildings, vehicles — plus any future base progress for free
(jsonb). Added §8.5 (instant-play-vs-lost-progress tradeoff, incl. iOS Safari
~7-day ITP eviction as the key risk for iPhone kids) and §8.6 (milestone-triggered
"save your game" prompt — once per session, dismissible, never a gate). Updated §6
to app-managed auth (not Supabase email Auth). Updated GitHub issues #5 (schema:
username/password_hash/recovery_hash), #6 (login endpoint + password hashing), #8
(prompt-to-save UX + login UI), #12 (tracking). ROADMAP Research Notes updated.
**Verified:** docs-only change; prior build already green (132.78 KB gz). No
gameplay files modified. Design cross-checked against actual save fields in §1.
**Next up:** Owner picks whether to start building Phase 1. First code step (issue
#5): Supabase project + accounts/saves tables with RLS. Then #6 /api functions,
#7 src/cloudSave.js, #8 UI + prompt. Do #9 (vehicles stable ids) before
cross-device saves ship.
**Gotchas:** STILL DESIGN ONLY — no implementation this session. Passwords must be
hashed server-side (bcrypt/argon2), never plaintext; auth endpoints rate-limited.
localStorage stays the source of truth on-device; any account/network work must
keep offline + opt-out play byte-for-byte unchanged.

## 2026-07-03 — Claude (Claude Code) — Multiplayer/cloud-save design doc (no code changes)
**State:** working — no gameplay code touched. Build verified green (132.78 KB gz,
matches prior handoff). Live game untouched; nothing deployed.
**Shipped:** New **MULTIPLAYER_DESIGN.md** — the technical design for the future
path from single-player to accounts → cloud saves → persistent bases → (eventually)
multiplayer. Covers: exact current save schema (grounded in save.js et al.), a
privacy-safe account model (player-code first, email deferred for COPPA reasons),
the cloud save envelope (same JSON in Supabase jsonb, world always seed-derived),
base/building persistence, three world/server models (shared-seed / authoritative
session / P2P), the Supabase+Vercel+GitHub architecture, multiplayer risks, and a
lowest-risk **Phase 1 optional cloud save** plan with verification gates. ROADMAP
Research Notes updated to point at it. This was a BOOTSTRAP.md run: read all docs,
verified build (no blocking fix needed → no gameplay changes, per task).
**Verified:** `npm install && npm run build` clean, 132.78 KB gz (within budget).
No open `player-feedback` issues (only #3, token rotation). Design grounded in a
full read of save/stats/inventory/daynight/building/vehicles/world/items/main and
api/feedback.js.
**Next up:** Owner decision on Phase 1. If yes: filed issues (cloud-save) — start
with the Supabase project + accounts/saves schema, then /api functions, then
src/cloudSave.js. Also low-risk tech-debt: give vehicles stable string ids
(currently saved by array index — see design §4.3) before cross-device saves ship.
**Gotchas:** DESIGN ONLY — do not build multiplayer yet; the doc's whole thesis is
walk-don't-run (cloud save first, realtime last). vehicles.js fromJSON maps saves
by positional index — a latent cross-device hazard flagged in the doc. Any backend
work must keep the game fully playable offline with localStorage as source of truth.

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
