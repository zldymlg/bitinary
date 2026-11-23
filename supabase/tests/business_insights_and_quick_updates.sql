begin;
select plan(28);

select has_table('public', 'business_quick_updates', 'quick updates have a persisted table');
select has_function('public', 'get_business_review_summary', array['uuid'], 'review summary RPC exists');

select set_config('test.owner_one', gen_random_uuid()::text, true);
select set_config('test.owner_two', gen_random_uuid()::text, true);
select set_config('test.business_one', gen_random_uuid()::text, true);
select set_config('test.business_two', gen_random_uuid()::text, true);
select set_config('test.business_draft', gen_random_uuid()::text, true);
select set_config('test.business_unverified', gen_random_uuid()::text, true);
select set_config('test.business_fresh', gen_random_uuid()::text, true);
select set_config('test.business_draft_empty', gen_random_uuid()::text, true);
select set_config('test.business_unverified_empty', gen_random_uuid()::text, true);
select set_config('test.business_other_fresh', gen_random_uuid()::text, true);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  id,
  'authenticated',
  'authenticated',
  id::text || '@analytics-test.local',
  crypt('test-password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Analytics Test Owner","role":"business"}'::jsonb,
  now(),
  now(),
  '', '', '', ''
from (values
  (current_setting('test.owner_one')::uuid),
  (current_setting('test.owner_two')::uuid)
) as owners(id);

insert into public.businesses (id, owner_id, name, live, verification_status)
values
  (current_setting('test.business_one')::uuid, current_setting('test.owner_one')::uuid, 'Analytics One', true, 'verified'),
  (current_setting('test.business_two')::uuid, current_setting('test.owner_two')::uuid, 'Analytics Two', true, 'verified'),
  (current_setting('test.business_draft')::uuid, current_setting('test.owner_one')::uuid, 'Analytics Draft', false, 'verified'),
  (current_setting('test.business_unverified')::uuid, current_setting('test.owner_one')::uuid, 'Analytics Unverified', true, 'pending'),
  (current_setting('test.business_fresh')::uuid, current_setting('test.owner_one')::uuid, 'Analytics Fresh', true, 'verified'),
  (current_setting('test.business_draft_empty')::uuid, current_setting('test.owner_one')::uuid, 'Analytics Draft Empty', false, 'verified'),
  (current_setting('test.business_unverified_empty')::uuid, current_setting('test.owner_one')::uuid, 'Analytics Unverified Empty', true, 'pending'),
  (current_setting('test.business_other_fresh')::uuid, current_setting('test.owner_two')::uuid, 'Analytics Other Fresh', true, 'verified');

insert into public.business_daily_stats (business_id, stat_date, views)
values
  (current_setting('test.business_one')::uuid, current_date, 7),
  (current_setting('test.business_two')::uuid, current_date, 19);

insert into public.reviews (business_id, stars, body, hidden)
values
  (current_setting('test.business_one')::uuid, 4, 'Visible review one', false),
  (current_setting('test.business_one')::uuid, 5, 'Visible review two', false),
  (current_setting('test.business_one')::uuid, 1, 'Hidden review', true);

insert into public.business_quick_updates (business_id, status, special)
values
  (current_setting('test.business_one')::uuid, 'open', 'Lunch is ready'),
  (current_setting('test.business_two')::uuid, 'regular', ''),
  (current_setting('test.business_draft')::uuid, 'closed', 'Not public'),
  (current_setting('test.business_unverified')::uuid, 'closed', 'Not public');

select ok(
  has_table_privilege('authenticated', 'public.business_daily_stats', 'SELECT'),
  'authenticated users can read daily stats through RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.business_daily_stats', 'UPDATE'),
  'authenticated clients cannot update daily stats directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_one'), true);

select is(
  (select count(*)::integer from public.business_daily_stats where business_id = current_setting('test.business_one')::uuid),
  1,
  'an owner can read their daily stats'
);
select is(
  (select count(*)::integer from public.business_daily_stats where business_id = current_setting('test.business_two')::uuid),
  0,
  'an owner cannot read another business daily stats'
);
select throws_ok(
  format('update public.business_daily_stats set views = views + 1 where business_id = %L::uuid', current_setting('test.business_one')),
  '42501',
  null::text,
  'an owner cannot write daily stats directly'
);
select is(
  (select public.track_business_profile_view(current_setting('test.business_two')::uuid)),
  true,
  'an authenticated traveler records the first profile view of the UTC day'
);
select is(
  (select public.track_business_profile_view(current_setting('test.business_two')::uuid)),
  false,
  'a repeated profile view from the same traveler that day is not counted twice'
);

