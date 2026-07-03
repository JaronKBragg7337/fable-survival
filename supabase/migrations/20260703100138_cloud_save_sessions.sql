alter table public.player_accounts
  add column if not exists account_kind text not null default 'password',
  add column if not exists handle text;

alter table public.player_accounts
  drop constraint if exists player_accounts_kind_valid;

alter table public.player_accounts
  add constraint player_accounts_kind_valid check (account_kind in ('password', 'player_code'));

alter table public.player_accounts
  drop constraint if exists player_accounts_handle_len;

alter table public.player_accounts
  add constraint player_accounts_handle_len check (handle is null or char_length(handle) <= 24);

create table if not exists public.player_sessions (
  session_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_accounts(player_id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  constraint player_sessions_future_expiry check (expires_at > created_at)
);

create index if not exists idx_player_sessions_player_expires
  on public.player_sessions(player_id, expires_at desc);

alter table public.player_sessions enable row level security;
revoke all on table public.player_sessions from anon, authenticated;
grant select, insert, update, delete on table public.player_sessions to service_role;
