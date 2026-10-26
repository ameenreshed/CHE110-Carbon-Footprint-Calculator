-- Carbotrack/Eco leaderboard RPC patch
-- Run this in Supabase SQL Editor after schema.sql.
-- Exposes only leaderboard fields through the public leaderboard RPC.
-- The final section restricts direct reads of profile/result rows to their owner.

create or replace function public.get_leaderboard(
  p_period text default 'all',
  p_limit integer default 20,
  p_mode text default 'best'
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  avatar_initials text,
  total_tons numeric,
  eco_score integer,
  rating_key text,
  rating_label text,
  created_at timestamptz,
  rank bigint,
  latest_tons numeric,
  latest_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with filtered as (
    select cr.user_id, cr.total_tons, cr.eco_score, cr.rating_key,
           cr.rating_label, cr.created_at
    from public.carbon_results cr
    where
      coalesce(p_period, 'all') = 'all'
      or (p_period = 'week' and cr.created_at >= now() - interval '7 days')
      or (p_period = 'month' and cr.created_at >= now() - interval '30 days')
  ),
  best_rows as (
    select distinct on (f.user_id)
      f.user_id, f.total_tons, f.eco_score, f.rating_key,
      f.rating_label, f.created_at
    from filtered f
    order by f.user_id, f.total_tons asc, f.created_at asc
  ),
  latest_rows as (
    select distinct on (f.user_id)
      f.user_id, f.total_tons, f.eco_score, f.rating_key,
      f.rating_label, f.created_at
    from filtered f
    order by f.user_id, f.created_at desc
  ),
  chosen as (
    select * from best_rows where coalesce(p_mode, 'best') <> 'latest'
    union all
    select * from latest_rows where p_mode = 'latest'
  ),
  latest_all as (
    select distinct on (cr.user_id)
      cr.user_id, cr.total_tons, cr.created_at
    from public.carbon_results cr
    order by cr.user_id, cr.created_at desc
  ),
  ranked as (
    select c.*,
      rank() over (order by c.total_tons asc, c.created_at asc) as rank_value
    from chosen c
  )
  select
    p.id, p.username, p.full_name, p.avatar_initials,
    r.total_tons, r.eco_score, r.rating_key, r.rating_label,
    r.created_at, r.rank_value, la.total_tons, la.created_at
  from ranked r
  join public.profiles p on p.id = r.user_id
  left join latest_all la on la.user_id = r.user_id
  order by r.total_tons asc, r.created_at asc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create or replace function public.get_my_rank()
returns table (
  rank bigint,
  total_tons numeric,
  eco_score integer,
  rating_key text,
  rating_label text,
  created_at timestamptz,
  total_ranked bigint,
  latest_tons numeric,
  latest_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with best_rows as (
    select distinct on (cr.user_id)
      cr.user_id, cr.total_tons, cr.eco_score, cr.rating_key,
      cr.rating_label, cr.created_at
    from public.carbon_results cr
    order by cr.user_id, cr.total_tons asc, cr.created_at asc
  ),
  latest_rows as (
    select distinct on (cr.user_id)
      cr.user_id, cr.total_tons, cr.created_at
    from public.carbon_results cr
    order by cr.user_id, cr.created_at desc
  ),
  ranked as (
    select b.*,
      rank() over (order by b.total_tons asc, b.created_at asc) as rank_value,
      count(*) over () as total_ranked
    from best_rows b
  )
  select r.rank_value, r.total_tons, r.eco_score, r.rating_key,
         r.rating_label, r.created_at, r.total_ranked,
         l.total_tons, l.created_at
  from ranked r
  join latest_rows l on l.user_id = r.user_id
  where r.user_id = auth.uid();
$$;

create or replace function public.submit_carbon_result(
  p_total_tons numeric,
  p_eco_score integer,
  p_rating_key text,
  p_rating_label text,
  p_breakdown jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Authentication required');
  end if;

  if p_total_tons is null
     or p_total_tons::text in ('NaN', 'Infinity', '-Infinity')
     or p_total_tons < 0
     or p_total_tons > 1000 then
    return jsonb_build_object('ok', false, 'error', 'Invalid footprint value');
  end if;

  if p_eco_score is null or p_eco_score < 0 or p_eco_score > 100 then
    return jsonb_build_object('ok', false, 'error', 'Invalid eco score');
  end if;

  if p_rating_key is null or p_rating_key not in ('low', 'moderate', 'high', 'very-high') then
    return jsonb_build_object('ok', false, 'error', 'Invalid rating key');
  end if;

  if p_rating_label is null or length(p_rating_label) > 100 then
    return jsonb_build_object('ok', false, 'error', 'Invalid rating label');
  end if;

  insert into public.carbon_results (
    user_id, total_tons, eco_score, rating_key, rating_label, breakdown, client_result_id
  )
  values (
    v_user_id, p_total_tons, p_eco_score, p_rating_key, p_rating_label,
    case when jsonb_typeof(coalesce(p_breakdown, '{}'::jsonb)) = 'object'
      then coalesce(p_breakdown, '{}'::jsonb) else '{}'::jsonb end,
    gen_random_uuid()::text
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'deduplicated', false);
end;
$$;

revoke all on function public.get_leaderboard(text, integer, text) from public;
revoke all on function public.get_my_rank() from public;
revoke all on function public.submit_carbon_result(numeric, integer, text, text, jsonb) from public;
grant execute on function public.get_leaderboard(text, integer, text) to anon, authenticated;
grant execute on function public.get_my_rank() to authenticated;
grant execute on function public.submit_carbon_result(numeric, integer, text, text, jsonb) to authenticated;


-- Privacy hardening: keep full profile/result rows private to their owner.
-- Public leaderboard data remains available through the limited leaderboard RPC/view.
drop policy if exists "Profiles are public" on public.profiles;
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Carbon results are public" on public.carbon_results;
drop policy if exists "Users read own results" on public.carbon_results;
create policy "Users read own results"
  on public.carbon_results for select
  to authenticated
  using (auth.uid() = user_id);

revoke select on public.profiles from anon;
grant select on public.profiles to authenticated;
revoke select on public.carbon_results from anon;
grant select on public.carbon_results to authenticated;
