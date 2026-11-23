drop policy if exists "Public can view business daily stats" on public.business_daily_stats;
drop policy if exists "Owners manage business daily stats" on public.business_daily_stats;
drop policy if exists "Owners read business daily stats" on public.business_daily_stats;

revoke all on table public.business_daily_stats from public, anon, authenticated;
grant select on table public.business_daily_stats to authenticated;

create policy "Owners read business daily stats" on public.business_daily_stats
for select to authenticated using (
  exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  )
);

create or replace function public.get_business_review_summary(p_business_id uuid)
returns table (review_count bigint, average_rating numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(r.id)::bigint, avg(r.stars)::numeric
  from public.businesses b
  left join public.reviews r
    on r.business_id = b.id and r.hidden = false
  where b.id = p_business_id and b.owner_id = auth.uid()
  group by b.id;
$$;

revoke all on function public.get_business_review_summary(uuid) from public, anon;
grant execute on function public.get_business_review_summary(uuid) to authenticated;

create table if not exists public.business_quick_updates (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  status text not null default 'regular' check (status in ('regular', 'open', 'closed')),
  sold_out boolean not null default false,
  long_queue boolean not null default false,
  special text not null default '' check (char_length(special) <= 160),
  expires_at timestamptz not null
);

create or replace function public.set_business_quick_update_expiry()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.expires_at := (
    date_trunc('day', timezone('Asia/Manila', clock_timestamp())) + interval '1 day'
  ) at time zone 'Asia/Manila';
  return new;
end;
$$;

drop trigger if exists business_quick_updates_set_expiry on public.business_quick_updates;
create trigger business_quick_updates_set_expiry
before insert or update on public.business_quick_updates
for each row execute function public.set_business_quick_update_expiry();

alter table public.business_quick_updates enable row level security;
revoke all on table public.business_quick_updates from public, anon, authenticated;
grant select on table public.business_quick_updates to anon, authenticated;
grant insert, update, delete on table public.business_quick_updates to authenticated;

drop policy if exists "Public can view active business quick updates" on public.business_quick_updates;
create policy "Public can view active business quick updates" on public.business_quick_updates
for select to anon, authenticated using (
  expires_at > now()
  and exists (
    select 1 from public.businesses b
    where b.id = business_id and b.live = true and b.verification_status = 'verified'
  )
);

drop policy if exists "Owners read their business quick updates" on public.business_quick_updates;
create policy "Owners read their business quick updates" on public.business_quick_updates
for select to authenticated using (
  exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "Verified owners manage live business quick updates" on public.business_quick_updates;
create policy "Verified owners manage live business quick updates" on public.business_quick_updates
for all to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = business_id
      and b.owner_id = auth.uid()
      and b.live = true
      and b.verification_status = 'verified'
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = business_id
      and b.owner_id = auth.uid()
      and b.live = true
      and b.verification_status = 'verified'
  )
);

notify pgrst, 'reload schema';
