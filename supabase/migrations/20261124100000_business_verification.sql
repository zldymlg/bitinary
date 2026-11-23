begin;

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

commit;
