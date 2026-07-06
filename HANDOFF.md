# HANDOFF.md — Session Log

## 2026-07-06 — Claude — in-game AI chat that can act on live state (🤖)

**State:** live in production, but inert until the owner adds env vars (by
design — see below). Everything else in the game is unaffected either way.

**Shipped:** the owner asked to be able to talk to Claude from inside the
game and have it "make things happen." Added a 🤖 menubar button opening a
chat panel (`UI.openAiChat()` / `_renderAiChat()` / `_sendAiChat()` in
`src/ui.js`) and a new `api/aichat.js` Vercel function. Unlike `/api/feedback`
(one-way, safe by construction — it only ever becomes a GitHub issue), this
endpoint can mutate live gameplay, so it is gated behind a shared passphrase
(`AI_CHAT_KEY`) on top of `ANTHROPIC_API_KEY` — without both, it returns
`not-configured` and never calls Anthropic at all (zero cost/blast radius for
random players/testers). When configured, it calls the Anthropic Messages API
with a small fixed tool schema — `give_item`, `heal`, `give_coins`,
`set_time`, `teleport_safezone` — and the client applies returned actions
through `_applyAiAction()`, which re-validates/clamps every field again
client-side (defense in depth) and only touches existing public hooks
(`inventory.add`, `stats.consume`, `coins`, `dayNight.time`, `player.pos`) —
no new internal systems, no arbitrary code execution. Chat history is
in-memory only (capped at 20 turns), never persisted. `GAME_VERSION` bumped
to `0.7.0`. Full design/setup doc: AI_CHAT.md. `.env.example` documents the
three new env vars (placeholders only).

**Verified:** clean temp `npm install` + `npm run build` passed, 25 modules,
JS gzip 146.10 KB (under the 200 KB budget). Headless Playwright smoke:
🤖 panel opens, chat log renders, sending a message with no key set fails
gracefully with no new console/page errors (only a pre-existing, unrelated
sandbox network restriction blocking an external CDN import used by
`multiplayer.js`). Confirmed live post-deploy at
`https://fable-survival.vercel.app/`: served bundle hash matches the local
build exactly (`index-PQL0LRu8.js`); `POST /api/aichat` returns
`503 {"error":"not-configured"}` as expected pre-configuration.

**Next up:** owner must add `ANTHROPIC_API_KEY` (from
https://console.anthropic.com) and `AI_CHAT_KEY` (a private passphrase they
choose) to the Vercel project's environment variables, then redeploy (a
no-op `git push` or a manual redeploy from the Vercel dashboard both work —
env var changes need a fresh deployment to take effect). After that, typing
the matching dev code into the panel's "Dev code" field unlocks live actions.
`ANTHROPIC_MODEL` is optional (defaults to `claude-3-5-haiku-20241022`).
Longer-term ideas logged in ROADMAP.md Milestone 5 (expand the tool list;
consider surfacing this on start/death screens too if desired).

**Gotchas:** this is intentionally owner-gated, not a public feature — it is
a different, higher-stakes thing than the icebox "Ask the Dev Team v2" idea
(chat-only Q&A, still unbuilt). Do not relax the `AI_CHAT_KEY` gate or widen
the tool list without keeping every new action bounded/whitelisted the same
way; the whole point is that a wrong/missing key means zero effect, not a
degraded-permissions mode.

---

## 2026-07-06 — Claude — feedback reachable from every screen

**State:** live verified in production.

