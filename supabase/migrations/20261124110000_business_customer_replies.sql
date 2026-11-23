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