select is(
  (select review_count::integer from public.get_business_review_summary(current_setting('test.business_one')::uuid)),
  2,
  'the review summary counts only visible reviews for the owner'
);
select is(
  (select average_rating::numeric from public.get_business_review_summary(current_setting('test.business_one')::uuid)),
  4.5::numeric,
  'the review summary averages visible review stars in the database'
);
select is(
  (select count(*)::integer from public.get_business_review_summary(current_setting('test.business_two')::uuid)),
  0,
  'the review summary returns no row for another owner'
);

select is(
  (select count(*)::integer from public.business_quick_updates where business_id = current_setting('test.business_one')::uuid),
  1,
  'an owner can read their current quick update'
);
select ok(
  (select expires_at > now()
      and (expires_at at time zone 'Asia/Manila') = date_trunc('day', expires_at at time zone 'Asia/Manila')
   from public.business_quick_updates where business_id = current_setting('test.business_one')::uuid),
  'inserts set expiry to the next Manila midnight'
);
insert into public.business_quick_updates (business_id, status)
values (current_setting('test.business_fresh')::uuid, 'open');
select is(
  (select count(*)::integer from public.business_quick_updates where business_id = current_setting('test.business_fresh')::uuid),
  1,
  'an owner can create their first quick update'
);
update public.business_quick_updates
set status = 'closed', expires_at = '2000-01-01 00:00:00+00'
where business_id = current_setting('test.business_one')::uuid;
select ok(
  (select expires_at > now()
      and (expires_at at time zone 'Asia/Manila') = date_trunc('day', expires_at at time zone 'Asia/Manila')
   from public.business_quick_updates where business_id = current_setting('test.business_one')::uuid),
  'updates refresh expiry to the next Manila midnight'
);
select throws_ok(
  format('insert into public.business_quick_updates (business_id) values (%L::uuid)', current_setting('test.business_one')),
  '23505',
  null::text,
  'each business has at most one current quick update row'
);
select throws_ok(
  format('insert into public.business_quick_updates (business_id, special) values (%L::uuid, repeat(''x'', 161))', current_setting('test.business_one')),
  '23514',
  null::text,
  'special update text is limited to 160 characters'
);
select throws_ok(
  format('insert into public.business_quick_updates (business_id) values (%L::uuid)', current_setting('test.business_draft_empty')),
  '42501',
  null::text,
  'owners cannot write quick updates while their business is not live'
);
select throws_ok(
  format('insert into public.business_quick_updates (business_id) values (%L::uuid)', current_setting('test.business_unverified_empty')),
  '42501',
  null::text,
  'owners cannot write quick updates before verification'
);
select throws_ok(
  format('insert into public.business_quick_updates (business_id) values (%L::uuid)', current_setting('test.business_other_fresh')),
  '42501',
  null::text,
  'an owner cannot write another business quick update'
);
with changed as (
  update public.business_quick_updates set status = 'closed'
  where business_id = current_setting('test.business_two')::uuid returning 1
)
select is(
  (select count(*)::integer from changed),
  0,
  'an owner cannot update another business quick update'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (select count(*)::integer from public.business_quick_updates),
  3,
  'the public sees only live verified quick updates'
);
reset role;
set local session_replication_role = replica;
update public.business_quick_updates
set expires_at = now() - interval '1 second'
where business_id = current_setting('test.business_two')::uuid;
set local session_replication_role = origin;
set local role anon;
select is(
  (select count(*)::integer from public.business_quick_updates),
  2,
  'the public cannot read expired quick updates'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_two'), true);
select is(
  (select review_count::integer from public.get_business_review_summary(current_setting('test.business_two')::uuid)),
  0,
  'an owner with no visible reviews still receives a summary row'
);
select ok(
  (select average_rating is null from public.get_business_review_summary(current_setting('test.business_two')::uuid)),
  'the average rating is null when no visible reviews exist'
);

select set_config('request.jwt.claim.sub', current_setting('test.owner_one'), true);
delete from public.business_quick_updates where business_id = current_setting('test.business_one')::uuid;
select is(
  (select count(*)::integer from public.business_quick_updates where business_id = current_setting('test.business_one')::uuid),
  0,
  'an owner can clear their quick update by deleting its row'
);
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (select count(*)::integer from public.business_quick_updates),
  1,
  'cleared quick updates disappear from public reads'
);

reset role;
select * from finish();
rollback;