**Shipped:** the 💬 feedback button lived only in `#menubar`, which is behind
`#start-screen` and `#death-screen` (both `.fullscreen-msg`, z-index 100 vs
menubar's 20) — so a player who hadn't entered the world yet, or who had just
died, had no way to reach it even though `/api/feedback` worked fine mid-game.
Added a "💬 Send Feedback" button to both screens, wired to the existing
`UI.openFeedback()` flow (same panel, same `/api/feedback` → GitHub issue
pipeline, no backend changes). Raised `#fb-panel` z-index to 110 (above
`.fullscreen-msg`'s 100) so the panel is visible/clickable when opened from
those screens instead of rendering invisibly behind them. `GAME_VERSION` bumped
to `0.6.6`.

**Verified:** clean temp `npm install` + `npm run build` passed, 25 modules,
JS gzip 144.98 KB (under the 200 KB budget). Confirmed live at
`https://fable-survival.vercel.app/` post-deploy: both "💬 Send Feedback"
buttons render on the death screen and start screen.

**Next up:** the owner also wants an in-game AI chat that can take actions in
the world during the conversation (not just report feedback). That needs: a
new `/api/chat` serverless function calling an LLM with tool-calling, an
`ANTHROPIC_API_KEY` (or similar) added to the Vercel project's env vars, a
decision on which in-game actions are safe to expose, and — since this can
mutate game state — an access-gate so random players can't use it to break
balance. See conversation/session notes for the proposed design; not yet
started as of this entry.

**Gotchas:** none introduced. This is additive UI only — no changes to
`api/feedback.js`, save format, or multiplayer.

---

## 2026-07-05 — Codex — multiplayer build snapshot sync

**State:** live verified on standalone and Heartbeat-hosted routes.

**Shipped:** extended `src/multiplayer.js` with a `build-snapshot` Realtime
broadcast. On subscribe and when a new peer first sends state, a client with
placed build pieces sends up to 120 current records to that peer. Receivers
apply only records addressed to them (or broadcast to all), reuse the existing
duplicate check, and instantiate missing walls/floors/doors/campfires/storage.
`GAME_VERSION` is now `0.6.5`.

**Verified:** `node --check src/multiplayer.js src/ui.js`; `git diff --check`;
clean temp `npm install`; module smoke confirmed one addressed
`build-snapshot` send, two records applied once, duplicate snapshot ignored,
and wrong-target snapshot ignored; clean temp `npm run build` passed with 25
modules and JS gzip 144.96 KB. Production-dist Chrome smoke on
`http://127.0.0.1:5201/`: served `assets/index-BV92Sd35.js`, rendered one
canvas, entered the world, displayed HUD, initialized the Realtime chip, and
logged zero warnings/errors.
Standalone deploy poll returned 200 for `/assets/index-BV92Sd35.js` with
`build-snapshot` and `vehicleId`. Standalone live Chrome smoke at
`https://fable-survival.vercel.app/` rendered one canvas, entered the world,
displayed the HUD, initialized the Realtime chip, and logged zero
warnings/errors. Heartbeat hosted live smoke also passed at
`https://www.heartbeatobservatory.com/games/fable-survival/`.

**Next up:** durable shared bases/parked vehicles need a schema-backed pass.

**Gotchas:** this improves late-join visibility while at least one builder is
online. It is not durable after every client leaves. Durable shared bases and
parked vehicles still need a schema-backed object table with a game/world
namespace; the current Heartbeat `world_props` path is Town Square scoped and
selects all rows without a namespace.

---

## 2026-07-05 — Codex — multiplayer vehicle visibility + hosted device tier

**State:** live verified on standalone and Heartbeat-hosted routes.

**Shipped:** updated `src/multiplayer.js` so local Realtime state includes
`mode: "vehicle"`, stable `vehicleId`, car position, and car yaw while the
player is driving. Remote peers now render a compact vehicle mesh and hide the
walking survivor mesh during that mode, with the same interpolation buffer as
survivor movement. `src/vehicles.js` forces an immediate multiplayer state
packet on car enter/exit. `GAME_VERSION` is now `0.6.3`.
Follow-up: `src/main.js` now uses `window.HBDevice?.rendererPixelRatio(2, 1.5,
1.15)` when the Heartbeat shell provides it, with the old `Math.min(devicePixelRatio, 2)`
fallback for standalone hosting. `GAME_VERSION` is now `0.6.4`.

**Verified:** `node --check src/multiplayer.js src/vehicles.js src/ui.js`;
`git diff --check`; clean temp `npm install && npm run build` passed with 25
modules and JS gzip 144.70 KB. Production-dist browser smoke on
`http://127.0.0.1:5198/`: canvas rendered, start screen entered, HUD displayed,
Realtime chip initialized (`realtime · alone here · 4 in games`), and no
console warnings/errors appeared. Module smoke confirmed driving state emits
`mode: "vehicle"`, stable `vehicleId`, car position/yaw, and one broadcast
payload. Follow-up device-tier check: `node --check src/main.js src/ui.js` and
clean temp `npm install && npm run build` passed with JS gzip 144.72 KB.
Standalone deploy poll returned 200 for `/assets/index-Bx8fCYaW.js` with
`vehicleId` and `rendererPixelRatio`. Standalone live Chrome smoke at
`https://fable-survival.vercel.app/` rendered one canvas, entered the world,
displayed the HUD, initialized the Realtime chip, and logged zero
warnings/errors. Heartbeat hosted live smoke also passed at
`https://www.heartbeatobservatory.com/games/fable-survival/`.

**Next up:** durable shared bases/parked vehicles need a schema-backed pass.

**Gotchas:** this makes other players see driven vehicles live. It does not yet
make parked vehicles or bases durable/shared after reload. Use Heartbeat
Observatory's `world_props` + broadcast + reconcile pattern for that later
schema-backed pass.

---

## 2026-07-05 — Codex — #8 cloud-save UI

**State:** working in source; ready for commit after final diff review. The
cloud panel is optional and local saves still work without an account.

**Shipped:** added a top-right ☁ panel for create, login, recovery-code link,
manual upload, disconnect, and recovery-code copy. Added shared
`src/cloudKeys.js` so the panel and `src/cloudSave.js` use the same localStorage
keys. `CloudSave.connect()` stores opt-in/session and starts the existing
best-effort pull/upload bridge; `CloudSave.disconnect()` clears the bearer
session without deleting the local save. `GAME_VERSION` is now `0.6.2`.

**Verified:** `node --check src/cloudKeys.js src/cloudSave.js src/ui.js
src/main.js`; `git diff --check`; clean temp `npm install && npm run build`
passed with 25 modules and JS gzip 144.26 KB. Production-dist browser smoke on
`http://127.0.0.1:5192/`: disconnected cloud panel made zero API calls; mocked
create/login/link each stored the expected local session/account state and
called the intended `/api/account`, `/api/account/login`, `/api/account/link`,
and `/api/save` routes; manual upload sent a real save blob with
`client_version: 0.6.2`. Mobile 390x844 screenshot showed the panel fit without
horizontal overflow or text overlap.

**Next up:** ship/push, verify live standalone, close #8, then move to gameplay
expansion (#15/#16) or SYL playtest audit.

**Gotchas:** this UI does not store passwords. It stores the short-lived bearer
session plus public account metadata in browser localStorage. The recovery code
is displayed and locally cached so the player can copy it; it can only be used
once by the existing server API.

---

## 2026-07-05 — Codex — #7 cloud-save client bridge

**State:** working in source. The bridge is dormant for current players until a
future UI stores both `fable_cloud_opt_in_v1=1` and a
`fable_cloud_session_v1` bearer session.

**Shipped:** added `src/cloudSave.js`, wired it into `src/main.js`, and
factored `src/save.js` into `snapshot()`, `readLocal()`, `writeLocal()`, and
`apply()` so cloud transport uses the real serializer instead of duplicating
save shape. LocalStorage remains the on-device source of truth. Startup still
loads local immediately; cloud pull is async/best-effort. Local saves call
`cloudSave.onLocalSave()` after the local write, which debounces `PUT /api/save`
only when opt-in + session are present. Divergent cloud/local saves prompt
before applying cloud or uploading local.

**Verified:** `node --check src/save.js src/cloudSave.js src/main.js`; clean
temp copy build passed (`npm install`, `npm run build`) with 24 modules and JS
gzip 142.61 KB. Production dist smoke on `http://127.0.0.1:5187/` with no
cloud opt-in: one canvas, start screen enters, HP 100%, zero console/page
errors, zero `/api/save` or `/api/account` requests. Mocked active-path browser
smoke: opt-in + fake session produced `GET /api/save` with bearer token; manual
save debounced a `PUT /api/save` with the real save blob, save version,
`client_version: 0.6.1`, and device label; metadata updated.

**Next up:** #8 cloud-save UI: account/link/login controls and a clear
"play on another device" code flow.

**Gotchas:** `npm install && npm run build` timed out in the Google Drive
checkout, matching the known Drive/node_modules issue. Verification used a
clean temp copy excluding `.git`, `node_modules`, `dist`, and `.vercel`. The
existing Vite/esbuild audit findings remain tracked separately as #18.

---

## 2026-07-04 — Codex — Heartbeat realtime multiplayer MVP

**State:** working in source. Hosted Heartbeat copy is generated from this repo's
production build.

**Shipped:** added `src/multiplayer.js`, wired it into `src/main.js`, broadcast
player attack hints from the attack input path, and broadcast newly placed
building pieces from `src/building.js`. Added a compact `#mp-chip` to
`index.html`. Multiplayer uses the existing Heartbeat Observatory Supabase
Realtime project for presence/state and leaves Fable's separate cloud-save
Supabase project alone.

**Verified:** `node --check` passed for edited modules. Production build passed
from a clean temp checkout because this Google Drive checkout's `node_modules`
folder was corrupted/incomplete for Vite extraction.

**Next up:** two-tab/two-phone playtest from
`https://www.heartbeatobservatory.com/games/fable-survival/`: both clients
should enter the world, see the realtime chip, see remote survivor movement,
and see a placed build piece appear on the other client.

**Gotchas:** this is visibility/co-presence multiplayer, not authoritative
combat. Enemy ownership, shared base persistence, and anti-cheat/PVP rules are
still future architecture work.

---

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

## 2026-07-03 — Codex — #6 cloud-save Vercel API
**State:** working — live endpoint smoke passed; gameplay bundle unchanged.
**Shipped:** Added `api/_cloud.js`, `api/account.js`,
`api/account/login.js`, `api/account/link.js`, and `api/save.js`.
`POST /api/account` creates username/password accounts or one-tap player-code
accounts; returns a one-time recovery code plus session token. Login verifies
passwords; link redeems recovery codes. `GET/PUT /api/save` require
`Authorization: Bearer <session token>`. Added `bcryptjs` dependency for
password/recovery-code hashing. Added Supabase migrations for
`player_sessions` and redundant-index cleanup. Docs updated.
**Verified:** Clean temp worktree `npm install && npm run build` passed, 21
modules, JS gzip 134.83 KB; API helper/handler imports passed. Supabase
migration list shows `cloud_save_foundation`, `cloud_save_sessions`, and
`drop_redundant_session_token_index`; RLS enabled on accounts/saves/sessions.
Security advisors show only expected INFO-level "RLS enabled no policy" notices
for server-only tables. Live Vercel smoke passed: created password account,
logged in, PUT save, GET save with semantic save fields intact, linked via
recovery code, created one-tap player-code account, then deleted both test
accounts from Supabase.
**Next up:** #7 `src/cloudSave.js` client bridge layered over localStorage, then
#8 UI for optional cloud save.
**Gotchas:** Rate limiting is in-memory per serverless instance; good enough for
Phase 1 friction, not a hard abuse wall. Recovery codes are one-time for link.
The UI still does not expose cloud save until #7/#8.

## 2026-07-03 — Codex — #5 Supabase cloud-save foundation
**State:** working — Supabase project exists and schema foundation is applied.
Live game remains unchanged; cloud save is not called by gameplay yet.
**Shipped:** `supabase/migrations/20260703094251_cloud_save_foundation.sql`
creates `player_accounts` and `player_saves` with RLS enabled and server-only
`service_role` grants. Revoked public/anon/authenticated execute on
`public.rls_auto_enable()` after Supabase advisors flagged it. Added
`.env.example` placeholders plus `SUPABASE.md`; updated BOOTSTRAP/AGENTS,
ROADMAP, PORTABILITY, CHANGELOG.
**Verified:** Supabase connector sees project `fable-survival`
(`ukguppzfpvdcemyxzdbn`) ACTIVE_HEALTHY in us-west-2. Migration applied
successfully; migration list shows `20260703094251 cloud_save_foundation`.
SQL verification: both tables exist with RLS enabled; anon/authenticated have
no grants; service_role has table access. Security advisors now only show
INFO-level "RLS enabled no policy" notices for those server-only tables;
performance advisors clean.
**Next up:** #6 Vercel `/api/account` + `/api/save` functions, but only after
the owner adds `SUPABASE_URL` and the Supabase secret key to Vercel as
`SUPABASE_SECRET_KEY`. Do not paste the `sb_secret_...` key into chat or commit
it.
**Gotchas:** The pasted `sb_publishable_...` key is browser-safe by design, but
the repo intentionally stores only placeholders. The live app has no Supabase
runtime dependency yet, so this commit should not change gameplay behavior.

## 2026-07-03 — Codex — #16 dropped loot ground pickups
**State:** working — dropped items are tangible again, mobile QA passed locally.
Live deploy expected via push-to-main Vercel integration.
**Shipped:** `src/pickups.js` adds a fixed 32-item pooled ground-pickup system.
Inventory Drop 1 / Drop all now spawns pickups just ahead of the player instead
of deleting items. Infected still award coins immediately, but their bonus
bandage/scrap loot now drops on the ground at the body. Pickups can be collected
with USE inside range or by walking over them. `main.js` wires the system into
the loop; `ui.js` bumps GAME_VERSION to 0.5.0; docs updated.
**Verified:** Google Drive checkout build still hangs, so verification used a
temp worktree without `node_modules/.git/dist`. `npm install && npm run build`
green there: 21 modules, JS gzip 134.83 KB. Module smoke passed for pickup
spawn/collect and zombie loot drop path. Local production preview Pixel-size
Playwright QA: dropped canned food, saw "Pick up Canned Food x1 — tap USE",
tapped USE, inventory restored the can, zero relevant console warnings/errors,
zero page errors, zero request failures. Pre-work production smoke also passed:
live URL loaded, mobile HIT harvested wood, inventory showed Wood x1, movement
saved position changes.
**Next up:** Continue #16 loop depth with a small general-pickup follow-up
only if needed (for example save/restore active ground pickups), otherwise
return to ROADMAP top unchecked Milestone 1 item: better trees with 2-3
instanced variants.
**Gotchas:** Active ground pickups are runtime-only and are not serialized in
localStorage; that is intentional for this slice but should be revisited before
valuable persistent loot piles matter. Browser plugin pointer-lock clicks
produce `WrongDocumentError`, so use standalone Playwright for desktop canvas
attack QA. npm audit reports Vite/esbuild dev-server/tooling findings requiring
a Vite major upgrade to force-fix; tracked separately as #18, do not combine
with gameplay work.

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
