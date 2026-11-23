alter table public.moments
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

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

alter table public.moment_collaborators enable row level security;
alter table public.moment_photos enable row level security;

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

create or replace function public.search_moment_travelers(p_query text)
returns table (id uuid, name text, nickname text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.nickname, p.avatar_url
  from public.profiles p
  where auth.uid() is not null
    and p.role = 'traveler'
    and p.id <> auth.uid()
    and length(trim(coalesce(p_query, ''))) >= 2
    and (
      p.nickname ilike '%' || trim(p_query) || '%'
      or p.name ilike '%' || trim(p_query) || '%'
    )
  order by p.nickname, p.name
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

drop policy if exists "Users manage moments" on public.moments;
create policy "Authors manage moments" on public.moments
for all to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());
create policy "Collaborators view moments" on public.moments
for select to authenticated
using (public.can_access_moment(id));
create policy "Collaborators update moment details" on public.moments
for update to authenticated
using (author_id <> auth.uid() and public.can_access_moment(id))
with check (author_id <> auth.uid() and public.can_access_moment(id));

create policy "Moment participants view collaborators" on public.moment_collaborators
for select to authenticated
using (public.can_access_moment(moment_id));
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
for select to authenticated
using (public.can_access_moment(moment_id));
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

drop policy if exists "Users view their own images" on storage.objects;
create policy "Users view own and shared Moment images" on storage.objects
for select to authenticated
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

drop policy if exists "Moment authors delete shared images" on storage.objects;
create policy "Moment authors delete shared images" on storage.objects
for delete to authenticated
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
