-- Cloud-save foundation for Fable Survival.
-- App-managed auth lives in Vercel functions; browser clients should not read
-- or write these tables directly. Keep RLS enabled with no anon/auth policies.

create extension if not exists pgcrypto;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create table if not exists public.player_accounts (
  player_id uuid primary key default gen_random_uuid(),
  username text not null,
  username_normalized text generated always as (lower(username)) stored,
  password_hash text not null,
  password_salt text not null,
  password_iterations integer not null default 210000,
  recovery_code_hash text not null,
  recovery_code_salt text not null,
  recovery_code_used_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  password_updated_at timestamptz not null default now(),
  constraint player_accounts_username_len check (char_length(username) between 3 and 24),
  constraint player_accounts_username_safe check (username ~ '^[A-Za-z0-9_-]+$'),
  constraint player_accounts_password_iterations_positive check (password_iterations >= 100000),
  constraint player_accounts_username_unique unique (username_normalized)
);

create table if not exists public.player_saves (
  player_id uuid primary key references public.player_accounts(player_id) on delete cascade,
  save_blob jsonb not null,
  save_version integer not null default 1,
  client_version text,
  device_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_saves_blob_object check (jsonb_typeof(save_blob) = 'object'),
  constraint player_saves_device_label_len check (device_label is null or char_length(device_label) <= 48)
);

create or replace function public.touch_player_saves_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_player_saves_updated_at on public.player_saves;
create trigger trg_player_saves_updated_at
before update on public.player_saves
for each row
execute function public.touch_player_saves_updated_at();

alter table public.player_accounts enable row level security;
alter table public.player_saves enable row level security;

revoke all on table public.player_accounts from anon, authenticated;
revoke all on table public.player_saves from anon, authenticated;
revoke execute on function public.touch_player_saves_updated_at() from public, anon, authenticated;

grant select, insert, update, delete on table public.player_accounts to service_role;
grant select, insert, update, delete on table public.player_saves to service_role;
