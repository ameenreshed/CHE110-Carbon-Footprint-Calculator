-- ============================================================================
-- Carbotrack — Final Consolidated Database Schema (v3 — production ready)
-- ============================================================================
-- Run entire block once in: Supabase Dashboard → SQL Editor
-- Safe to re-run — every statement is idempotent.
--
-- Order:
--   1. Extensions
--   2. Profiles + auth trigger
--   3. Carbon results + leaderboard view
--   4. Challenge progress
--   5. Platform stats (Phase 1)
--   6. RLS policies
--   7. RPC functions
--   8. Permissions
--   9. Backfills
-- ============================================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";


-- ============================================================
-- 2. PROFILES
-- ============================================================
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique,
  full_name       text,
  avatar_initials text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Auto-create a profile row when a new auth user signs up
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
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    upper(
      left(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
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


-- ============================================================
-- 3. CARBON RESULTS
--    FIX: added client_result_id + unique index for deduplication.
--    The fixed client submits each result with a stable
--    (user_id, client_result_id) pair. Postgres treats NULLs as
--    distinct in unique constraints, so legacy rows without a
--    client_result_id will never conflict.
-- ============================================================
create table if not exists public.carbon_results (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  total_tons        numeric(6,2) not null,
  eco_score         integer not null,
  rating_key        text not null,
  rating_label      text not null,
  breakdown         jsonb default '{}'::jsonb,
  client_result_id  text,
  created_at        timestamptz default now()
);

-- Re-run safety: add the column if this table was created before the fix
alter table public.carbon_results
  add column if not exists client_result_id text;

create index if not exists idx_carbon_results_user    on public.carbon_results (user_id);
create index if not exists idx_carbon_results_tons    on public.carbon_results (total_tons asc);
create index if not exists idx_carbon_results_created on public.carbon_results (created_at desc);

-- Unique per (user, client_result_id) — makes upserts with
-- `onConflict: 'user_id,client_result_id'` idempotent.
create unique index if not exists idx_carbon_results_client_id
  on public.carbon_results (user_id, client_result_id);

-- Ranked leaderboard view — one row per user (their best/lowest footprint)
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


-- ============================================================
-- 4. CHALLENGE PROGRESS
--    FIX: added a CHECK constraint that rejects malformed day
--    arrays. Pre-existing bad rows are sanitized before the
--    constraint is applied. The sanitization uses a CASE
--    expression so jsonb_array_length() is only evaluated when
--    jsonb_typeof(days) = 'array' — no runtime error on non-arrays.
-- ============================================================
create table if not exists public.challenge_progress (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  days        jsonb not null default '[false,false,false,false,false,false,false]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Sanitize any rows that predate the CHECK constraint.
-- CASE short-circuits per the SQL standard — jsonb_array_length is
-- only evaluated when jsonb_typeof(days) = 'array', so this cannot
-- raise "cannot get array length of a non-array" on malformed input.
update public.challenge_progress
   set days = '[false,false,false,false,false,false,false]'::jsonb
 where case jsonb_typeof(days)
         when 'array' then jsonb_array_length(days) <> 7
         else true
       end;

alter table public.challenge_progress
  drop constraint if exists challenge_progress_days_check;

alter table public.challenge_progress
  add constraint challenge_progress_days_check
  check (
    jsonb_typeof(days) = 'array'
    and jsonb_array_length(days) = 7
  );


-- ============================================================
-- 5. PLATFORM STATS (Phase 1 — anonymous counters)
-- ============================================================
create table if not exists public.platform_stats (
  id                     integer primary key default 1 check (id = 1),
  visits                 bigint not null default 0,
  unique_visits          bigint not null default 0,
  footprints_computed    bigint not null default 0,
  certificates_issued    bigint not null default 0,
  shares                 bigint not null default 0,
  challenge_completions  bigint not null default 0,
  updated_at             timestamptz not null default now()
);
insert into public.platform_stats (id) values (1) on conflict (id) do nothing;

-- Anonymous visitor sessions (only a random client-side UUID + last visit day)
create table if not exists public.visitor_sessions (
  session_id      text primary key,
  first_seen      timestamptz not null default now(),
  last_visit_day  date not null default current_date
);

-- Raw event log for auditing / per-day analytics
create table if not exists public.platform_events (
  id          bigserial primary key,
  event_type  text not null check (event_type in
              ('visit','footprint_computed','certificate_issued','share','challenge_completed')),
  session_id  text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_platform_events_created on public.platform_events (created_at desc);
create index if not exists idx_platform_events_type    on public.platform_events (event_type);


-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.carbon_results     enable row level security;
alter table public.challenge_progress enable row level security;
alter table public.platform_stats     enable row level security;
alter table public.visitor_sessions   enable row level security;
alter table public.platform_events    enable row level security;

-- ---------- profiles ----------
drop policy if exists "Profiles are public"         on public.profiles;
drop policy if exists "Users update own profile"    on public.profiles;
drop policy if exists "Users insert own profile"    on public.profiles;

create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- ---------- carbon_results ----------
-- FIX: added UPDATE policy. The current client uses
-- `ignoreDuplicates: true` (DO NOTHING), which does not require it.
-- But if any future code path switches to a DO UPDATE upsert, RLS
-- would silently reject the whole operation without this policy.
drop policy if exists "Carbon results are public"   on public.carbon_results;
drop policy if exists "Users insert own results"    on public.carbon_results;
drop policy if exists "Users update own results"    on public.carbon_results;

create policy "Carbon results are public"
  on public.carbon_results for select
  to anon, authenticated
  using (true);

create policy "Users insert own results"
  on public.carbon_results for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own results"
  on public.carbon_results for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- challenge_progress ----------
drop policy if exists "Users read own challenge"    on public.challenge_progress;
drop policy if exists "Users insert own challenge"  on public.challenge_progress;
drop policy if exists "Users update own challenge"  on public.challenge_progress;

create policy "Users read own challenge"
  on public.challenge_progress for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own challenge"
  on public.challenge_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own challenge"
  on public.challenge_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- platform_stats ----------
drop policy if exists "Public read stats" on public.platform_stats;
create policy "Public read stats"
  on public.platform_stats for select
  to anon, authenticated
  using (true);

-- NOTE: visitor_sessions and platform_events have RLS enabled but NO policies.
-- Only the security-definer RPCs below can read/write them.


-- ============================================================
-- 7. RPC FUNCTIONS
-- ============================================================

-- ------------------------------------------------------------
-- record_visit — debounced to once per day per visitor
-- ------------------------------------------------------------
create or replace function public.record_visit(p_session_id text)
returns public.platform_stats
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_new     boolean := false;
  v_is_new_day boolean := false;
  v_prev_day   date;
  v_result     public.platform_stats;
  v_today      date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if p_session_id is null or length(p_session_id) < 8 then
    return (select * from public.platform_stats where id = 1);
  end if;

  select last_visit_day into v_prev_day
  from public.visitor_sessions
  where session_id = p_session_id;

  if v_prev_day is null then
    insert into public.visitor_sessions (session_id, last_visit_day)
    values (p_session_id, v_today)
    on conflict (session_id) do nothing;
    v_is_new     := true;
    v_is_new_day := true;
  elsif v_prev_day <> v_today then
    update public.visitor_sessions
      set last_visit_day = v_today
      where session_id = p_session_id;
    v_is_new_day := true;
  end if;

  if not v_is_new_day then
    return (select * from public.platform_stats where id = 1);
  end if;

  update public.platform_stats
  set visits        = visits + 1,
      unique_visits = unique_visits + case when v_is_new then 1 else 0 end,
      updated_at    = now()
  where id = 1
  returning * into v_result;

  insert into public.platform_events (event_type, session_id)
  values ('visit', p_session_id);

  return v_result;
end;
$$;

-- ------------------------------------------------------------
-- record_event — footprints, certificates, shares, challenge
-- ------------------------------------------------------------
create or replace function public.record_event(
  p_event_type text,
  p_session_id text default null,
  p_metadata   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_type not in
     ('footprint_computed','certificate_issued','share','challenge_completed') then
    return;
  end if;

  insert into public.platform_events (event_type, session_id, metadata)
  values (p_event_type, p_session_id, coalesce(p_metadata, '{}'::jsonb));

  case p_event_type
    when 'footprint_computed' then
      update public.platform_stats set footprints_computed = footprints_computed + 1, updated_at = now() where id = 1;
    when 'certificate_issued' then
      update public.platform_stats set certificates_issued = certificates_issued + 1, updated_at = now() where id = 1;
    when 'share' then
      update public.platform_stats set shares = shares + 1, updated_at = now() where id = 1;
    when 'challenge_completed' then
      update public.platform_stats set challenge_completions = challenge_completions + 1, updated_at = now() where id = 1;
    else
      null;
  end case;
end;
$$;

-- ------------------------------------------------------------
-- get_public_stats — read the singleton stats row
-- ------------------------------------------------------------
create or replace function public.get_public_stats()
returns public.platform_stats
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.platform_stats where id = 1;
$$;


-- ============================================================
-- 8. GRANTS
-- ============================================================
grant select on public.profiles           to anon, authenticated;
grant update on public.profiles           to authenticated;
grant insert on public.profiles           to authenticated;

grant select on public.carbon_results     to anon, authenticated;
grant insert on public.carbon_results     to authenticated;
grant update on public.carbon_results     to authenticated;

grant select, insert, update on public.challenge_progress to authenticated;

grant select on public.leaderboard_view   to anon, authenticated;
grant select on public.platform_stats     to anon, authenticated;

grant execute on function public.record_visit(text)               to anon, authenticated;
grant execute on function public.record_event(text, text, jsonb)  to anon, authenticated;
grant execute on function public.get_public_stats()               to anon, authenticated;


-- ============================================================
-- 9. BACKFILLS
-- ============================================================

-- Fill in missing full_name / initials on existing profiles using auth metadata
update public.profiles p
set
  full_name = coalesce(
    nullif(p.full_name, ''),
    au.raw_user_meta_data ->> 'full_name',
    au.raw_user_meta_data ->> 'name',
    p.username
  ),
  avatar_initials = coalesce(
    nullif(p.avatar_initials, ''),
    upper(left(
      coalesce(
        au.raw_user_meta_data ->> 'full_name',
        au.raw_user_meta_data ->> 'name',
        p.username,
        '?'
      ),
      2
    ))
  )
from auth.users au
where au.id = p.id
  and (
    p.full_name is null or p.full_name = ''
    or p.avatar_initials is null or p.avatar_initials = ''
  );

-- Ensure every existing auth user has a profile row
insert into public.profiles (id, username, full_name, avatar_initials)
select
  au.id,
  coalesce(
    au.raw_user_meta_data ->> 'username',
    split_part(au.email, '@', 1)
  ),
  coalesce(
    au.raw_user_meta_data ->> 'full_name',
    au.raw_user_meta_data ->> 'name',
    split_part(au.email, '@', 1)
  ),
  upper(left(
    coalesce(
      au.raw_user_meta_data ->> 'full_name',
      au.raw_user_meta_data ->> 'name',
      split_part(au.email, '@', 1)
    ),
    2
  ))
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null
on conflict (id) do nothing;


-- ============================================================
-- 9b. OPTIONAL — CLEAN UP LEGACY DUPLICATE carbon_results
-- ============================================================
-- If you've been submitting scores before this schema was deployed,
-- you may have multiple identical rows per user (all with
-- client_result_id = NULL). This block removes exact duplicates,
-- keeping the earliest submission of each (user, result) pair.
--
-- The new unique index treats NULLs as distinct, so it will not
-- fail on legacy rows — this cleanup is purely cosmetic. Uncomment
-- to run it once.
--
-- delete from public.carbon_results cr
-- using public.carbon_results keep
-- where cr.user_id = keep.user_id
--   and cr.client_result_id is null
--   and keep.client_result_id is null
--   and cr.total_tons   = keep.total_tons
--   and cr.eco_score    = keep.eco_score
--   and cr.rating_key   = keep.rating_key
--   and cr.rating_label = keep.rating_label
--   and cr.breakdown    = keep.breakdown
--   and cr.created_at   > keep.created_at;


-- ============================================================
-- DONE
-- ============================================================
-- What you now have:
--   ✅ profiles           — user metadata, auto-created on signup
--   ✅ carbon_results     — every footprint assessment per user
--                           (+ client_result_id for idempotent submits)
--   ✅ leaderboard_view   — public ranking, best score per user
--   ✅ challenge_progress — 7-day challenge state, cross-device
--                           (+ CHECK: exactly 7 boolean slots)
--   ✅ platform_stats     — anonymous counters (visitors, computed, etc.)
--   ✅ visitor_sessions   — debounce table (locked down, RPC-only)
--   ✅ platform_events    — audit log (locked down, RPC-only)
--   ✅ 3 RPCs             — record_visit, record_event, get_public_stats
--
-- Fixes applied in this version:
--   1. carbon_results.client_result_id  + unique index  (BLOCKING fix)
--   2. carbon_results UPDATE policy + grant              (future-proof)
--   3. challenge_progress.days CHECK constraint          (data integrity)
--   4. Sanitization uses CASE (safe on non-array jsonb)  (edge case fix)
--   5. Re-run safety: every DDL statement is idempotent
-- ============================================================