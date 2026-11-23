
create extension if not exists pgcrypto;

do $$ begin
  create type public.account_role as enum ('traveler', 'business');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.business_verification_status as enum ('none', 'pending', 'verified', 'needs-docs');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.post_status as enum ('draft', 'scheduled', 'published');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.review_case_status as enum ('received', 'review', 'info', 'removed', 'kept', 'appealed');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.account_role not null default 'traveler',
  name text not null default '',
  nickname text not null default '',
  avatar_url text,
  age_range text,
  city text,
  mobile text,
  consent_location boolean not null default false,
  consent_personalization boolean not null default true,
  consent_marketing boolean not null default false,
  consent_moments_share boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.dev_console_admins (
  email text primary key check (email = lower(btrim(email))),
  created_at timestamptz not null default timezone('utc', now())
);

delete from public.dev_console_admins where email = 'dev@bitinary.ph';

create table if not exists public.dev_console_state (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.dev_console_state (id) values (1)
on conflict (id) do nothing;

create or replace function public.is_dev_console_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.dev_console_admins
    where email = lower(auth.jwt() ->> 'email')
  );
$$;

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and not public.is_dev_console_admin() then
    raise exception 'Only a developer can change account roles.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
before update of role on public.profiles
for each row execute function public.prevent_profile_role_escalation();

create or replace function public.get_public_dev_console_settings()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'banners', coalesce((
      select jsonb_agg(banner)
      from jsonb_array_elements(coalesce(data -> 'banners', '[]'::jsonb)) as banner
      where banner ->> 'status' = 'live'
    ), '[]'::jsonb),
    'theme', data -> 'theme',
    'flags', data -> 'flags',
    'announcement', data -> 'announcement',
    'maintenance', data -> 'maintenance',
    'hiddenPlaces', data -> 'hiddenPlaces',
    'featuredPlaces', data -> 'featuredPlaces'
  ))
  from public.dev_console_state
  where id = 1;
$$;

