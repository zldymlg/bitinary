begin;
select plan(15);

insert into auth.users (id) values
  ('b1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002'),
  ('b1000000-0000-4000-8000-000000000003');
insert into public.dev_console_admins (email) values ('reviewer@verification.test');
insert into public.businesses (id, owner_id, name, live)
values ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Verification fixture', true);
insert into storage.objects (bucket_id, name, metadata) values
  ('business-verification', 'b2000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001.pdf', '{"mimetype":"application/pdf","size":10}'),
  ('business-verification', 'b2000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000002.png', '{"mimetype":"image/png","size":10}');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select is((select count(*) from storage.objects where bucket_id = 'business-verification'), 2::bigint, 'owner can read their uploads');
select is((
  public.submit_business_verification(
    'b2000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'registrationType', 'dti', 'registrationNo', '1234567', 'dtiNo', '1234567',
      'dtiRegistered', current_date - 30, 'dtiValidUntil', current_date + 365,
      'permitNo', 'PERMIT-001', 'permitCity', 'Manila',
      'permitIssued', current_date - 30, 'permitValidUntil', current_date + 365
    ),
    array[
      'b2000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001.pdf',
      'b2000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000002.png'
    ]
  ) ->> 'status'
), 'pending', 'valid owner upload is submitted for review');
select is((select verification_data ->> 'permitNo' from public.business_verifications where business_id = 'b2000000-0000-4000-8000-000000000001'), 'PERMIT-001', 'permit details persist privately');

insert into storage.objects (bucket_id, name)
values ('business-verification', 'b2000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000003.pdf');
select is((select count(*) from storage.objects where bucket_id = 'business-verification'), 3::bigint, 'owner can upload another draft');
update public.businesses set verification_status = 'verified' where id = 'b2000000-0000-4000-8000-000000000001';
select is((select verification_status::text from public.businesses where id = 'b2000000-0000-4000-8000-000000000001'), 'pending', 'owner cannot approve their own business');
-- The Storage API enables this setting for its delete statements.
select set_config('storage.allow_delete_query', 'true', true);
with deleted as (
  delete from storage.objects where bucket_id = 'business-verification' returning name
)
select is((select count(*) from deleted where name like '%000000000003.pdf'), 1::bigint, 'owner can remove an unused draft');
select is((select count(*) from storage.objects where bucket_id = 'business-verification'), 2::bigint, 'owner cannot delete documents under review');
select throws_ok(
  $$select public.set_dev_console_business_verification('b2000000-0000-4000-8000-000000000001', '{"status":"verified"}')$$,
  'P0001', null, 'reviewer decision RPC rejects ordinary owners'
);

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
select is((select count(*) from storage.objects where bucket_id = 'business-verification'), 0::bigint, 'another owner cannot see the files');
select is((select count(*) from public.business_verifications where business_id = 'b2000000-0000-4000-8000-000000000001'), 0::bigint, 'another owner cannot see private permit details');

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000003","email":"reviewer@verification.test"}', true);
select is((select count(*) from storage.objects where bucket_id = 'business-verification'), 2::bigint, 'authorized reviewer can read the documents');
select public.set_dev_console_business_verification(
  'b2000000-0000-4000-8000-000000000001',
  '{"status":"verified","permitNo":"PERMIT-001","note":"Reviewed documents"}'
);
select is((select verification_status::text from public.businesses where id = 'b2000000-0000-4000-8000-000000000001'), 'verified', 'reviewer decision publishes the verified status');
select is((select verification_data ->> 'note' from public.business_verifications where business_id = 'b2000000-0000-4000-8000-000000000001'), 'Reviewed documents', 'reviewer note persists privately');

select public.set_dev_console_business_verification(
  'b2000000-0000-4000-8000-000000000001', '{"status":"needs-docs"}'
);
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{}', true);
select is((
  public.submit_business_verification(
    'b2000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'registrationType', 'sec', 'registrationNo', 'SEC-001',
      'dtiRegistered', current_date - 30,
      'permitNo', 'PERMIT-001', 'permitCity', 'Manila',
      'permitIssued', current_date - 30, 'permitValidUntil', current_date + 365
    ),
    array[
      'b2000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001.pdf',
      'b2000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000002.png'
    ]
  ) ->> 'status'
), 'pending', 'an owner can submit SEC registration without an expiry date');

reset role;
set local role anon;
select is((select verification_data from public.businesses where id = 'b2000000-0000-4000-8000-000000000001'), '{}'::jsonb, 'public business row contains no verification metadata');
reset role;
select * from finish();
rollback;
