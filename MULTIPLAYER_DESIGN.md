# MULTIPLAYER_DESIGN.md — Path to Accounts, Cloud Saves & Persistent Multiplayer

**Status:** Design only. No gameplay code changed in the session that wrote this.
**Author:** Claude (Claude Code) — 2026-07-03
**Scope:** Define the *safest* path from today's single-player, single-device
browser game to accounts → cloud saves → persistent bases → real-time multiplayer.

> Read this alongside ARCHITECTURE.md (which explains why the game is built the
> way it is) and CLAUDE.md (prime directives). Nothing here overrides the prime
> directive: **the live game at https://fable-survival.vercel.app must never break.**
> This document is a map, not a mandate — each phase ships only after the previous
> one is verified live, and any phase can be paused indefinitely.

---

## 0. TL;DR (read this if nothing else)

- The current save is tiny and clean: one JSON blob in `localStorage`
  (`fable_survival_v1`), because the world is **deterministic from a seed**
  (`20260702`) and only *dynamic* state is stored. This is a gift — cloud save
  is "put this same blob in a database keyed by a user."
- **Do not jump to multiplayer.** Real-time shared worlds are a large, ongoing
  cost (servers, sync, cheating, moderation of kids) and directly threaten the
  prime directive. The value ladder is: **accounts + cloud save** (huge win,
  low risk) → **cross-device continuity** → *optional, much later* → co-op.
- **Phase 1 (recommended next):** optional cloud save behind an account, layered
  *on top of* localStorage, never replacing it. If the network or the backend is
  down, the game plays exactly as it does today. This is the lowest-risk step and
  unlocks the thing kids actually want ("I want my base on my friend's phone").
- Recommended backend: **Supabase** (Postgres + Auth + Row-Level Security),
  called from **Vercel serverless functions** (same pattern as the existing
  `/api/feedback.js`), with GitHub staying as source-of-truth for code + issues.

---

## 1. Current game state that must be saved

Ground truth is `src/save.js`. The world is **not** saved — `src/world.js`
regenerates every tree/rock/house/road identically from the hard-coded seed
`20260702` (`mulberry32`), so saves only carry *dynamic* state. Keep it that way:
dynamic state must never reference world-node indices, or a worldgen change would
corrupt old saves (see ARCHITECTURE.md "Why a seeded/deterministic world").

Today's `localStorage` key: **`fable_survival_v1`**, autosaved every 25 s
(`AUTOSAVE = 25`). The full snapshot (`save.js` `save()`):

| Field       | Source (`toJSON`)      | Shape                                                        | Notes |
|-------------|------------------------|-------------------------------------------------------------|-------|
| `v`         | literal `1`            | number                                                       | Schema version. **Bump on any structural change.** |
| `stats`     | `stats.js`             | `{ health, stamina, hunger, thirst }` (0–100 floats)        | `dead` is intentionally not saved (always revives false on load). |
| `inv`       | `inventory.js`         | array length 20 of `null \| { id, count }`                  | `id` must exist in `ITEMS` on load or the slot is dropped. |
| `coins`     | `game.coins`           | number (new players start 20)                               | Currency for the trader. |
| `pos`       | `main.js`/`player.js`  | `{ x, z }` (floats)                                         | Y is not stored — player is ground-clamped. |
| `dayNight`  | `daynight.js`          | `{ time (0–24 float), day (int) }`                          | Drives sun/fog/night; enemies read `isNight`. |
| `buildings` | `building.js`          | array of piece records (see §4)                            | Includes per-storage-box inventories. |
| `vehicles`  | `vehicles.js`          | array of `{ installed:{fuel,battery,wheel}, repaired }`     | **Positional** — index = wreck index, not an ID (see §4.3). |

### What is deliberately NOT saved (and why it matters for cloud)
- **World layout** — regenerated from the seed. If we ever go multiplayer, the
  seed becomes a *shared server value*, not a client constant (see §5).
- **Enemy state** — zombies are a pooled, transient system (`enemies.js`); they
  respawn. Not persisted, and shouldn't be in Phase 1.
