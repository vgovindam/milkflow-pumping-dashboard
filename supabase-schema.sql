-- MilkFlow cloud schema. Designed for Supabase Auth + RLS.
-- Apply this through a migration once the target Supabase project is selected.

create table if not exists public.milkflow_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_goal_ml integer not null default 760 check (daily_goal_ml > 0),
  baby_min_oz numeric(5,2) not null default 20,
  baby_max_oz numeric(5,2) not null default 22,
  stash_ml integer not null default 0 check (stash_ml >= 0),
  schedule jsonb not null default '["05:40","11:05","14:35","17:45","20:45","23:35"]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.milkflow_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('pump','nursing')),
  occurred_at timestamptz not null,
  local_date date not null,
  local_time time not null,
  amount_ml integer check (amount_ml is null or amount_ml >= 0),
  duration_min integer check (duration_min is null or duration_min >= 0),
  side text check (side is null or side in ('left','right','both')),
  quality text check (quality is null or quality in ('normal','short','power')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists milkflow_entries_user_date_idx on public.milkflow_entries(user_id, local_date desc, local_time desc);

alter table public.milkflow_profile enable row level security;
alter table public.milkflow_entries enable row level security;

revoke all on public.milkflow_profile from anon;
revoke all on public.milkflow_entries from anon;
grant select, insert, update, delete on public.milkflow_profile to authenticated;
grant select, insert, update, delete on public.milkflow_entries to authenticated;

create policy "milkflow_profile_select_own" on public.milkflow_profile for select to authenticated using ((select auth.uid()) = user_id);
create policy "milkflow_profile_insert_own" on public.milkflow_profile for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "milkflow_profile_update_own" on public.milkflow_profile for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "milkflow_profile_delete_own" on public.milkflow_profile for delete to authenticated using ((select auth.uid()) = user_id);

create policy "milkflow_entries_select_own" on public.milkflow_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "milkflow_entries_insert_own" on public.milkflow_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "milkflow_entries_update_own" on public.milkflow_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "milkflow_entries_delete_own" on public.milkflow_entries for delete to authenticated using ((select auth.uid()) = user_id);
