alter table public.itineraries
  add column if not exists source_key text;

create unique index if not exists itineraries_user_source_key_idx
  on public.itineraries (user_id, source_key)
  where source_key is not null;

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

notify pgrst, 'reload schema';
