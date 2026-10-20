-- ============================================================
-- Carbotrack — Supabase Schema
-- Run entire block once in: Supabase Dashboard → SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique,
  full_name       text,
  avatar_initials text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ------------------------------------------------------------
-- CARBON RESULTS
-- ------------------------------------------------------------
create table public.carbon_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  total_tons   numeric(6,2) not null,
  eco_score    integer not null,
  rating_key   text not null,
  rating_label text not null,
  breakdown    jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);

create index idx_carbon_results_user on public.carbon_results(user_id);
create index idx_carbon_results_tons on public.carbon_results(total_tons asc);
create index idx_carbon_results_created on public.carbon_results(created_at desc);

alter table public.carbon_results enable row level security;

create policy "Carbon results are public"
  on public.carbon_results for select
  to anon, authenticated
  using (true);

create policy "Users insert own results"
  on public.carbon_results for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- AUTO-CREATE PROFILE ON SIGNUP
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_initials)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    upper(
      left(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          split_part(new.email, '@', 1)
        ),
        2
      )
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ------------------------------------------------------------
-- RANKED LEADERBOARD VIEW
-- ------------------------------------------------------------
create or replace view public.leaderboard_view as
select
  p.id            as user_id,
  p.username,
  p.full_name,
  p.avatar_initials,
  cr.total_tons,
  cr.eco_score,
  cr.rating_key,
  cr.rating_label,
  cr.created_at,
  rank() over (order by cr.total_tons asc, cr.created_at asc) as rank
from public.carbon_results cr
join public.profiles p on p.id = cr.user_id
where cr.id in (
  select id
  from (
    select id,
           row_number() over (
             partition by user_id
             order by total_tons asc, created_at asc
           ) as rn
    from public.carbon_results
  ) sub
  where rn = 1
);

-- ------------------------------------------------------------
-- PERMISSIONS
-- ------------------------------------------------------------
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

grant select on public.carbon_results to anon, authenticated;
grant insert on public.carbon_results to authenticated;

grant select on public.leaderboard_view to anon, authenticated;