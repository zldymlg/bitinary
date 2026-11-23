begin;
select plan(4);

insert into auth.users (id) values
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002');
insert into public.businesses (id, owner_id, name, live, verification_status)
values ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Test business', true, 'verified');
insert into public.posts (id, business_id, post_type, status, body)
values ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'post', 'published', 'Post');
insert into public.comments (id, post_id, author_id, body, hidden)
values ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'Customer comment', true);
insert into public.reviews (id, business_id, author_id, stars, body)
values ('a5000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 4, 'Customer review');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.comments where id = 'a4000000-0000-4000-8000-000000000001'), 1::bigint, 'owner can load their hidden comment');
update public.comments set hidden = false, reply = 'Thanks' where id = 'a4000000-0000-4000-8000-000000000001';
select is((select reply from public.comments where id = 'a4000000-0000-4000-8000-000000000001' and not hidden), 'Thanks', 'owner can unhide and reply');
update public.reviews set reply = 'Thanks' where id = 'a5000000-0000-4000-8000-000000000001';
select is((select reply from public.reviews where id = 'a5000000-0000-4000-8000-000000000001'), 'Thanks', 'owner can reply to a review');
select throws_ok($$update public.reviews set stars = 5 where id = 'a5000000-0000-4000-8000-000000000001'$$, '42501', 'Owners can only change the reply.', 'owner review write is limited to its reply');

select * from finish();
rollback;
