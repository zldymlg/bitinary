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

notify pgrst, 'reload schema';
