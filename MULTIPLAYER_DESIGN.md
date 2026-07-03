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
- **Phase 1 (owner-approved direction, 2026-07-03):** *instant play with no
  login*, plus **optional persistent accounts** so serious players don't lose
  survival progress. Cloud save is layered *on top of* localStorage, never
  replacing it. If the network or backend is down — or the player never makes an
  account — the game plays exactly as it does today. Accounts use **a username +
  password, or a one-tap player-code — no email required in Phase 1** (see §2).
- **The tradeoff, stated plainly:** anonymous/local players start in ten seconds
  but their progress lives only in that one browser's storage — it's gone if
  storage is cleared, on a new device, or (notably on iPhones) after iOS Safari
  evicts unused site data. Account players keep their world across clears and
  devices. So the game **prompts a player to save an account right when their
  progress first becomes worth protecting** (first base, survived a night, got a
  tool/vehicle part) — never as a launch gate (see §8.5).
- Recommended backend: **Supabase** (Postgres + Row-Level Security), with
  **app-managed accounts** (username+password hashed server-side, or player-code —
  no email), called from **Vercel serverless functions** (same pattern as the
  existing `/api/feedback.js`); GitHub stays source-of-truth for code + issues.

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

**Owner decision (2026-07-03):** instant play with no login, *plus* optional
persistent accounts. Account = **username + password OR a one-tap player-code.
No email in Phase 1.**

### 2.1 Design principles
- **Anonymous-first — no login to start.** A player keeps playing with zero
  signup, exactly as today. An account is an *upgrade* ("don't lose your base"),
  never a gate. The Play button never waits on the network or an account.
- **localStorage is always the fallback.** The account layer only ever *adds* a
  cloud mirror; it never removes or gates the local save. Offline, opt-out, and
  backend-down all behave identically to today.
- **Two low-friction ways to hold an account, player's choice (no email):**
  a memorable **username + password**, or a zero-typing **player-code**. Email is
  deliberately *not* collected in Phase 1 (see §2.4).
- **Minimal PII.** A self-chosen username/handle only — no real names, ages,
  schools, locations, contacts (mirrors PLAYER_FEEDBACK.md privacy rules; testers
  are mostly kids). Sanitize like `api/feedback.js` (`slice`, strip `<>@`).
- **Never lock a kid out of their base.** A forgotten password must not be a dead
  end, so every account also gets a one-time recovery code as a backup (§2.2), and
  the original device's local save always still works regardless.

### 2.2 The two account types (both ship in Phase 1)

Both are **optional** and both authenticate to the *same* `accounts`/`saves`
tables — they differ only in how the player proves who they are.

**Type A — Username + password (recommended default for the "serious player"):**
- Player picks a unique username (case-insensitive) and a password. That's the
  whole signup — **no email, no verification step.**
- The password is **hashed server-side (bcrypt/argon2) — never stored or logged
  in plaintext**, never sent anywhere but our `/api/account` function over HTTPS.
- To continue on another device: type username + password. Memorable, kid-owned,
  no code to lose.
- On creation the server *also* issues a one-time **recovery code** (below) as a
  "forgot my password" backup, since there's no email reset path.

**Type B — Player-code (recommended for the youngest / zero-friction path):**
- One tap "Save my game" → server mints an opaque account (`player_id`) + a short
  human-friendly **recovery code** (e.g. `FABLE-7Q2K-9WTX`), shown **once**
  ("write this down to play on another phone").
- No username, no password to manage. To continue elsewhere: enter the code.
- Downside: a lost code = lost *cloud* account (the local save on the original
  device still works — nothing is destroyed).

The **recovery code is the common recovery primitive** for both types: it's the
backup for a forgotten password (Type A) and the sole credential for Type B. Store
it hashed, treat it like a password.

