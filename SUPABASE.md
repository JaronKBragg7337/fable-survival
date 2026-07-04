# SUPABASE.md — Cloud Save Backend Notes

Supabase project for Fable Survival:

- Project name: `fable-survival`
- Project ref: `ukguppzfpvdcemyxzdbn`
- Project URL: `https://ukguppzfpvdcemyxzdbn.supabase.co`
- Region: `us-west-2`
- Current use: cloud-save foundation only. The live game does not call this
  project for cloud save yet.

Multiplayer note: live player visibility does **not** use this Fable Supabase
project. When hosted under Heartbeat Observatory, `src/multiplayer.js` connects
to Heartbeat's existing Supabase Realtime project so the Observatory account/
guest presence system is reused instead of creating a second multiplayer stack.

## Key Rules

- `sb_publishable_...` keys are browser-safe once RLS/grants are correct.
- `sb_secret_...` keys are server-only. Never commit one, paste one into chat,
  or put one in `VITE_` / frontend code.
- Server APIs should read `SUPABASE_SECRET_KEY` from Vercel environment
  variables and perform all account/save writes there.

## Environment Variables

Frontend-safe:

```bash
VITE_SUPABASE_URL=https://ukguppzfpvdcemyxzdbn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Server-only:

```bash
SUPABASE_URL=https://ukguppzfpvdcemyxzdbn.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Only the owner should copy the real `SUPABASE_SECRET_KEY` from the Supabase
dashboard into Vercel. The repo keeps placeholders only.

## Schema

Migration: `supabase/migrations/20260703094251_cloud_save_foundation.sql`
Follow-ups:

- `supabase/migrations/20260703100138_cloud_save_sessions.sql`
- `supabase/migrations/20260703100450_drop_redundant_session_token_index.sql`

Tables:

- `public.player_accounts` — app-managed username/password account records.
  Password and recovery codes must be hashed by server code before insertion.
- `public.player_saves` — one JSON save blob per account, keyed by
  `player_id`.
- `public.player_sessions` — short-lived server-issued bearer session tokens,
  stored only as SHA-256 token hashes.

Security stance:

- RLS enabled on both tables.
- No anon/authenticated table grants.
- `service_role` is granted table access for Vercel serverless functions.
- The dashboard-created `public.rls_auto_enable()` function has execute revoked
  from `public`, `anon`, and `authenticated` to satisfy Supabase advisors.

Supabase security advisors currently report only INFO-level "RLS enabled no
policy" notices for these two tables. That is expected while they are
server-only; add row policies only if browser/client access becomes intentional.

## Server API

Implemented in Vercel functions under `api/`:

- `POST /api/account`
  - `{ username, password, handle }` creates a username/password account.
  - `{ handle }` creates a one-tap player-code account.
  - Returns account metadata, a one-time recovery code, and a short-lived
    session token.
- `POST /api/account/login`
  - `{ username, password }` verifies the password and returns a session token.
- `POST /api/account/link`
  - `{ recovery_code }` redeems the recovery code on a new device and returns a
    session token.
- `GET /api/save`
  - Requires `Authorization: Bearer <session token>`.
  - Returns the current save envelope or `null`.
- `PUT /api/save`
  - Requires `Authorization: Bearer <session token>`.
  - Stores a save envelope up to 16 KB.

Implementation notes:

- Passwords and recovery codes are hashed with `bcryptjs`; plaintext is never
  stored.
- Session tokens are returned once and stored in the database as SHA-256 hashes.
- Auth endpoints include a lightweight in-memory rate limit. This is useful
  friction but not a substitute for an edge-wide rate limiter if attacks become
  real.