- **Harvested-node / looted-crate timers** — `world.js` respawns nodes after
  `NODE_RESPAWN=60s` / crates after `CRATE_RESPAWN=120s`; transient, not saved.
  (Note: this is a candidate for later persistence in multiplayer — see §6.)
- **Trader stock** — static (`trader.js`), regenerated.

### Save-compatibility contract (do not break)
1. `save.js` already try/catches load and validates item ids — **keep every load
   path crash-proof against old/missing fields.** Cloud sync must not weaken this.
2. When schema changes, **bump the version and migrate** (see §3.3). Never assume
   a newer field exists.
3. Players already have live saves in `localStorage`. Any account system must
   **adopt the existing local save as the player's first cloud save**, not wipe it.

---

## 2. Player account model

The audience is kids on phones (owner's son + friends). The account system must be
**frictionless, privacy-safe, and impossible to lock a kid out of their base.**

### 2.1 Design principles
- **Anonymous-first.** A player should be able to keep playing with zero signup,
  exactly as today. Accounts are an *upgrade* ("save to the cloud / play on
  another phone"), never a gate.
- **No passwords for kids.** Passwords + kids = lockouts and shared credentials.
  Prefer a **magic-link email** or a **device-linked "player code"** (see below).
- **Minimal PII.** Store a self-chosen handle and, at most, an email for magic
  links. This mirrors PLAYER_FEEDBACK.md privacy rules: handles only, no real
  names, no ages/schools/locations. **COPPA/GDPR-K caution: collecting a child's
  email is a legal responsibility.** The safest v1 avoids email entirely (see
  "Player code" option) and defers true email auth until the owner decides it's
  worth the compliance burden.

### 2.2 Two account options (pick per phase)

**Option A — "Player Code" (recommended for Phase 1, no email, no PII):**
- On first cloud-save opt-in, the server mints an opaque account: a random UUID
  (`player_id`) + a short human-friendly **recovery code** (e.g. `FABLE-7Q2K-9WTX`).
- The device stores `player_id` in `localStorage`; the recovery code is shown once
  ("write this down to play on another phone"). Entering the code on a new device
  links it to the same account.
- Zero email, zero password, COPPA-friendly. Downside: a lost code = lost cloud
  account (but the local save on the original device still works — nothing is
  destroyed). Good enough and safe for a kids' game.

**Option B — Magic-link email (defer to later phase, only if the owner wants it):**
- Supabase Auth email OTP / magic link. Real account recovery, but introduces
  email collection from minors → compliance obligations. Only adopt with the
  owner's explicit decision, and consider requiring a parent's email.

### 2.3 Account data model (conceptual)
```
account
  player_id     uuid    (primary key)
  handle        text    (self-chosen nickname, ≤24 chars, sanitized like feedback.js)
  recovery_code text    (hashed; Option A)
  email         text    (nullable; Option B only)
  created_at    timestamptz
  last_seen_at  timestamptz
```
Handle sanitation should reuse the exact rules already in `api/feedback.js`
(`slice(0,24)`, strip `<>@`). One player → one account → one save (Phase 1).
Multiple save slots become `save_slot` rows later if desired.

---

## 3. Inventory / save schema (cloud version)

### 3.1 Guiding rule: the cloud save IS the local save
Do **not** invent a new shape. The cloud payload is the *same JSON* `save.js`
already produces, wrapped in an envelope. This keeps `save.js` as the single
serializer and makes migration trivial.

### 3.2 Cloud envelope
```jsonc
{
  "schema": 2,                 // envelope version (distinct from inner save "v")
  "player_id": "uuid",
  "world_seed": 20260702,      // captured so a future seed change won't silently
                               // load a save built against a different map
  "updated_at": "2026-07-03T12:00:00Z",
  "client_version": "0.3.0",   // from ui.js feedback metadata / build
  "save": { /* exact object save.js writes today: v, stats, inv, coins, pos, dayNight, buildings, vehicles */ }
}
```

Postgres table (Supabase):
```sql
create table saves (
  player_id   uuid primary key references accounts(player_id),
  world_seed  bigint not null,
  save        jsonb  not null,      -- the whole snapshot; small (<10 KB typical)
  schema      int    not null default 2,
  updated_at  timestamptz not null default now()
);
-- Row-Level Security: a player can read/write only their own row.
alter table saves enable row level security;
```
Storing `save` as `jsonb` means **zero schema churn** when the game adds items,
building pieces, or stats — the inner blob evolves freely, exactly like
localStorage does today. We only ever touch SQL for account/multiplayer concerns,
not for gameplay content.

### 3.3 Migration & conflict rules
- **Inner `save.v`** stays the migration hook for gameplay-shape changes
  (`save.js` handles this). **Envelope `schema`** covers cloud-structure changes.
- **Conflict policy (Phase 1):** last-write-wins by `updated_at`, but on load
  compare cloud `updated_at` vs the local save's implied recency and, if they
  diverge meaningfully, **ask the player** ("Cloud save is newer — load it?")
  rather than silently overwriting a base. Kids will rage if a base vanishes.
- Never delete a local save on cloud sync. Local is the offline fallback forever.

---

## 4. Base / building persistence schema

### 4.1 Today's building record (from `building.js` `toJSON`)
```jsonc
{
  "piece": "wall",     // floor | wall | door | campfire | storage
  "x": 12, "z": -4,    // grid-snapped ints
  "rotY": 1.5708,      // 0 / 90 / 180 / 270 in radians
  "open": false,       // doors only
  "invData": [ /* 12-slot inventory array */ ]  // storage boxes only
}
```
Colliders and interactables are **rebuilt from these records** on load by
`_instantiate()` — they are not saved. This is already the right design: the
persisted form is minimal and declarative. **Keep base persistence declarative.**

### 4.2 Cloud form
For Phase 1, `buildings` rides inside the single `save` blob (§3.2) — no separate
table needed. It's small (a big base is dozens of pieces, each a tiny object).

**Only split buildings into their own table when bases become *shared* or
*server-authoritative*** (multiplayer). At that point:
```sql
create table base_pieces (
  id         uuid primary key default gen_random_uuid(),
  base_id    uuid references bases(id),      -- a base owned by a player/party
  piece      text not null,                  -- floor|wall|door|campfire|storage
  x int, z int, rot_y real,
  state      jsonb,                          -- { open, invData } etc.
  updated_at timestamptz default now()
);
```
This lets one piece change without rewriting the whole base and gives per-piece
conflict resolution — but it's **premature until multiplayer**. Do not build it
in Phase 1.

### 4.3 ⚠️ Known fragility to fix before cloud: vehicles are positional
`vehicles.js` `fromJSON` maps saved entries to wrecks **by array index**, and the
two wrecks are created at hard-coded positions in the constructor. That's fine for
a fixed single-player map but is a **latent migration hazard**: if the number or
order of wrecks ever changes, old saves silently attach repair progress to the
wrong car. Before or during Phase 1, give each wreck a stable string `id`
(e.g. `wreck_a`, `wreck_b`) and serialize `{ id, installed, repaired }` keyed by
id, not index. Low-risk, save-compatible change (fall back to index if `id`
absent). **This is a documentation flag, not a Phase-1 blocker** — file as its
own issue (see §9).

---

## 5. World / server model options

The central question for multiplayer is **who owns the truth about the world.**
Three models, cheapest/safest first:

### Model 1 — Shared *seed*, independent worlds (no server truth) ✅ safest
Everyone plays the **same deterministic map** (already true — seed `20260702`),
but each player's dynamic state (base, inventory, harvested nodes) is their own,
stored per-account. "Multiplayer" here means *social*, not *simultaneous*:
- **Daily challenge seed** (already in ROADMAP Milestone 4): everyone gets the
  same layout that day; compare days-survived on a leaderboard.
- **Leaderboards** (days survived, biggest base): a read-mostly table.
- **Visit-a-base (async):** snapshot a friend's base blob and let others walk
  through a read-only copy. No real-time anything.
- **Cost:** basically free (Supabase free tier + existing Vercel functions).
- **Risk to live game:** near zero — it's all additive, offline still works.

### Model 2 — Authoritative session server (real-time co-op) ⚠️ big step
A server process holds the truth for a *session* (a party of 2–4 friends sharing
one live world): player positions, enemy state, loot, base edits, all synced.
- Requires a **stateful, always-on process** (WebSocket server). Vercel functions
  are stateless/short-lived — **this does not fit the current serverless model.**
  Options: a small Node WebSocket server on Fly.io/Railway/Render, Supabase
  Realtime (Postgres change broadcast — good for low-frequency state, not 20 Hz
  position sync), or PartyKit/Cloudflare Durable Objects (purpose-built for this).
- **Cost:** a real, ongoing hosting bill and ops burden (the thing ARCHITECTURE.md
  and VISION.md deliberately avoided). Needs anti-cheat (server validates moves),
  rate limiting, and reconnection handling.
- **Risk to live game:** high if it touches the main bundle/loop. Must be built
  behind a flag and as a separate mode so single-player is untouched.

### Model 3 — P2P WebRTC co-op (no game server) 🧪 research
Host-authoritative peer mesh (one player's phone is "host"). No server bill for
game state, but: NAT traversal needs a STUN/TURN server (TURN isn't free at
scale), host migration is painful, phones make weak hosts, and cheating is
trivial. **Interesting for tiny 2-player co-op; document findings before betting
on it** (ROADMAP already lists this as "research first").

### Recommendation
**Ship Model 1 incrementally; treat Model 2 as a separate, later, opt-in "co-op
mode" that never destabilizes the core game; keep Model 3 as research only.**
The 80/20 win — accounts, cloud save, cross-device, leaderboards, daily seed,
async base visits — is entirely inside Model 1 and Phase 1's cloud-save
foundation. Real-time multiplayer is the last 20% at 5× the risk.

---

## 6. Supabase / Vercel / GitHub architecture option

This slots into the **existing** infra with no new paradigm. The project already
runs Vercel serverless functions (`/api/feedback.js`) with a secret env var
(`GITHUB_TOKEN`) and deploys on `git push` to `main`.

```
                        ┌─────────────────────────────────────────────┐
   Phone browser        │  Vercel (already in use)                     │
   (Three.js game) ─────┤  • static game (dist/)                       │
     src/save.js        │  • /api/feedback.js   (exists)               │
     + cloudSave.js ────┼─▶• /api/save.js       (new: GET/PUT save)    │
     (new module)       │  • /api/account.js    (new: mint/link code)  │
                        │  • /api/leaderboard.js(new, Model 1)         │
                        └───────────────┬─────────────────────────────┘
                                        │ service-role key (server-only secret)
                                        ▼
                        ┌─────────────────────────────────────────────┐
                        │  Supabase                                    │
                        │  • Postgres: accounts, saves, (later) bases, │
                        │    leaderboard                               │
                        │  • Auth (Option B, later) / or app-managed   │
                        │    player codes (Option A, Phase 1)          │
                        │  • Row-Level Security                        │
                        └─────────────────────────────────────────────┘

   GitHub  ── code source-of-truth, issues, player-feedback pipeline (unchanged)
```

**Why this split:**
- **Vercel functions as the only thing that talks to Supabase.** The browser
  never holds the Supabase service key — it calls our `/api/*` functions, which
  hold the secret (exactly like `feedback.js` holds `GITHUB_TOKEN`). This keeps
  the client dumb and the trust boundary in one place we already understand.
- **Supabase free tier** comfortably covers a handful of kids: Postgres, auth,
  RLS, generous row/egress limits. No bill for Phase 1.
- **GitHub is untouched** as code + issue store. No architectural drift.
- **New secrets** (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`) live in Vercel env
  vars — add them to PORTABILITY.md's secret-recreation list and note their
  rotation, same as the existing `GITHUB_TOKEN` reminder (issue #3).

**New client module:** `src/cloudSave.js` (one system, one file — per
ARCHITECTURE.md rules). It wraps `save.js`: still writes localStorage every 25 s;
*additionally* debounce-pushes to `/api/save` when online and logged in; pulls on
load and reconciles per §3.3. `save.js` stays the serializer; `cloudSave.js` is
pure transport + reconciliation. **If any network call fails, it logs and the
game continues on localStorage** — non-negotiable.

**Alternative considered:** Vercel KV / Postgres instead of Supabase. Workable,
but Supabase's built-in Auth + RLS is worth more than staying single-vendor,
especially for the account model. Vercel KV is fine as a fallback if the owner
prefers one dashboard; the envelope in §3.2 is storage-agnostic.

---

## 7. Risks of multiplayer (why we walk, not run)

1. **Prime-directive risk.** The #1 rule is "never break the live game." Real-time
   multiplayer is the single change most likely to. Every multiplayer feature must
   be additive and flagged, with single-player fully intact if the backend is down.
2. **Ongoing cost & ops.** Model 2 needs an always-on server — a monthly bill and
   uptime responsibility the project was explicitly designed to avoid
   (ARCHITECTURE: "Why localStorage instead of a backend").
3. **Cheating.** Client-authoritative multiplayer = trivially hacked (infinite
   items, teleport). Server authority is a lot of work; without it, co-op with
   strangers is unplayable. (With just friends, lower stakes — scope matters.)
4. **Child safety & moderation.** Shared spaces + chat + kids = a moderation and
   safety duty (grooming, bullying, PII leakage). **If multiplayer ever allows
   strangers or free-text chat, that is a serious responsibility.** Safest posture:
   **friends-only via invite/party code, no free-text chat** (canned emotes only),
   and no visible PII (handles only, per PLAYER_FEEDBACK.md).
5. **Privacy/legal (COPPA/GDPR-K).** Collecting kids' emails or persistent
   identifiers has legal weight. Player-code accounts (Option A) sidestep most of
   it; email auth (Option B) needs a deliberate decision and possibly parental
   consent.
6. **Performance.** Network sync + remote player meshes + interpolation add CPU,
   GC, and draw calls on phones — the exact budget ARCHITECTURE.md guards. A 4-player
   world is 4× the entities.
7. **Complexity tax on AI maintenance.** The repo is maintained by memoryless AI
   sessions. A stateful realtime server is far harder for a fresh session to reason
   about safely than the current pure-client game. Every added system raises the
   chance a future session breaks something.
8. **Save/version skew.** Multiplayer means clients on different game versions must
   interoperate or be gated. Single-player tolerates old saves gracefully; a shared
   session cannot tolerate divergent rules.

**Mitigation posture baked into this plan:** ladder the value (accounts → cloud →
social/async → *maybe* realtime), keep everything additive and flagged, keep
single-player authoritative-per-device until the very last phase, friends-only +
no free chat if realtime ever ships.

---

## 8. Lowest-risk Phase 1: optional cloud save (the recommended next step)

**Goal:** a player can save their progress to the cloud and continue on another
device — with **zero** change to how the game plays offline or for players who
never opt in.

**Why this first:** it's the highest-value / lowest-risk rung, it's what the kids
actually ask for ("play my base on my other phone / my friend's phone"), and it
builds the account + backend foundation every later phase needs — without any of
multiplayer's realtime, cheating, or moderation risk.

### 8.1 Hard constraints (the guardrails)
- **localStorage remains the source of truth on-device.** Cloud is a mirror.
- **Offline and opt-out players are byte-for-byte unaffected.** No account, no
  network dependency — the game must run identically with the Wi-Fi off.
- **No secret ever reaches the browser.** All Supabase access via `/api/*`
  functions holding server-side keys (mirror `feedback.js`).
- **No new blocking startup path.** Cloud pull is async and best-effort; the game
  starts on the local save immediately and reconciles when/if the cloud replies.
- **Build stays under budget** (~200 KB gz; the new client module is tiny — it's
  fetch + JSON, no new heavy deps).

### 8.2 Slice of work
1. Supabase project + `accounts` and `saves` tables with RLS (§2.3, §3.2).
2. Vercel functions: `POST /api/account` (mint player-code account, Option A),
   `POST /api/account/link` (redeem code on a new device), `GET/PUT /api/save`
   (read/write the envelope; server checks the request's `player_id`).
3. `src/cloudSave.js`: opt-in flow, debounced push on top of the existing 25 s
   autosave, pull-and-reconcile on load (§3.3 conflict UX). Fails silent to local.
4. Minimal UI: a "☁️ Cloud Save" entry (settings/start screen) — "Enable cloud
   save" → shows the recovery code once; "Play on another device" → enter code.
   Keep it out of the way of the core HUD; kids ignore what they don't need.
5. Fix the vehicles positional-id fragility (§4.3) so cross-device saves are safe.
6. Env vars + PORTABILITY.md update + a rotation note for the new Supabase keys.

### 8.3 Verification gates (per CLAUDE.md, before any deploy)
- `npm run build` passes, bundle within budget.
- **Wi-Fi off:** game starts, plays, saves locally exactly as today (opt-out path).
- Opt-in on device A → get code → fresh device/profile B → enter code → base,
  inventory, coins, day all restored.
- Kill the backend (bad env var) → game still starts and plays on localStorage,
  no console errors that break the "zero errors" gate, a graceful toast at most.
- Conflict path: edit on A, then on B, confirm the "which save?" prompt appears
  rather than silent base loss.

### 8.4 Explicit non-goals for Phase 1
No realtime, no shared worlds, no seeing other players, no chat, no leaderboard
(that's an easy Model-1 follow-on, but not required to bank the cloud-save win).

---

## 9. Roadmap issues to create (next implementation steps)

Filed as GitHub issues on `JaronKBragg7337/fable-survival` this session
(2026-07-03). Ordered by dependency/priority:

- **#12** [design] Persistent-multiplayer / cloud-save architecture — tracking
  issue for this doc; owner reacts before any code. *(meta)*
- **#5** [phase-1] Cloud save foundation: Supabase project + accounts/saves schema
  — stand up Supabase, tables, RLS. Backend only, no client changes. *(blocks #6–#8)*
- **#6** [phase-1] `/api/account` + `/api/save` Vercel functions (player-code auth)
  — server endpoints mirroring the `feedback.js` secret pattern. *(depends on #5)*
- **#7** [phase-1] `src/cloudSave.js` — optional cloud save layered over localStorage
  — opt-in, debounced push, pull+reconcile, fail-silent to local. *(depends on #6)*
- **#8** [phase-1] Cloud-save UI: enable + "play on another device" code flow
  — minimal settings entry; show recovery code once. *(depends on #7)*
- **#9** [tech-debt] Give vehicles stable string ids (drop positional index in saves)
  — §4.3; small, save-compatible, do before cross-device saves ship. *(independent)*
- **#10** [phase-2] Model-1 social: days-survived leaderboard + daily challenge seed
  — read-mostly table; low risk; folds in ROADMAP Milestone 4 items. *(depends on #5)*
- **#11** [research] Realtime co-op feasibility (Model 2 vs 3) on free/cheap hosting
  — write findings to ROADMAP Research Notes; **no build** until owner decides. *(research)*

Suggested labels: `multiplayer-design`, `phase-1-cloud-save`, `tech-debt`,
`research`. These are net-new labels; the repo currently uses `player-feedback`
and `portability`.

---

## 10. Change log for this design

- **2026-07-03 — Claude (Claude Code):** Authored this document after a full read
  of `save.js`, `stats.js`, `inventory.js`, `daynight.js`, `building.js`,
  `vehicles.js`, `world.js`, `items.js`, `main.js`, and `api/feedback.js`. No
  gameplay code changed. Build verified green (132.78 KB gz). Filed roadmap issues
  (issues #5–#12) and updated HANDOFF.md + ROADMAP.md Research Notes.
  Recommendation: proceed with **Phase 1 cloud save (Model 1)** when the owner is
  ready; defer realtime multiplayer.