### 2.3 Account data model (conceptual)
```
accounts
  player_id      uuid    (primary key)
  username       citext  (nullable, UNIQUE; Type A — case-insensitive)
  password_hash  text    (nullable; Type A — bcrypt/argon2, NEVER plaintext)
  handle         text    (display nickname, ≤24 chars, sanitized like feedback.js)
  recovery_hash  text    (hashed one-time recovery code; both types)
  created_at     timestamptz
  last_seen_at   timestamptz
```
- One player → one account → one save (Phase 1). Multiple save slots become
  `save_slot` rows later if desired.
- A Type-B account has `username`/`password_hash` null; a Type-A account can add
  them. This lets a player who started with a player-code later "claim" a
  username+password on the same `player_id` (nice-to-have, not required for v1).
- `username` uniqueness is a DB constraint (`citext` + unique index). `handle`
  stays a non-unique display name (may equal the username).

### 2.4 Why no email in Phase 1 (and when it might change)
- **No strong reason to collect it, and real cost to.** Username+password gives
  cross-device login; the recovery code gives account recovery. Email would only
  add *self-service* password reset — unnecessary at this scale (a handful of
  friends).
- **Collecting a minor's email is a COPPA/GDPR-K responsibility** (consent,
  retention, deletion, breach exposure). Not worth it for the current audience.
- **Revisit only if** the game grows beyond friends-and-family *and* password
  resets become a real support burden — then consider optional email or, better,
  a parent's email, as a deliberate owner decision.

---

## 3. Inventory / save schema (cloud version)

### 3.1 Guiding rule: the cloud save IS the local save
Do **not** invent a new shape. The cloud payload is the *same JSON* `save.js`
already produces, wrapped in an envelope. This keeps `save.js` as the single
serializer and makes migration trivial.

**What the cloud save protects (all of it, automatically):** because the payload
is the whole `save.js` blob, an account preserves **inventory, stats
(health/stamina/hunger/thirst), coins, position, day/night state, buildings
(including storage-box contents), and vehicle repair progress** — every field in
the §1 table. And because it's stored as opaque `jsonb` (§3.2), **any future base
progress or new save field is covered with zero backend change** — add it to
`save.js` and it rides along. The cloud never needs to know what's inside.

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
                        │  • App-managed auth: username+password        │
                        │    (hashed) OR player-code — NO email (P1)    │
                        │  • Row-Level Security                        │
                        └─────────────────────────────────────────────┘

   GitHub  ── code source-of-truth, issues, player-feedback pipeline (unchanged)