create or replace function public.track_dev_console_banner_event(banner_id text, event_type text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if event_type not in ('views', 'clicks') then
    raise exception 'Unsupported banner event type';
  end if;

  update public.dev_console_state
  set data = jsonb_set(
    data,
    '{banners}',
    coalesce((
      select jsonb_agg(
        case
          when banner ->> 'id' = banner_id and banner ->> 'status' = 'live' then
            jsonb_set(
              banner,
              array['stats', event_type],
              to_jsonb(coalesce((banner #>> array['stats', event_type])::integer, 0) + 1),
              true
            )
          else banner
        end
        order by ordinal
      )
      from jsonb_array_elements(coalesce(data -> 'banners', '[]'::jsonb)) with ordinality as item(banner, ordinal)
    ), '[]'::jsonb),
    true
  ),
  updated_at = timezone('utc', now())
  where id = 1;
end;
$$;

create table if not exists public.traveler_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_trip text,
  last_trip_at timestamptz,
  trip_checked_at timestamptz,
  frequency text,
  next_trip text,
  daily_budget numeric(12, 2) not null default 1500 check (daily_budget >= 0),
  meal_budget numeric(12, 2) not null default 300 check (meal_budget >= 0),
  flexible boolean not null default false,
  foods text[] not null default '{}',
  diet text[] not null default '{}',
  allergy text,
  interests text[] not null default '{}',
  companions text[] not null default '{}',
  transport text[] not null default '{}',
  pace text,
  needs text[] not null default '{}',
  completed_sections jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  business_type text,
  price_range text,
  address text not null default '',
  city text not null default '',
  latitude double precision,
  longitude double precision,
  contact_name text not null default '',
  mobile text not null default '',
  landline text not null default '',
  about text not null default '',
  specialties text[] not null default '{}',
  languages text[] not null default '{Tagalog}',
  goals text[] not null default '{}',
  logo_url text,
  cover_url text,
  links jsonb not null default '{"facebook":"","instagram":"","tiktok":"","website":""}'::jsonb,
  live boolean not null default false,
  live_at timestamptz,
  verification_status public.business_verification_status not null default 'none',
  verification_method text check (verification_method in ('upload', 'onsite')),
  verification_files text[] not null default '{}',
  verification_data jsonb not null default '{}'::jsonb,
  onsite_date date,
  setup_status jsonb not null default '{}'::jsonb,
  views integer not null default 0 check (views >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.businesses add column if not exists verification_data jsonb not null default '{}'::jsonb;
alter table public.businesses add column if not exists logo_url text;

alter table public.businesses
  add column if not exists setup_status jsonb not null default '{}'::jsonb;

create table if not exists public.business_hours (
  business_id uuid not null references public.businesses(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  all_day boolean not null default false,
  primary key (business_id, day_of_week)
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  price numeric(12, 2) not null check (price >= 0),
  category text not null default '',
  sort_order integer not null default 0
);

create table if not exists public.business_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  storage_path text not null,
  is_cover boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  area text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.business_staff (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null check (role in ('owner', 'manager', 'staff')),
  status text not null default 'invited' check (status in ('active', 'invited')),
  branch_id uuid references public.branches(id) on delete set null,
  primary key (business_id, email)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  post_type text not null check (post_type in ('post', 'reel', 'blog')),
  title text,
  body text not null default '',
  media_urls text[] not null default '{}',
  video_url text,
  status public.post_status not null default 'draft',
  published_at timestamptz,
  scheduled_at timestamptz,
  views integer not null default 0 check (views >= 0),
  likes integer not null default 0 check (likes >= 0),
  saves integer not null default 0 check (saves >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  reply text,
  hidden boolean not null default false,
  reported_reason text,
  blocked boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, user_id)
);

create or replace function public.update_post_social_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_post_id uuid;
begin
  if tg_table_name = 'post_likes' then
    target_post_id := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
    update public.posts
    set likes = greatest(0, likes + case when tg_op = 'DELETE' then -1 else 1 end)
    where id = target_post_id;
  else
    target_post_id := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
    update public.posts
    set comments_count = greatest(
      0,
      comments_count + case when tg_op = 'DELETE' then -1 else 1 end
    )
    where id = target_post_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists post_likes_update_social_counts on public.post_likes;
create trigger post_likes_update_social_counts
after insert or delete on public.post_likes
for each row execute function public.update_post_social_counts();

drop trigger if exists comments_update_social_counts on public.comments;
create trigger comments_update_social_counts
after insert or delete on public.comments
for each row execute function public.update_post_social_counts();

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  stars smallint not null check (stars between 1 and 5),
  body text not null,
  photo_urls text[] not null default '{}',
  visited boolean not null default false,
  checkin_at timestamptz,
  checkin_via text check (checkin_via in ('QR', 'code')),
  reply text,
  hidden boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);
alter table public.reviews add column if not exists hidden boolean not null default false;

create or replace function public.prevent_review_visibility_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.hidden is distinct from old.hidden and not public.is_dev_console_admin() then
    raise exception 'Only a developer can change review visibility.';
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_prevent_visibility_escalation on public.reviews;
create trigger reviews_prevent_visibility_escalation
before update of hidden on public.reviews
for each row execute function public.prevent_review_visibility_escalation();

create or replace function public.get_dev_console_users()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_dev_console_admin() then
    raise exception 'Developer access required.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', u.id,
      'name', coalesce(nullif(p.name, ''), nullif(p.nickname, ''), u.email, 'Unnamed user'),
      'email', u.email,
      'mobile', p.mobile,
      'role', coalesce(p.role, 'traveler'::public.account_role),
      'method', case
        when u.raw_app_meta_data ->> 'provider' = 'google' then 'google'
        when p.mobile is not null and p.mobile <> '' then 'mobile'
        else 'email'
      end,
      'city', p.city,
      'joined', u.created_at,
      'lastActive', u.last_sign_in_at,
      'reviews', (select count(*) from public.reviews r where r.author_id = u.id),
      'comments', (select count(*) from public.comments c where c.author_id = u.id)
    ) order by u.created_at desc)
    from auth.users u
    left join public.profiles p on p.id = u.id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.set_dev_console_user_role(p_user_id uuid, p_role public.account_role)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_dev_console_admin() then
    raise exception 'Developer access required.';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'User profile was not found.';
  end if;
end;
$$;

create or replace function public.set_dev_console_content_hidden(p_item_id uuid, p_kind text, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_dev_console_admin() then
    raise exception 'Developer access required.';
  end if;
  if p_kind = 'review' then
    update public.reviews set hidden = p_hidden where id = p_item_id;
  elsif p_kind = 'comment' then
    update public.comments set hidden = p_hidden where id = p_item_id;
  else
    raise exception 'Unsupported moderation item kind.';
  end if;
  if not found then
    raise exception 'Moderation item was not found.';
  end if;
end;
$$;

create table if not exists public.review_cases (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reason text not null,
  explanation text not null default '',
  evidence_urls text[] not null default '{}',
  status public.review_case_status not null default 'received',
  timeline jsonb not null default '[]'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  decided_at timestamptz
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('b1t1', 'discount', 'addon')),
  item text not null,
  percent numeric(5, 2) check (percent between 0 and 100),
  min_spend numeric(12, 2) check (min_spend >= 0),
  addon text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  limit_per_day integer not null default 0 check (limit_per_day >= 0),
  limit_total integer not null default 0 check (limit_total >= 0),
  redemption text not null check (redemption in ('qr', 'code')),
  code text not null unique,
  status text not null default 'draft' check (status in ('active', 'scheduled', 'ended', 'draft')),
  redeemed_qr integer not null default 0 check (redeemed_qr >= 0),
  redeemed_code integer not null default 0 check (redeemed_code >= 0),
  views integer not null default 0 check (views >= 0)
);

create table if not exists public.boosts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  budget numeric(12, 2) not null check (budget >= 0),
  days integer not null check (days > 0),
  target text not null check (target in ('nearby2', 'nearby5', 'searching')),
  status text not null default 'active' check (status in ('active', 'ended')),
  starts_at timestamptz not null default timezone('utc', now()),
  reach integer not null default 0,
  clicks integer not null default 0,
  saves integer not null default 0
);

create table if not exists public.saved_places (
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, business_id)
);

create table if not exists public.business_daily_stats (
  business_id uuid not null references public.businesses(id) on delete cascade,
  stat_date date not null default current_date,
  views integer not null default 0 check (views >= 0),
  saves integer not null default 0 check (saves >= 0),
  trip_adds integer not null default 0 check (trip_adds >= 0),
  checkins integer not null default 0 check (checkins >= 0),
  deal_customers integer not null default 0 check (deal_customers >= 0),
  primary key (business_id, stat_date)
);

create table if not exists public.business_profile_viewers_daily (
  business_id uuid not null references public.businesses(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_on date not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (business_id, viewer_id, viewed_on)
);

alter table public.business_profile_viewers_daily enable row level security;
revoke all on table public.business_profile_viewers_daily from anon, authenticated;

create or replace function public.track_business_profile_view(p_business_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_viewed_on date := (timezone('utc', now()))::date;
  v_inserted_count integer;
begin
  if v_viewer_id is null then
    return false;
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_viewer_id and p.role = 'traveler'
  ) then
    return false;
  end if;

  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id
      and b.live = true
      and b.verification_status = 'verified'
      and b.owner_id <> v_viewer_id
  ) then
    return false;
  end if;

  insert into public.business_profile_viewers_daily (business_id, viewer_id, viewed_on)
  values (p_business_id, v_viewer_id, v_viewed_on)
  on conflict do nothing;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count = 0 then
    return false;
  end if;

  insert into public.business_daily_stats (business_id, stat_date, views)
  values (p_business_id, v_viewed_on, 1)
  on conflict (business_id, stat_date)
  do update set views = public.business_daily_stats.views + 1;

  return true;
end;
$$;

revoke all on function public.track_business_profile_view(uuid) from public, anon;
grant execute on function public.track_business_profile_view(uuid) to authenticated;

create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_key text,
  title text not null,
  subtitle text,
  budget numeric(12, 2) not null default 0 check (budget >= 0),
  area text,
  image_url text,
  is_saved boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists itineraries_user_source_key_idx
  on public.itineraries (user_id, source_key)
  where source_key is not null;

create table if not exists public.itinerary_stops (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  stop_time text not null,
  name text not null,
  kind text not null,
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  note text,
  sort_order integer not null default 0
);

create or replace function public.save_traveler_itinerary(
  p_source_key text,
  p_title text,
  p_subtitle text,
  p_budget numeric,
  p_area text,
  p_stops jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_itinerary_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to save an itinerary.';
  end if;

  if p_source_key is null or p_source_key !~ '^template:[A-Za-z0-9_-]+$' then
    raise exception 'Invalid itinerary template key.';
  end if;

  if jsonb_typeof(coalesce(p_stops, '[]'::jsonb)) <> 'array' then
    raise exception 'Itinerary stops must be an array.';
  end if;

  insert into public.itineraries (user_id, source_key, title, subtitle, budget, area, is_saved)
  values (v_user_id, p_source_key, p_title, p_subtitle, p_budget, p_area, true)
  on conflict (user_id, source_key) where source_key is not null
  do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    budget = excluded.budget,
    area = excluded.area,
    is_saved = true
  returning id into v_itinerary_id;

  delete from public.itinerary_stops where itinerary_id = v_itinerary_id;

  insert into public.itinerary_stops (
    itinerary_id, stop_time, name, kind, cost, note, sort_order
  )
  select
    v_itinerary_id, stop_time, name, kind, cost, note, sort_order
  from jsonb_to_recordset(coalesce(p_stops, '[]'::jsonb)) as stop_rows(
    stop_time text,
    name text,
    kind text,
    cost numeric,
    note text,
    sort_order integer
  );

  return v_itinerary_id;
end;
$$;

revoke all on function public.save_traveler_itinerary(text, text, text, numeric, text, jsonb) from public, anon;
grant execute on function public.save_traveler_itinerary(text, text, text, numeric, text, jsonb) to authenticated;

create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  caption text not null default '',
  visited_at date not null default current_date,
  place_name text not null,
  area text not null default '',
  latitude double precision,
  longitude double precision,
  kind text not null,
  trip text,
  frame text not null default 'classic',
  tilt numeric(4, 1) not null default 0,
  on_map boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.moment_collaborators (
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (moment_id, user_id),
  check (user_id <> added_by)
);

create table if not exists public.moment_photos (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists moment_collaborators_user_idx
  on public.moment_collaborators (user_id, moment_id);
create index if not exists moment_photos_moment_created_idx
  on public.moment_photos (moment_id, created_at);

create table if not exists public.reservation_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  requester_id uuid references public.profiles(id) on delete set null,
  guest_name text not null,
  party_size integer not null check (party_size > 0),
  requested_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'accepted', 'declined')),
  note text
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  target text,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.can_access_moment(p_moment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.moments m
    where m.id = p_moment_id
      and (
        m.author_id = auth.uid()
        or exists (
          select 1
          from public.moment_collaborators mc
          where mc.moment_id = m.id and mc.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.can_access_moment(uuid) from public, anon;
grant execute on function public.can_access_moment(uuid) to authenticated;

drop function if exists public.search_moment_travelers(text);
create function public.search_moment_travelers(p_query text)
returns table (id uuid, name text, nickname text, avatar_url text, email text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.name,
    p.nickname,
    p.avatar_url,
    case when lower(u.email) = lower(trim(p_query)) then u.email else null end
  from public.profiles p
  join auth.users u on u.id = p.id
  where auth.uid() is not null
    and p.role = 'traveler'
    and p.id <> auth.uid()
    and length(trim(coalesce(p_query, ''))) >= 2
    and (
      p.nickname ilike '%' || trim(p_query) || '%'
      or p.name ilike '%' || trim(p_query) || '%'
      or lower(u.email) = lower(trim(p_query))
    )
  order by coalesce(lower(u.email) = lower(trim(p_query)), false) desc, p.nickname, p.name
  limit 12;
$$;

revoke all on function public.search_moment_travelers(text) from public, anon;
grant execute on function public.search_moment_travelers(text) to authenticated;

create or replace function public.is_moment_traveler(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.role = 'traveler'
  );
$$;

revoke all on function public.is_moment_traveler(uuid) from public, anon;
grant execute on function public.is_moment_traveler(uuid) to authenticated;

create or replace function public.list_moment_collaborators(p_moment_id uuid)
returns table (id uuid, name text, nickname text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.nickname, p.avatar_url
  from public.moment_collaborators mc
  join public.profiles p on p.id = mc.user_id
  where mc.moment_id = p_moment_id
    and public.can_access_moment(p_moment_id)
  order by mc.created_at;
$$;

revoke all on function public.list_moment_collaborators(uuid) from public, anon;
grant execute on function public.list_moment_collaborators(uuid) to authenticated;

create or replace function public.notify_moment_collaborator(p_moment_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author_id uuid;
  v_caption text;
begin
  select m.author_id, m.caption
  into v_author_id, v_caption
  from public.moments m
  where m.id = p_moment_id;

  if v_author_id is null or v_author_id <> auth.uid()
     or not exists (
       select 1 from public.moment_collaborators mc
       where mc.moment_id = p_moment_id and mc.user_id = p_user_id
     ) then
    raise exception 'Only the Moment author can notify its collaborators.';
  end if;

  insert into public.notifications (user_id, kind, title, body, target)
  values (
    p_user_id,
    'moment_tag',
    'You were tagged in a Moment',
    coalesce(nullif(v_caption, ''), 'A traveler shared a Moment with you.'),
    '/moments/map?moment=' || p_moment_id::text
  );
end;
$$;

revoke all on function public.notify_moment_collaborator(uuid, uuid) from public, anon;
grant execute on function public.notify_moment_collaborator(uuid, uuid) to authenticated;

create or replace function public.guard_moment_collaborator_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and old.author_id <> auth.uid() then
    if not public.can_access_moment(old.id) then
      raise exception 'You are not a collaborator on this Moment.';
    end if;

    if new.id is distinct from old.id
       or new.author_id is distinct from old.author_id
       or new.storage_path is distinct from old.storage_path
       or new.created_at is distinct from old.created_at
       or new.on_map is distinct from old.on_map then
      raise exception 'Collaborators can edit Moment details but cannot replace or remove the original photo.';
    end if;
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists moments_guard_collaborator_update on public.moments;
create trigger moments_guard_collaborator_update
before update on public.moments
for each row execute function public.guard_moment_collaborator_update();

create or replace function public.set_dev_console_business_verification(
  p_business_id uuid,
  p_verification jsonb,
  p_notification jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid;
  v_status public.business_verification_status;
begin
  if not public.is_dev_console_admin() then
    raise exception 'Developer access required.';
  end if;

  v_status := case p_verification ->> 'status'
    when 'pending' then 'pending'::public.business_verification_status
    when 'verified' then 'verified'::public.business_verification_status
    when 'needs-docs' then 'needs-docs'::public.business_verification_status
    when 'rejected' then 'needs-docs'::public.business_verification_status
    else 'none'::public.business_verification_status
  end;

  update public.businesses
  set verification_status =   v_status,
      verification_method = nullif(p_verification ->> 'method', ''),
      verification_files = coalesce(array(
        select jsonb_array_elements_text(coalesce(p_verification -> 'files', '[]'::jsonb))
      ), '{}'::text[]),
      onsite_date = nullif(p_verification ->> 'onsiteDate', '')::date,
      verification_data = p_verification
  where id = p_business_id
  returning owner_id into v_owner_id;

  if not found then
    raise exception 'Business was not found.';
  end if;

  if p_notification is not null then
    insert into public.notifications (user_id, kind, title, body, target)
    values (
      v_owner_id,
      'verification',
      'Business verification update',
      concat_ws(E'\n', nullif(p_notification ->> 'en', ''), nullif(p_notification ->> 'tl', '')),
      '/biz/stats/backgrounds#verify'
    );
  end if;
end;
$$;

create table if not exists public.jimbot_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  planning_context jsonb default '{}'::jsonb
);

create table if not exists public.jimbot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.jimbot_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'bot')),
  intent text,
  content text not null,
  payload jsonb default null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists posts_business_published_idx on public.posts (business_id, published_at desc);
create index if not exists reviews_business_created_idx on public.reviews (business_id, created_at desc);
create index if not exists reviews_author_idx on public.reviews (author_id);
create index if not exists comments_post_created_idx on public.comments (post_id, created_at);
create index if not exists comments_author_idx on public.comments (author_id);
create index if not exists moments_author_created_idx on public.moments (author_id, created_at desc);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists jimbot_conversations_user_updated_idx on public.jimbot_conversations (user_id, updated_at desc);
create index if not exists jimbot_messages_conversation_created_idx on public.jimbot_messages (conversation_id, created_at);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists businesses_updated_at on public.businesses;
create trigger businesses_updated_at before update on public.businesses
for each row execute function public.set_updated_at();
drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at before update on public.posts
for each row execute function public.set_updated_at();
drop trigger if exists itineraries_updated_at on public.itineraries;
create trigger itineraries_updated_at before update on public.itineraries
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.dev_console_admins enable row level security;
alter table public.dev_console_state enable row level security;
alter table public.traveler_preferences enable row level security;
alter table public.businesses enable row level security;
alter table public.business_hours enable row level security;
alter table public.menu_items enable row level security;
alter table public.business_photos enable row level security;
alter table public.branches enable row level security;
alter table public.business_staff enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.reviews enable row level security;
alter table public.review_cases enable row level security;
alter table public.deals enable row level security;
alter table public.boosts enable row level security;
alter table public.saved_places enable row level security;
alter table public.business_daily_stats enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_stops enable row level security;
alter table public.moments enable row level security;
alter table public.moment_collaborators enable row level security;
alter table public.moment_photos enable row level security;
alter table public.reservation_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.jimbot_conversations enable row level security;
alter table public.jimbot_messages enable row level security;

revoke all on public.dev_console_admins from anon, authenticated;
grant select, insert, delete on public.dev_console_admins to authenticated;
drop policy if exists "Developers can view their own console allowlist entry" on public.dev_console_admins;
create policy "Developers can view their own console allowlist entry" on public.dev_console_admins
for select to authenticated using (
  lower(email) = lower(auth.jwt() ->> 'email')
);
drop policy if exists "Developers can view console team access" on public.dev_console_admins;
create policy "Developers can view console team access" on public.dev_console_admins
for select to authenticated using (public.is_dev_console_admin());
drop policy if exists "Developers manage console team access" on public.dev_console_admins;
create policy "Developers manage console team access" on public.dev_console_admins
for insert to authenticated with check (public.is_dev_console_admin());
drop policy if exists "Developers remove console team access" on public.dev_console_admins;
create policy "Developers remove console team access" on public.dev_console_admins
for delete to authenticated using (public.is_dev_console_admin());

revoke all on public.dev_console_state from anon, authenticated;
grant select, insert, update on public.dev_console_state to authenticated;
drop policy if exists "Developers manage console state" on public.dev_console_state;
create policy "Developers manage console state" on public.dev_console_state
for all to authenticated
using (public.is_dev_console_admin())
with check (public.is_dev_console_admin());

revoke all on function public.is_dev_console_admin() from public, anon;
grant execute on function public.is_dev_console_admin() to authenticated;
revoke all on function public.get_dev_console_users() from public, anon;
grant execute on function public.get_dev_console_users() to authenticated;
revoke all on function public.set_dev_console_user_role(uuid, public.account_role) from public, anon;
grant execute on function public.set_dev_console_user_role(uuid, public.account_role) to authenticated;
revoke all on function public.set_dev_console_content_hidden(uuid, text, boolean) from public, anon;
grant execute on function public.set_dev_console_content_hidden(uuid, text, boolean) to authenticated;
revoke all on function public.set_dev_console_business_verification(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.set_dev_console_business_verification(uuid, jsonb, jsonb) to authenticated;
revoke all on function public.get_public_dev_console_settings() from public;
grant execute on function public.get_public_dev_console_settings() to anon, authenticated;
revoke all on function public.track_dev_console_banner_event(text, text) from public;
grant execute on function public.track_dev_console_banner_event(text, text) to anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'dev_console_state',
    'businesses',
    'business_hours',
    'menu_items',
    'business_photos',
    'posts',
    'comments',
    'post_likes',
    'reviews',
    'business_daily_stats'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

do $$
declare
  policy_name text;
  policy_table text;
  policy_pair text[];
begin
  foreach policy_pair slice 1 in array array[
    ['Users manage their profile', 'public.profiles'],
    ['Developers view user profiles', 'public.profiles'],
    ['Users manage their preferences', 'public.traveler_preferences'],
    ['Users manage saved places', 'public.saved_places'],
    ['Owners view saved places for their business', 'public.saved_places'],
    ['Users manage itineraries', 'public.itineraries'],
    ['Users manage itinerary stops', 'public.itinerary_stops'],
    ['Users manage moments', 'public.moments'],
    ['Authors manage moments', 'public.moments'],
    ['Collaborators view moments', 'public.moments'],
    ['Collaborators update moment details', 'public.moments'],
    ['Moment participants view collaborators', 'public.moment_collaborators'],
    ['Moment authors add collaborators', 'public.moment_collaborators'],
    ['Moment authors remove collaborators', 'public.moment_collaborators'],
    ['Moment participants view photos', 'public.moment_photos'],
    ['Moment participants add photos', 'public.moment_photos'],
    ['Authors and uploaders delete added photos', 'public.moment_photos'],
    ['Users view notifications', 'public.notifications'],
    ['Users update notifications', 'public.notifications'],
    ['Users manage Jimbot conversations', 'public.jimbot_conversations'],
    ['Users manage Jimbot messages', 'public.jimbot_messages'],
    ['Public can view live businesses', 'public.businesses'],
    ['Developers view businesses', 'public.businesses'],
    ['Owners manage businesses', 'public.businesses'],
    ['Public can view business hours', 'public.business_hours'],
    ['Owners manage business hours', 'public.business_hours'],
    ['Public can view menus', 'public.menu_items'],
    ['Owners manage menus', 'public.menu_items'],
    ['Public can view business photos', 'public.business_photos'],
    ['Owners manage business photos', 'public.business_photos'],
    ['Public can view branches', 'public.branches'],
    ['Owners manage branches', 'public.branches'],
    ['Owners manage business staff', 'public.business_staff'],
    ['Public can view business content', 'public.posts'],
    ['Developers view posts', 'public.posts'],
    ['Owners manage posts', 'public.posts'],
    ['Public can view reviews', 'public.reviews'],
    ['Users create reviews', 'public.reviews'],
    ['Authors update reviews', 'public.reviews'],
    ['Owners manage review replies', 'public.reviews'],
    ['Developers view all reviews', 'public.reviews'],
    ['Developers moderate reviews', 'public.reviews'],
    ['Users create comments', 'public.comments'],
    ['Public can view visible comments', 'public.comments'],
    ['Owners moderate comments', 'public.comments'],
    ['Developers view all comments', 'public.comments'],
    ['Developers moderate comments', 'public.comments'],
    ['Users view own post likes', 'public.post_likes'],
    ['Users create post likes', 'public.post_likes'],
    ['Users delete own post likes', 'public.post_likes'],
    ['Owners manage review cases', 'public.review_cases'],
    ['Public can view active deals', 'public.deals'],
    ['Owners manage deals', 'public.deals'],
    ['Owners manage boosts', 'public.boosts'],
    ['Public can view business daily stats', 'public.business_daily_stats'],
    ['Owners manage business daily stats', 'public.business_daily_stats'],
    ['Users create reservations', 'public.reservation_requests'],
    ['Users view their reservations', 'public.reservation_requests'],
    ['Owners manage reservations', 'public.reservation_requests'],
    ['Users upload their own images', 'storage.objects'],
    ['Users view their own images', 'storage.objects'],
    ['Users view own and shared Moment images', 'storage.objects'],
    ['Moment authors delete shared images', 'storage.objects'],
    ['Users update their own images', 'storage.objects'],
    ['Users delete their own images', 'storage.objects'],
    ['Users upload their own videos', 'storage.objects'],
    ['Users view their own videos', 'storage.objects'],
    ['Users update their own videos', 'storage.objects'],
    ['Users delete their own videos', 'storage.objects']
  ]::text[][]
  loop
    policy_name := policy_pair[1];
    policy_table := policy_pair[2];
    execute format('drop policy if exists %I on %s', policy_name, policy_table);
  end loop;
end $$;

create policy "Users manage their profile" on public.profiles
for all using (id = auth.uid()) with check (id = auth.uid());
create policy "Developers view user profiles" on public.profiles
for select to authenticated using (public.is_dev_console_admin());
create policy "Users manage their preferences" on public.traveler_preferences
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage saved places" on public.saved_places
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Owners view saved places for their business" on public.saved_places
for select using (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
));
create policy "Users manage itineraries" on public.itineraries
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage itinerary stops" on public.itinerary_stops
for all using (exists (
  select 1 from public.itineraries i
  where i.id = itinerary_id and i.user_id = auth.uid()
)) with check (exists (
  select 1 from public.itineraries i
  where i.id = itinerary_id and i.user_id = auth.uid()
));
create policy "Authors manage moments" on public.moments
for all using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Collaborators view moments" on public.moments
for select to authenticated using (public.can_access_moment(id));
create policy "Collaborators update moment details" on public.moments
for update to authenticated
using (author_id <> auth.uid() and public.can_access_moment(id))
with check (author_id <> auth.uid() and public.can_access_moment(id));
create policy "Moment participants view collaborators" on public.moment_collaborators
for select to authenticated using (public.can_access_moment(moment_id));
create policy "Moment authors add collaborators" on public.moment_collaborators
for insert to authenticated
with check (
  added_by = auth.uid()
  and user_id <> auth.uid()
  and public.is_moment_traveler(user_id)
  and exists (
    select 1 from public.moments m where m.id = moment_id and m.author_id = auth.uid()
  )
);
create policy "Moment authors remove collaborators" on public.moment_collaborators
for delete to authenticated
using (
  exists (
    select 1 from public.moments m where m.id = moment_id and m.author_id = auth.uid()
  )
);
create policy "Moment participants view photos" on public.moment_photos
for select to authenticated using (public.can_access_moment(moment_id));
create policy "Moment participants add photos" on public.moment_photos
for insert to authenticated
with check (
  author_id = auth.uid()
  and (storage.foldername(storage_path))[1] = auth.uid()::text
  and public.can_access_moment(moment_id)
);
create policy "Authors and uploaders delete added photos" on public.moment_photos
for delete to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1 from public.moments m where m.id = moment_id and m.author_id = auth.uid()
  )
);
grant select, insert, update, delete on public.moments to authenticated;
grant select, insert, delete on public.moment_collaborators to authenticated;
grant select, insert, delete on public.moment_photos to authenticated;
create policy "Users view notifications" on public.notifications
for select using (user_id = auth.uid());
create policy "Users update notifications" on public.notifications
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage Jimbot conversations" on public.jimbot_conversations
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage Jimbot messages" on public.jimbot_messages
for all using (user_id = auth.uid()) with check (
  user_id = auth.uid() and exists (
    select 1 from public.jimbot_conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  )
);

create policy "Public can view live businesses" on public.businesses
for select using (live = true or owner_id = auth.uid());
create policy "Developers view businesses" on public.businesses
for select to authenticated using (public.is_dev_console_admin());
create policy "Owners manage businesses" on public.businesses
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Public can view business hours" on public.business_hours
for select using (exists (
  select 1 from public.businesses b where b.id = business_id and b.live = true
));
create policy "Owners manage business hours" on public.business_hours
for all using (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
));

create policy "Public can view menus" on public.menu_items
for select using (exists (
  select 1 from public.businesses b where b.id = business_id and b.live = true
));
create policy "Owners manage menus" on public.menu_items
for all using (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
));

create policy "Public can view business photos" on public.business_photos
for select using (exists (
  select 1 from public.businesses b where b.id = business_id and b.live = true
));
create policy "Owners manage business photos" on public.business_photos
for all using (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
));

