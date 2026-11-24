-- কমেন্টে উত্তর (থ্রেড) ও উত্তরের নোটিফিকেশনের জন্য। update-9.sql-এর পর Run করুন।
-- একাধিকবার চালালেও সমস্যা নেই।

-- ১) উত্তরের কলাম: parent_id = যে মূল কমেন্টের নিচে উত্তর, reply_to = যাকে উত্তর দেওয়া হচ্ছে
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
alter table public.comments add column if not exists reply_to uuid references public.profiles(id) on delete set null;
create index if not exists comments_parent_idx on public.comments (parent_id);

-- ২) উত্তর শুধু একই পোস্টের মূল কমেন্টের নিচে দেওয়া যাবে (এক স্তরের থ্রেড)
drop policy if exists "comments insert" on public.comments;
create policy "comments insert" on public.comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id)
    and (parent_id is null or exists (
      select 1 from public.comments c
      where c.id = parent_id and c.post_id = comments.post_id and c.parent_id is null))
  );

-- ৩) নোটিফিকেশনের নতুন ধরন 'reply'
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.notifications'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%friend_accept%'
  loop
    execute format('alter table public.notifications drop constraint %I', c);
  end loop;
end $$;
alter table public.notifications add constraint notifications_type_check
  check (type in ('like', 'comment', 'reply', 'friend_request', 'friend_accept'));

-- ৪) উত্তর দিলে যাকে উত্তর দেওয়া হয়েছে সে 'reply' নোটিফিকেশন পাবে, পোস্টের মালিক পাবে 'comment'
create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from posts where id = new.post_id;
  if new.reply_to is not null and new.reply_to <> new.user_id then
    insert into notifications (user_id, actor_id, type, post_id) values (new.reply_to, new.user_id, 'reply', new.post_id);
  end if;
  if owner is not null and owner <> new.user_id and owner is distinct from new.reply_to then
    insert into notifications (user_id, actor_id, type, post_id) values (owner, new.user_id, 'comment', new.post_id);
  end if;
  return new;
end $$;