```

**Why this split:**
- **Vercel functions as the only thing that talks to Supabase.** The browser
  never holds the Supabase service key — it calls our `/api/*` functions, which
  hold the secret (exactly like `feedback.js` holds `GITHUB_TOKEN`). This keeps
  the client dumb and the trust boundary in one place we already understand.
- **Supabase free tier** comfortably covers a handful of kids: Postgres, RLS,
  generous row/egress limits. No bill for Phase 1. (Phase 1 uses **app-managed
  accounts** — username+password hashed in our function, or player-code — not
  Supabase's email Auth, since we're not collecting email. Supabase Auth remains
  available later if email is ever wanted.)
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
1. Supabase project + `accounts` and `saves` tables with RLS (§2.3, §3.2),
   including `username` (unique, `citext`), `password_hash`, `recovery_hash`.
2. Vercel functions (all mirror the `feedback.js` secret pattern — no key in the
   browser):
   - `POST /api/account` — create account. Body picks the type: Type A
     `{ username, password, handle }` (server hashes the password, mints a backup
     recovery code) or Type B `{ handle }` (server mints `player_id` + recovery
     code). Returns `player_id` + the one-time recovery code.
   - `POST /api/account/login` — Type A: `{ username, password }` → verify hash.
   - `POST /api/account/link` — redeem a recovery code on a new device.
   - `GET/PUT /api/save` — read/write the envelope; server authorizes the caller's
     `player_id` (short-lived token/session from login, not a raw id from the
     client).
   - Rate-limit auth endpoints (throttle password/code guessing).
3. `src/cloudSave.js`: opt-in flow, debounced push on top of the existing 25 s
   autosave, pull-and-reconcile on load (§3.3 conflict UX). Fails silent to local.
4. UI (`src/ui.js`): a quiet, always-available "☁️ Save progress / Log in" entry
   (start screen + pause/settings) offering **username+password or one-tap code**;
   "Play on another device" → log in or enter code. Plus the **progress-at-risk
   prompt** (§8.6). Keep it off the core HUD; kids ignore what they don't need.
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

### 8.5 The tradeoff: instant play vs. losing progress (say it plainly)
Two ways to play, and the player chooses without ever being blocked:

| | Anonymous / local (default) | Account (opt-in) |
|---|---|---|
| **To start** | Nothing — tap Play, ~10 s | Same instant start; sign up later |
| **Progress lives** | Only in *this* browser's localStorage | Mirrored to the cloud |
| **Survives storage clear?** | ❌ gone | ✅ restored on next login |
| **Survives new device / browser?** | ❌ starts fresh | ✅ log in / enter code |
| **Cost to the player** | None | One-time signup + remember login |

**How local progress is actually lost** (why this matters for *this* audience):
- Clearing browsing data / "clear site data" (a curious kid, a shared phone).
- Private/Incognito tabs (nothing persists after close).
- Switching phones or browsers, or reinstalling.
- **iOS Safari ITP evicts unused site data after ~7 days** — a kid who doesn't
  open the game for a week can lose everything, even without touching settings.
  This is the single strongest reason accounts matter here (many testers are on
  iPhones).
- Storage-quota eviction under pressure.

The honest framing shown to players: *"No account needed to play. But your world
only lives on this phone until you save it — make a free account to keep it."*

### 8.6 When to prompt to save (protect progress *before* it's at risk)
**Never gate the game and never nag.** Default to a small, dismissible prompt that
appears the moment a player's progress first becomes worth protecting — the *first*
of these to happen in a session (checked cheaply against existing state):

- Survived to **Day 2** (`dayNight.day >= 2` — they made it through a night), OR
- Placed their **first base piece** (`buildings.placed.length >= 1`), OR
- Obtained something **valuable**: a tool (axe/pickaxe), a vehicle part
  (fuel/battery/wheel), or coins over a threshold (e.g. > 40), OR
- Started **vehicle repair** (any part installed), OR
- **~10 minutes** of active play.

Behavior:
- Show **once per session**, non-blocking, with **"Save my game"** and **"Not
  now."** "Not now" is remembered for the session so it never repeats that play.
- If dismissed, re-surface at the *next* clear milestone (e.g. first base built,
  or Day 3), **capped** so it never becomes annoying — kids bounce off nagging.
- Copy names the stake: *"You've survived to Day 2 and built a base — save it so
  you don't lose it if this browser clears."*
- A quiet, always-present **"☁️ Save progress"** affordance in the menu lets a
  player opt in anytime without waiting for a prompt.
- If the game ever gains a destructive local action (reset/new game), it must warn
  and offer to save first.

Implementation note: all trigger inputs already exist in the live game state
(`dayNight.day`, `buildings.placed`, `inventory`, `vehicles`, a play-time
counter) — the prompt is pure UI reading existing values, no gameplay change.

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
- **2026-07-03 (later) — Claude (Claude Code):** Refined the Phase 1
  account/cloud-save plan per owner decision — *instant play, no login*, plus
  **optional accounts via username+password OR one-tap player-code, no email in
  Phase 1**. Rewrote §2 (account model, two types + recovery code + why-no-email
  §2.4), made §3.1 spell out exactly what the cloud protects (all save fields +
  future base progress via `jsonb`), and added §8.5 (the instant-play-vs-lost-
  progress tradeoff, incl. iOS Safari 7-day eviction) and §8.6 (when to prompt to
  save — milestone-triggered, once per session, never a gate). Updated the §6
  architecture to app-managed auth (not Supabase email Auth). Still design-only —
  no gameplay code changed. Issues #5/#6/#8/#12 updated to match.