create policy "Public can view branches" on public.branches
for select using (exists (
  select 1 from public.businesses b where b.id = business_id and b.live = true
));
create policy "Owners manage branches" on public.branches
for all using (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
));

create policy "Owners manage business staff" on public.business_staff
for all using (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
));

create policy "Public can view business content" on public.posts
for select using (
  status = 'published'
  or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
);
create policy "Developers view posts" on public.posts
for select to authenticated using (public.is_dev_console_admin());
create policy "Owners manage posts" on public.posts
for all using (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
));

create policy "Public can view reviews" on public.reviews
for select using (hidden = false);
create policy "Developers view all reviews" on public.reviews
for select to authenticated using (public.is_dev_console_admin());
create policy "Developers moderate reviews" on public.reviews
for update to authenticated using (public.is_dev_console_admin()) with check (public.is_dev_console_admin());
create policy "Users create reviews" on public.reviews
for insert with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'traveler'
  )
);
create policy "Authors update reviews" on public.reviews
for update using (author_id = auth.uid()) with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'traveler'
  )
);
create policy "Owners manage review replies" on public.reviews
for update using (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
));
create policy "Users create comments" on public.comments
for insert to authenticated with check (
  author_id = auth.uid()
  and hidden = false
  and blocked = false
  and reply is null
  and length(trim(body)) between 1 and 2000
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'traveler'
  )
  and exists (
    select 1
    from public.posts post
    join public.businesses b on b.id = post.business_id
    where post.id = comments.post_id
      and post.status = 'published'
      and b.live = true
      and b.verification_status = 'verified'
  )
);
grant select on public.comments to anon, authenticated;
grant insert, update on public.comments to authenticated;
create policy "Public can view visible comments" on public.comments
for select using (hidden = false);
create policy "Developers view all comments" on public.comments
for select to authenticated using (public.is_dev_console_admin());
create policy "Developers moderate comments" on public.comments
for update to authenticated using (public.is_dev_console_admin()) with check (public.is_dev_console_admin());
create policy "Owners moderate comments" on public.comments
for update using (exists (
  select 1 from public.posts p
  join public.businesses b on b.id = p.business_id
  where p.id = post_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.posts p
  join public.businesses b on b.id = p.business_id
  where p.id = post_id and b.owner_id = auth.uid()
));

