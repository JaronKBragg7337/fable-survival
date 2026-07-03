# SUPABASE.md — Cloud Save Backend Notes

Supabase project for Fable Survival:

- Project name: `fable-survival`
- Project ref: `ukguppzfpvdcemyxzdbn`
- Project URL: `https://ukguppzfpvdcemyxzdbn.supabase.co`
- Region: `us-west-2`
- Current use: cloud-save foundation only. The live game does not call Supabase
  yet.

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

Tables:

- `public.player_accounts` — app-managed username/password account records.
  Password and recovery codes must be hashed by server code before insertion.
- `public.player_saves` — one JSON save blob per account, keyed by
  `player_id`.

Security stance:

- RLS enabled on both tables.
- No anon/authenticated table grants.
- `service_role` is granted table access for Vercel serverless functions.
- The dashboard-created `public.rls_auto_enable()` function has execute revoked
  from `public`, `anon`, and `authenticated` to satisfy Supabase advisors.

Supabase security advisors currently report only INFO-level "RLS enabled no
policy" notices for these two tables. That is expected while they are
server-only; add row policies only if browser/client access becomes intentional.