revoke all on public.post_likes from public, anon, authenticated;
grant select, insert, delete on public.post_likes to authenticated;
create policy "Users view own post likes" on public.post_likes
for select to authenticated using (user_id = auth.uid());
create policy "Users create post likes" on public.post_likes
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'traveler'
  )
  and exists (
    select 1
    from public.posts post
    join public.businesses b on b.id = post.business_id
    where post.id = post_likes.post_id
      and post.status = 'published'
      and b.live = true
      and b.verification_status = 'verified'
  )
);
create policy "Users delete own post likes" on public.post_likes
for delete to authenticated using (user_id = auth.uid());

create policy "Owners manage review cases" on public.review_cases
for all using (exists (
  select 1 from public.reviews r
  join public.businesses b on b.id = r.business_id
  where r.id = review_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.reviews r
  join public.businesses b on b.id = r.business_id
  where r.id = review_id and b.owner_id = auth.uid()
));
create policy "Public can view active deals" on public.deals
for select using (status = 'active' and ends_at > timezone('utc', now()));
create policy "Owners manage deals" on public.deals
for all using (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
));
create policy "Owners manage boosts" on public.boosts
for all using (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
));
create policy "Users create reservations" on public.reservation_requests
for insert with check (requester_id = auth.uid());
create policy "Users view their reservations" on public.reservation_requests
for select using (
  requester_id = auth.uid()
  or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
);
create policy "Owners manage reservations" on public.reservation_requests
for update using (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  insert into public.traveler_preferences (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('images', 'images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]),
  ('dev-console-assets', 'dev-console-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]),
  ('videos', 'videos', false, 104857600, array['video/mp4', 'video/webm', 'video/quicktime']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their own images" on storage.objects;
drop policy if exists "Users view their own images" on storage.objects;
drop policy if exists "Users update their own images" on storage.objects;
drop policy if exists "Users delete their own images" on storage.objects;
drop policy if exists "Users upload their own videos" on storage.objects;
drop policy if exists "Users view their own videos" on storage.objects;
drop policy if exists "Users update their own videos" on storage.objects;
drop policy if exists "Users delete their own videos" on storage.objects;

create policy "Users upload their own images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users view own and shared Moment images"
on storage.objects for select to authenticated
using (
  bucket_id = 'images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.moments m
      where m.storage_path = storage.objects.name
        and public.can_access_moment(m.id)
    )
    or exists (
      select 1
      from public.moment_photos mp
      where mp.storage_path = storage.objects.name
        and public.can_access_moment(mp.moment_id)
    )
  )
);

create policy "Users update their own images"
on storage.objects for update to authenticated
using (
  bucket_id = 'images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users delete their own images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Moment authors delete shared images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'images'
  and exists (
    select 1 from public.moments m
    where m.author_id = auth.uid()
      and (
        m.storage_path = storage.objects.name
        or exists (
          select 1 from public.moment_photos mp
          where mp.moment_id = m.id and mp.storage_path = storage.objects.name
        )
      )
  )
);

create policy "Users upload their own videos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users view their own videos"
on storage.objects for select to authenticated
using (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users update their own videos"
on storage.objects for update to authenticated
using (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users delete their own videos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Travelers view live business images" on storage.objects;
create policy "Travelers view live business images"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'images'
  and exists (
    select 1
    from public.businesses b
    where b.live = true
      and b.verification_status = 'verified'
      and (
        (
          (storage.foldername(name))[1] = b.owner_id::text
          and (storage.foldername(name))[2] = 'business'
        )
        or (
          (storage.foldername(name))[1] = 'business'
          and (storage.foldername(name))[2] in (b.id::text, b.owner_id::text)
        )
      )
      and (
        b.logo_url = storage.objects.name
        or
        b.cover_url = storage.objects.name
        or exists (
          select 1 from public.business_photos photo
          where photo.business_id = b.id and photo.storage_path = storage.objects.name
        )
        or exists (
          select 1 from public.posts post
          where post.business_id = b.id
            and post.status = 'published'
            and storage.objects.name = any(post.media_urls)
        )
        or exists (
          select 1 from public.reviews review
          where review.business_id = b.id
            and review.hidden = false
            and storage.objects.name = any(review.photo_urls)
        )
      )
  )
);

drop policy if exists "Travelers view live business videos" on storage.objects;
create policy "Travelers view live business videos"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'videos'
  and (storage.foldername(name))[2] = 'business'
  and exists (
    select 1
    from public.posts post
    join public.businesses b on b.id = post.business_id
    where b.owner_id::text = (storage.foldername(name))[1]
      and b.live = true
      and b.verification_status = 'verified'
      and post.status = 'published'
      and post.video_url = storage.objects.name
  )
);

drop policy if exists "Developers manage console banner assets" on storage.objects;
create policy "Developers manage console banner assets"
on storage.objects for all to authenticated
using (
  bucket_id = 'dev-console-assets'
  and public.is_dev_console_admin()
)
with check (
  bucket_id = 'dev-console-assets'
  and public.is_dev_console_admin()
);

alter table public.businesses
  add column if not exists setup_status jsonb not null default '{}'::jsonb;

create or replace function public.save_business_workspace(p_workspace jsonb)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := auth.uid();
  v_business jsonb;
  v_business_id uuid;
  v_requested_id uuid;
  v_entry record;
  v_item jsonb;
  v_item_id uuid;
  v_day smallint;
  v_item_name text;
  v_item_category text;
  v_item_price numeric(12, 2);
  v_item_key text;
  v_item_hash text;
  v_verification_status public.business_verification_status;
begin
  if v_owner_id is null then
    raise exception 'Sign in as the business owner before saving business data.';
  end if;

  if jsonb_typeof(p_workspace) is distinct from 'object'
     or jsonb_typeof(p_workspace -> 'business') is distinct from 'object' then
    raise exception 'Business workspace data is missing or invalid.';
  end if;

  v_business := p_workspace -> 'business';

  if nullif(v_business ->> 'id', '') is not null then
    if (v_business ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'The business ID is invalid. Reload the business and try again.';
    end if;

    v_requested_id := (v_business ->> 'id')::uuid;
    select b.id into v_business_id
    from public.businesses b
    where b.id = v_requested_id and b.owner_id = v_owner_id;

    if v_business_id is null then
      raise exception 'The business was not found for this account or is not owned by you.';
    end if;
  else
    select b.id into v_business_id
    from public.businesses b
    where b.owner_id = v_owner_id
    order by b.created_at, b.id
    limit 1;
  end if;

  v_verification_status := case v_business #>> '{verification,status}'
    when 'pending' then 'pending'::public.business_verification_status
    when 'verified' then 'verified'::public.business_verification_status
    when 'needs-docs' then 'needs-docs'::public.business_verification_status
    when 'rejected' then 'needs-docs'::public.business_verification_status
    else 'none'::public.business_verification_status
  end;

  if v_business_id is null then
    insert into public.businesses (
      owner_id, name, business_type, price_range, address, city, latitude, longitude,
      contact_name, mobile, landline, about, specialties, languages, goals, cover_url,
      links, live, live_at, verification_status, verification_method, verification_files, verification_data,
      onsite_date, setup_status
    )
    values (
      v_owner_id,
      coalesce(v_business ->> 'name', ''),
      nullif(v_business ->> 'type', ''),
      nullif(v_business ->> 'price', ''),
      coalesce(v_business ->> 'address', ''),
      coalesce(v_business ->> 'city', ''),
      nullif(v_business #>> '{pin,lat}', '')::double precision,
      nullif(v_business #>> '{pin,lng}', '')::double precision,
      coalesce(v_business ->> 'contactName', ''),
      coalesce(v_business ->> 'mobile', ''),
      coalesce(v_business ->> 'landline', ''),
      coalesce(v_business ->> 'about', ''),
      coalesce(array(select jsonb_array_elements_text(v_business -> 'specialties')), '{}'::text[]),
      coalesce(array(select jsonb_array_elements_text(v_business -> 'languages')), '{}'::text[]),
      coalesce(array(select jsonb_array_elements_text(v_business -> 'goals')), '{}'::text[]),
      nullif(v_business ->> 'cover', ''),
      coalesce(v_business -> 'links', '{"facebook":"","instagram":"","tiktok":"","website":""}'::jsonb),
      coalesce((v_business ->> 'live')::boolean, false),
      nullif(v_business ->> 'liveAt', '')::timestamptz,
      v_verification_status,
      nullif(v_business #>> '{verification,method}', ''),
      coalesce(array(select jsonb_array_elements_text(v_business #> '{verification,files}')), '{}'::text[]),
      coalesce(v_business -> 'verification', '{}'::jsonb),
      nullif(v_business #>> '{verification,onsiteDate}', '')::date,
      coalesce(v_business -> 'status', '{}'::jsonb)
    )
    returning id into v_business_id;
  else
    update public.businesses
    set name = coalesce(v_business ->> 'name', name),
        business_type = nullif(v_business ->> 'type', ''),
        price_range = nullif(v_business ->> 'price', ''),
        address = coalesce(v_business ->> 'address', address),
        city = coalesce(v_business ->> 'city', city),
        latitude = nullif(v_business #>> '{pin,lat}', '')::double precision,
        longitude = nullif(v_business #>> '{pin,lng}', '')::double precision,
        contact_name = coalesce(v_business ->> 'contactName', contact_name),
        mobile = coalesce(v_business ->> 'mobile', mobile),
        landline = coalesce(v_business ->> 'landline', landline),
        about = coalesce(v_business ->> 'about', about),
        specialties = coalesce(array(select jsonb_array_elements_text(v_business -> 'specialties')), '{}'::text[]),
        languages = coalesce(array(select jsonb_array_elements_text(v_business -> 'languages')), '{}'::text[]),
        goals = coalesce(array(select jsonb_array_elements_text(v_business -> 'goals')), '{}'::text[]),
        cover_url = nullif(v_business ->> 'cover', ''),
        links = coalesce(v_business -> 'links', links),
        live = coalesce((v_business ->> 'live')::boolean, live),
        live_at = nullif(v_business ->> 'liveAt', '')::timestamptz,
        verification_status = v_verification_status,
        verification_method = nullif(v_business #>> '{verification,method}', ''),
        verification_files = coalesce(array(select jsonb_array_elements_text(v_business #> '{verification,files}')), '{}'::text[]),
        verification_data = coalesce(v_business -> 'verification', verification_data),
        onsite_date = nullif(v_business #>> '{verification,onsiteDate}', '')::date,
        setup_status = coalesce(v_business -> 'status', '{}'::jsonb)
    where id = v_business_id and owner_id = v_owner_id;

    if not found then
      raise exception 'The business could not be updated for this account.';
    end if;
  end if;

  if jsonb_typeof(v_business -> 'hours') = 'object' then
    for v_entry in select key, value from jsonb_each(v_business -> 'hours')
    loop
      v_day := case v_entry.key
        when 'mon' then 0 when 'tue' then 1 when 'wed' then 2
        when 'thu' then 3 when 'fri' then 4 when 'sat' then 5
        when 'sun' then 6
        else null
      end;

      if v_day is null then
        raise exception 'Unrecognized business-hours day: %.', v_entry.key;
      end if;

      insert into public.business_hours (
        business_id, day_of_week, opens_at, closes_at, is_closed, all_day
      )
      values (
        v_business_id,
        v_day,
        nullif(v_entry.value ->> 'open', '')::time,
        nullif(v_entry.value ->> 'close', '')::time,
        coalesce((v_entry.value ->> 'closed')::boolean, false),
        coalesce((v_entry.value ->> 'allDay')::boolean, false)
      )
      on conflict (business_id, day_of_week) do update
      set opens_at = excluded.opens_at,
          closes_at = excluded.closes_at,
          is_closed = excluded.is_closed,
          all_day = excluded.all_day;
    end loop;
  end if;

  if jsonb_typeof(v_business -> 'menu') = 'array' then
    for v_entry in
      select value, ordinality
      from jsonb_array_elements(v_business -> 'menu') with ordinality
    loop
      v_item := v_entry.value;
      v_item_name := nullif(btrim(v_item ->> 'name'), '');
      if v_item_name is null then
        continue;
      end if;

      if nullif(v_item ->> 'price', '') is null
         or (v_item ->> 'price') !~ '^[0-9]+(\.[0-9]{1,2})?$' then
        raise exception 'Enter a valid price for menu item "%".', v_item_name;
      end if;
      v_item_price := (v_item ->> 'price')::numeric(12, 2);
      v_item_category := coalesce(v_item ->> 'category', '');
      v_item_key := coalesce(v_item ->> 'id', v_entry.ordinality::text);

      if v_item_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        v_item_id := v_item_key::uuid;
        if exists (select 1 from public.menu_items mi where mi.id = v_item_id and mi.business_id <> v_business_id) then
          raise exception 'A menu item ID does not belong to this business.';
        end if;
      else
        v_item_hash := md5(v_business_id::text || ':' || v_item_key);
        v_item_id := (
          substr(v_item_hash, 1, 8) || '-' || substr(v_item_hash, 9, 4) || '-' ||
          substr(v_item_hash, 13, 4) || '-' || substr(v_item_hash, 17, 4) || '-' ||
          substr(v_item_hash, 21, 12)
        )::uuid;
      end if;

      insert into public.menu_items (id, business_id, name, price, category, sort_order)
      values (v_item_id, v_business_id, v_item_name, v_item_price, v_item_category, v_entry.ordinality - 1)
      on conflict (id) do update
      set name = excluded.name,
          price = excluded.price,
          category = excluded.category,
          sort_order = excluded.sort_order
      where public.menu_items.business_id = v_business_id;
    end loop;
  end if;

  return v_business_id;
end;
$$;

revoke all on function public.save_business_workspace(jsonb) from public;
grant execute on function public.save_business_workspace(jsonb) to authenticated;

-- Jimbot hybrid search (city filter + vector rank)
create extension if not exists vector;

create table if not exists public.business_embeddings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  embedding vector(1536) not null,
  content_hash text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists business_embeddings_embedding_idx
  on public.business_embeddings
  using hnsw (embedding vector_cosine_ops);

alter table public.business_embeddings enable row level security;

drop policy if exists "Public read business embeddings" on public.business_embeddings;
create policy "Public read business embeddings"
  on public.business_embeddings
  for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.live = true
    )
  );

drop policy if exists "Owners manage business embeddings" on public.business_embeddings;
create policy "Owners manage business embeddings"
  on public.business_embeddings
  for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

create or replace function public.search_businesses_hybrid(
  p_area text,
  p_query_embedding vector(1536),
  p_limit integer default 8
)
returns table (
  id uuid,
  name text,
  business_type text,
  price_range text,
  city text,
  latitude double precision,
  longitude double precision,
  about text,
  specialties text[],
  distance float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    b.id,
    b.name,
    b.business_type,
    b.price_range,
    b.city,
    b.latitude,
    b.longitude,
    b.about,
    b.specialties,
    (e.embedding <=> p_query_embedding)::float as distance
  from public.businesses b
  join public.business_embeddings e on e.business_id = b.id
  where b.live = true
    and b.verification_status = 'verified'
    and b.city ilike '%' || p_area || '%'
  order by e.embedding <=> p_query_embedding
  limit greatest(1, least(coalesce(p_limit, 8), 10));
$$;

revoke all on function public.search_businesses_hybrid(text, vector, integer) from public;
grant execute on function public.search_businesses_hybrid(text, vector, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- 20261124090000_business_insights_and_quick_updates.sql
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

-- 20261124100000_business_verification.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-verification',
  'business-verification',
  false,
  10485760,
  array[
    'application/pdf', 'image/bmp', 'image/gif', 'image/heic', 'image/heif',
    'image/jpeg', 'image/png', 'image/tiff', 'image/webp'
  ]::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.business_verifications (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  verification_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.business_verifications enable row level security;
revoke all on public.business_verifications from anon, authenticated;
grant select on public.business_verifications to authenticated;

drop policy if exists "Owners and developers read business verifications" on public.business_verifications;
create policy "Owners and developers read business verifications"
on public.business_verifications for select to authenticated
using (
  public.is_dev_console_admin()
  or exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  )
);

insert into public.business_verifications (business_id, verification_data)
select
  b.id,
  case when jsonb_typeof(b.verification_data) = 'object' then b.verification_data else '{}'::jsonb end
  || case
    when not (coalesce(b.verification_data, '{}'::jsonb) ? 'files') and cardinality(b.verification_files) > 0
      then jsonb_build_object('files', to_jsonb(b.verification_files))
    else '{}'::jsonb
  end
from public.businesses b
where coalesce(b.verification_data, '{}'::jsonb) <> '{}'::jsonb
   or cardinality(b.verification_files) > 0
on conflict (business_id) do nothing;

update public.businesses b
set verification_data = '{}'::jsonb,
    verification_files = coalesce(array(
      select f
      from unnest(b.verification_files) as f
      where f ~ ('^' || b.id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|bmp|gif|heic|heif|jpg|png|tiff|webp)$')
    ), '{}'::text[]);

drop policy if exists "Business owners manage verification files" on storage.objects;
drop policy if exists "Business owners read verification files" on storage.objects;
create policy "Business owners read verification files"
on storage.objects for select to authenticated
using (
  bucket_id = 'business-verification'
  and (storage.foldername(storage.objects.name))[2] is null
  and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and b.owner_id = auth.uid()
  )
);

drop policy if exists "Business owners upload verification files" on storage.objects;
create policy "Business owners upload verification files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-verification'
  and storage.objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|bmp|gif|heic|heif|jpg|png|tiff|webp)$'
  and (storage.foldername(storage.objects.name))[2] is null
  and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and b.owner_id = auth.uid()
  )
);

drop policy if exists "Business owners delete unreferenced verification drafts" on storage.objects;
create policy "Business owners delete unreferenced verification drafts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'business-verification'
  and (storage.foldername(storage.objects.name))[2] is null
  and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and b.owner_id = auth.uid()
      and not (storage.objects.name = any(coalesce(b.verification_files, '{}'::text[])))
  )
);

drop policy if exists "Developers read business verification files" on storage.objects;
create policy "Developers read business verification files"
on storage.objects for select to authenticated
using (bucket_id = 'business-verification' and public.is_dev_console_admin());

create or replace function public.guard_business_verification_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'service_role')
     and (
       auth.uid() is null
       or current_setting('app.business_verification_write', true) = 'on'
     ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verification_status := 'none';
    new.verification_method := null;
    new.verification_files := '{}'::text[];
    new.verification_data := '{}'::jsonb;
    new.onsite_date := null;
  else
    new.verification_status := old.verification_status;
    new.verification_method := old.verification_method;
    new.verification_files := old.verification_files;
    new.verification_data := old.verification_data;
    new.onsite_date := old.onsite_date;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_business_verification_fields on public.businesses;
create trigger guard_business_verification_fields
before insert or update of verification_status, verification_method, verification_files, verification_data, onsite_date
on public.businesses
for each row execute function public.guard_business_verification_fields();

create or replace function public.submit_business_verification(
  p_business_id uuid,
  p_verification jsonb,
  p_files text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_existing jsonb := '{}'::jsonb;
  v_verification jsonb;
  v_docs jsonb;
  v_file text;
  v_mime text;
  v_size bigint;
  v_expected_ext text;
  v_at timestamptz := timezone('utc', now());
  v_index integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in as the business owner before submitting verification.';
  end if;

  if jsonb_typeof(p_verification) is distinct from 'object' then
    raise exception 'Verification details are missing or invalid.';
  end if;

  select * into v_business
  from public.businesses b
  where b.id = p_business_id and b.owner_id = auth.uid()
  for update;
  if not found then
    raise exception 'The business was not found for this account or is not owned by you.';
  end if;
  if v_business.verification_status not in ('none', 'needs-docs') then
    raise exception 'This verification cannot be submitted in its current status.';
  end if;
  if coalesce(cardinality(p_files), 0) <> 2 or p_files[1] = p_files[2] then
    raise exception 'Upload exactly two different verification documents.';
  end if;

  if coalesce(p_verification ->> 'registrationType', 'dti') not in ('dti', 'sec')
     or (coalesce(p_verification ->> 'registrationType', 'dti') = 'dti'
       and coalesce(p_verification ->> 'registrationNo', p_verification ->> 'dtiNo', '') !~ '^\d{7}$')
     or (coalesce(p_verification ->> 'registrationType', 'dti') = 'sec'
       and coalesce(p_verification ->> 'registrationNo', '') !~ '^[A-Za-z0-9][A-Za-z0-9 ./-]{3,29}$')
     or coalesce(p_verification ->> 'dtiRegistered', '') !~ '^\d{4}-\d{2}-\d{2}$'
     or (
       (coalesce(p_verification ->> 'registrationType', 'dti') = 'dti'
         or nullif(p_verification ->> 'dtiValidUntil', '') is not null)
       and coalesce(p_verification ->> 'dtiValidUntil', '') !~ '^\d{4}-\d{2}-\d{2}$'
     )
     or coalesce(length(trim(p_verification ->> 'permitNo')), 0) not between 4 and 30
     or coalesce(length(trim(p_verification ->> 'permitCity')), 0) = 0
     or coalesce(p_verification ->> 'permitIssued', '') !~ '^\d{4}-\d{2}-\d{2}$'
     or coalesce(p_verification ->> 'permitValidUntil', '') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Enter valid DTI or SEC registration and business permit details.';
  end if;
  if (p_verification ->> 'dtiRegistered')::date > current_date
     or nullif(p_verification ->> 'dtiValidUntil', '')::date < current_date
     or (p_verification ->> 'permitIssued')::date > current_date
     or (p_verification ->> 'permitValidUntil')::date < current_date
     or (p_verification ->> 'permitValidUntil')::date <= (p_verification ->> 'permitIssued')::date then
    raise exception 'The document dates are invalid or expired.';
  end if;

  select v.verification_data into v_existing
  from public.business_verifications v
  where v.business_id = p_business_id
  for update;
  v_existing := coalesce(v_existing, '{}'::jsonb);

  for v_index in 1..2 loop
    v_file := p_files[v_index];
    if v_file !~ ('^' || p_business_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|bmp|gif|heic|heif|jpg|png|tiff|webp)$') then
      raise exception 'Verification document paths must be opaque files for this business.';
    end if;

    select o.metadata ->> 'mimetype', (o.metadata ->> 'size')::bigint
    into v_mime, v_size
    from storage.objects o
    where o.bucket_id = 'business-verification' and o.name = v_file;
    if not found or v_size is null or v_size < 1 or v_size > 10485760 then
      raise exception 'A verification document is missing or exceeds 10 MB.';
    end if;
    v_expected_ext := case v_mime
      when 'application/pdf' then 'pdf'
      when 'image/bmp' then 'bmp'
      when 'image/gif' then 'gif'
      when 'image/heic' then 'heic'
      when 'image/heif' then 'heif'
      when 'image/jpeg' then 'jpg'
      when 'image/png' then 'png'
      when 'image/tiff' then 'tiff'
      when 'image/webp' then 'webp'
      else null
    end;
    if v_expected_ext is null or split_part(v_file, '.', 2) <> v_expected_ext then
      raise exception 'Upload a PDF or supported image for each verification document.';
    end if;

    if v_index = 1 then
      v_docs := jsonb_build_object(
        'dti', jsonb_build_object(
          'name', left(coalesce(p_verification #>> '{docs,dti,name}', 'DTI certificate'), 120),
          'size', v_size,
          'type', v_mime,
          'storagePath', v_file
        )
      );
    else
      v_docs := v_docs || jsonb_build_object(
        'permit', jsonb_build_object(
          'name', left(coalesce(p_verification #>> '{docs,permit,name}', 'Business permit'), 120),
          'size', v_size,
          'type', v_mime,
          'storagePath', v_file
        )
      );
    end if;
  end loop;

  v_verification := (v_existing - 'docs' - 'files' - 'method' - 'status' - 'onsiteDate' - 'onsiteSlot' - 'submittedAt')
    || jsonb_build_object(
      'status', 'pending',
      'method', 'upload',
      'registrationType', coalesce(p_verification ->> 'registrationType', 'dti'),
      'registrationNo', trim(coalesce(p_verification ->> 'registrationNo', p_verification ->> 'dtiNo')),
      'dtiNo', trim(coalesce(p_verification ->> 'registrationNo', p_verification ->> 'dtiNo')),
      'dtiRegistered', p_verification ->> 'dtiRegistered',
      'dtiValidUntil', p_verification ->> 'dtiValidUntil',
      'permitNo', trim(p_verification ->> 'permitNo'),
      'permitCity', trim(p_verification ->> 'permitCity'),
      'permitIssued', p_verification ->> 'permitIssued',
      'permitValidUntil', p_verification ->> 'permitValidUntil',
      'docs', v_docs,
      'files', to_jsonb(p_files),
      'submittedAt', v_at,
      'history', coalesce(v_existing -> 'history', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object('at', v_at, 'status', 'pending', 'by', 'owner'))
    );

  perform set_config('app.business_verification_write', 'on', true);
  update public.businesses
  set verification_status = 'pending',
      verification_method = 'upload',
      verification_files = p_files,
      verification_data = '{}'::jsonb,
      onsite_date = null,
      setup_status = coalesce(setup_status, '{}'::jsonb) || '{"verify":"done"}'::jsonb
  where id = p_business_id;

  insert into public.business_verifications (business_id, verification_data)
  values (p_business_id, v_verification)
  on conflict (business_id) do update
    set verification_data = excluded.verification_data,
        updated_at = timezone('utc', now());

  return v_verification;
end;
$$;

create or replace function public.set_dev_console_business_verification(
  p_business_id uuid,
  p_verification jsonb,
  p_notification jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid;
  v_files text[];
  v_existing jsonb := '{}'::jsonb;
  v_verification jsonb;
  v_status public.business_verification_status;
begin
  if not public.is_dev_console_admin() then
    raise exception 'Developer access required.';
  end if;

  if jsonb_typeof(p_verification) is distinct from 'object' then
    raise exception 'Verification decision is missing or invalid.';
  end if;

  v_status := case p_verification ->> 'status'
    when 'pending' then 'pending'::public.business_verification_status
    when 'verified' then 'verified'::public.business_verification_status
    when 'needs-docs' then 'needs-docs'::public.business_verification_status
    when 'rejected' then 'needs-docs'::public.business_verification_status
    else 'none'::public.business_verification_status
  end;

  select b.owner_id, b.verification_files into v_owner_id, v_files
  from public.businesses b
  where b.id = p_business_id
  for update;
  if not found then
    raise exception 'Business was not found.';
  end if;
  if auth.uid() is null or auth.uid() = v_owner_id then
    raise exception 'A business owner cannot review their own verification.';
  end if;

  select v.verification_data into v_existing
  from public.business_verifications v
  where v.business_id = p_business_id
  for update;
  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_verification := (p_verification - 'docs' - 'files')
    || jsonb_build_object(
      'docs', coalesce(v_existing -> 'docs', '{}'::jsonb),
      'files', to_jsonb(coalesce(v_files, '{}'::text[]))
    );

  perform set_config('app.business_verification_write', 'on', true);
  update public.businesses
  set verification_status = v_status,
      verification_data = '{}'::jsonb
  where id = p_business_id;

  insert into public.business_verifications (business_id, verification_data)
  values (p_business_id, v_verification)
  on conflict (business_id) do update
    set verification_data = excluded.verification_data,
        updated_at = timezone('utc', now());

  if p_notification is not null then
    insert into public.notifications (user_id, kind, title, body, target)
    values (
      v_owner_id,
      'verification',
      'Business verification update',
      concat_ws(E'\n', nullif(p_notification ->> 'en', ''), nullif(p_notification ->> 'tl', '')),
      '/biz/stats/backgrounds#verify'
    );
  end if;
end;
$$;

revoke all on function public.submit_business_verification(uuid, jsonb, text[]) from public, anon;
grant execute on function public.submit_business_verification(uuid, jsonb, text[]) to authenticated;
revoke all on function public.set_dev_console_business_verification(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.set_dev_console_business_verification(uuid, jsonb, jsonb) to authenticated;

-- 20261124110000_business_customer_replies.sql
drop policy if exists "Owners view their post comments" on public.comments;
create policy "Owners view their post comments" on public.comments
for select to authenticated using (exists (
  select 1 from public.posts p
  join public.businesses b on b.id = p.business_id
  where p.id = comments.post_id and b.owner_id = (select auth.uid())
));

create or replace function public.guard_business_customer_replies()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_dev_console_admin() then
    return new;
  end if;

  if tg_table_name = 'comments' then
    if (to_jsonb(new) - array['reply', 'hidden', 'reported_reason', 'blocked'])
      is distinct from (to_jsonb(old) - array['reply', 'hidden', 'reported_reason', 'blocked']) then
      raise insufficient_privilege using message = 'Owners can only reply to or moderate comments.';
    end if;
  elsif tg_op = 'INSERT' then
    if new.reply is not null then
      raise insufficient_privilege using message = 'Only the business owner can write a reply.';
    end if;
  elsif exists (
    select 1 from public.businesses b
    where b.id = old.business_id and b.owner_id = auth.uid()
  ) then
    if (to_jsonb(new) - 'reply') is distinct from (to_jsonb(old) - 'reply') then
      raise insufficient_privilege using message = 'Owners can only change the reply.';
    end if;
  elsif new.reply is distinct from old.reply or new.business_id is distinct from old.business_id then
    raise insufficient_privilege using message = 'Only the business owner can write a reply.';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_guard_business_customer_replies on public.comments;
create trigger comments_guard_business_customer_replies before update on public.comments
for each row execute function public.guard_business_customer_replies();

drop trigger if exists reviews_guard_business_customer_replies on public.reviews;
create trigger reviews_guard_business_customer_replies before insert or update on public.reviews
for each row execute function public.guard_business_customer_replies();
