-- গ্রুপ (পোস্ট + গ্রুপ চ্যাট), পেজ, নোট ও নতুন পোস্টের নোটিফিকেশনের জন্য।
-- update-13.sql-এর পর SQL Editor-এ পুরোটা Run করুন। একাধিকবার চালালেও সমস্যা নেই।
-- ⚠️ এই ফাইল আপনার আগের push_on_insert() (URL/সিক্রেটসহ) বদলায় না — সেটাই কাজে লাগায়।

------------------------------------------------------------------
-- ১) গ্রুপ
------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  about text,
  avatar_url text,
  privacy text not null default 'private' check (privacy in ('public','private')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text check (media_type is null or media_type = 'image'),
  created_at timestamptz not null default now(),
  constraint group_messages_has_body check (content is not null or media_url is not null)
);
create index if not exists group_messages_idx on public.group_messages (group_id, created_at desc);

-- RLS-এর ভেতরে নিজের টেবিল সিলেক্ট করলে "infinite recursion" হয়, তাই চেকগুলো SECURITY DEFINER ফাংশনে
create or replace function public.is_group_member(gid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = uid)
$$;
create or replace function public.is_group_admin(gid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = uid and role = 'admin')
$$;
create or replace function public.can_see_group(gid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups g where g.id = gid and (g.privacy = 'public' or g.created_by = uid))
      or exists (select 1 from group_members where group_id = gid and user_id = uid)
$$;
grant execute on function public.is_group_member(uuid, uuid), public.is_group_admin(uuid, uuid), public.can_see_group(uuid, uuid) to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

drop policy if exists "groups read" on public.groups;
drop policy if exists "groups update" on public.groups;
drop policy if exists "groups delete" on public.groups;
create policy "groups read" on public.groups for select to authenticated using (public.can_see_group(id, auth.uid()));
create policy "groups update" on public.groups for update to authenticated
  using (public.is_group_admin(id, auth.uid())) with check (public.is_group_admin(id, auth.uid()));
create policy "groups delete" on public.groups for delete to authenticated using (created_by = auth.uid());

drop policy if exists "gmembers read" on public.group_members;
create policy "gmembers read" on public.group_members for select to authenticated using (public.can_see_group(group_id, auth.uid()));

drop policy if exists "gmsg read" on public.group_messages;
drop policy if exists "gmsg insert" on public.group_messages;
drop policy if exists "gmsg delete" on public.group_messages;
create policy "gmsg read" on public.group_messages for select to authenticated using (public.is_group_member(group_id, auth.uid()));
create policy "gmsg insert" on public.group_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_group_member(group_id, auth.uid()));
create policy "gmsg delete" on public.group_messages for delete to authenticated
  using (sender_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));

-- সদস্য যোগ/বাদ/ছাড়া সবই ফাংশন দিয়ে (সরাসরি টেবিলে লেখার অনুমতি নেই)
create or replace function public.create_group(p_name text, p_about text, p_privacy text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid; m uuid;
begin
  if auth.uid() is null then raise exception 'not allowed'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'গ্রুপের নাম দিন'; end if;
  insert into groups (name, about, privacy, created_by)
  values (trim(p_name), nullif(trim(coalesce(p_about, '')), ''), case when p_privacy = 'public' then 'public' else 'private' end, auth.uid())
  returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'admin');
  foreach m in array coalesce(p_members, '{}'::uuid[]) loop
    if m <> auth.uid() and are_friends(auth.uid(), m) then
      insert into group_members (group_id, user_id) values (gid, m) on conflict do nothing;
      insert into notifications (user_id, actor_id, type, link) values (m, auth.uid(), 'group_add', '/groups/' || gid);
    end if;
  end loop;
  return gid;
end $$;

create or replace function public.join_group(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from groups where id = p_group and privacy = 'public') then raise exception 'not allowed'; end if;
  insert into group_members (group_id, user_id) values (p_group, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  delete from group_members where group_id = p_group and user_id = auth.uid();
  select count(*) into cnt from group_members where group_id = p_group;
  if cnt = 0 then delete from groups where id = p_group; return; end if;
  if not exists (select 1 from group_members where group_id = p_group and role = 'admin') then
    update group_members set role = 'admin'
    where (group_id, user_id) in (select group_id, user_id from group_members where group_id = p_group order by joined_at limit 1);
  end if;
end $$;

create or replace function public.add_group_members(p_group uuid, p_members uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare m uuid;
begin
  if not is_group_admin(p_group, auth.uid()) then raise exception 'not allowed'; end if;
  foreach m in array coalesce(p_members, '{}'::uuid[]) loop
    if are_friends(auth.uid(), m) and not is_group_member(p_group, m) then
      insert into group_members (group_id, user_id) values (p_group, m) on conflict do nothing;
      insert into notifications (user_id, actor_id, type, link) values (m, auth.uid(), 'group_add', '/groups/' || p_group);
    end if;
  end loop;
end $$;

create or replace function public.remove_group_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_admin(p_group, auth.uid()) or p_user = auth.uid() then raise exception 'not allowed'; end if;
  delete from group_members where group_id = p_group and user_id = p_user;
end $$;

create or replace function public.set_group_admin(p_group uuid, p_user uuid, p_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_admin(p_group, auth.uid()) then raise exception 'not allowed'; end if;
  update group_members set role = case when p_admin then 'admin' else 'member' end where group_id = p_group and user_id = p_user;
end $$;

create or replace function public.mark_group_read(p_group uuid) returns void
language sql security definer set search_path = public as $$
  update group_members set last_read_at = now() where group_id = p_group and user_id = auth.uid()
$$;

revoke execute on function public.create_group(text, text, text, uuid[]), public.join_group(uuid), public.leave_group(uuid),
  public.add_group_members(uuid, uuid[]), public.remove_group_member(uuid, uuid), public.set_group_admin(uuid, uuid, boolean),
  public.mark_group_read(uuid) from public, anon;
grant execute on function public.create_group(text, text, text, uuid[]), public.join_group(uuid), public.leave_group(uuid),
  public.add_group_members(uuid, uuid[]), public.remove_group_member(uuid, uuid), public.set_group_admin(uuid, uuid, boolean),
  public.mark_group_read(uuid) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_messages') then
    alter publication supabase_realtime add table public.group_messages;
  end if;
end $$;

------------------------------------------------------------------
-- ২) পেজ (সবার জন্য খোলা, ফলো করা যায়)
------------------------------------------------------------------
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text,
  about text,
  avatar_url text,
  cover_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.page_follows (
  page_id uuid not null references public.pages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (page_id, user_id)
);
alter table public.pages enable row level security;
alter table public.page_follows enable row level security;
drop policy if exists "pages read" on public.pages;
drop policy if exists "pages insert" on public.pages;
drop policy if exists "pages update" on public.pages;
drop policy if exists "pages delete" on public.pages;
create policy "pages read" on public.pages for select to authenticated using (true);
create policy "pages insert" on public.pages for insert to authenticated with check (owner_id = auth.uid());
create policy "pages update" on public.pages for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "pages delete" on public.pages for delete to authenticated using (owner_id = auth.uid());
drop policy if exists "pfollow read" on public.page_follows;
drop policy if exists "pfollow insert" on public.page_follows;
drop policy if exists "pfollow delete" on public.page_follows;
create policy "pfollow read" on public.page_follows for select to authenticated using (true);
create policy "pfollow insert" on public.page_follows for insert to authenticated with check (user_id = auth.uid());
create policy "pfollow delete" on public.page_follows for delete to authenticated using (user_id = auth.uid());

------------------------------------------------------------------
-- ৩) পোস্ট: গ্রুপ/পেজের পোস্ট (নোট আলাদা টেবিল ছাড়াই category = 'note')
------------------------------------------------------------------
alter table public.posts add column if not exists group_id uuid references public.groups(id) on delete cascade;
alter table public.posts add column if not exists page_id uuid references public.pages(id) on delete cascade;
create index if not exists posts_group_idx on public.posts (group_id, created_at desc) where group_id is not null;
create index if not exists posts_page_idx on public.posts (page_id, created_at desc) where page_id is not null;

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (
  case when group_id is not null then public.is_group_member(group_id, auth.uid())
       else (user_id = auth.uid() or privacy = 'public'
             or (privacy = 'friends' and public.are_friends(auth.uid(), user_id))) end
);
drop policy if exists "posts insert" on public.posts;
create policy "posts insert" on public.posts for insert to authenticated with check (
  user_id = auth.uid()
  and (group_id is null or public.is_group_member(group_id, auth.uid()))
  and (page_id is null or exists (select 1 from public.pages pg where pg.id = page_id and pg.owner_id = auth.uid()))
);
-- গ্রুপ অ্যাডমিন অন্যের পোস্টও মুছতে পারবে
drop policy if exists "posts delete group admin" on public.posts;
create policy "posts delete group admin" on public.posts for delete to authenticated
  using (group_id is not null and public.is_group_admin(group_id, auth.uid()));

------------------------------------------------------------------
-- ৪) নোটিফিকেশন: নতুন ধরন + লিংক কলাম, আর নতুন পোস্টে বন্ধু/সদস্য/ফলোয়ারদের নোটিফিকেশন
--    (notifications টেবিলে insert হলেই আপনার আগের ট্রিগার দিয়ে পুশও চলে যায়)
------------------------------------------------------------------
alter table public.notifications add column if not exists link text;
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
  check (type in ('like','comment','reply','friend_request','friend_accept','post','group_post','page_post','group_add'));

create or replace function public.notify_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'post' then return new; end if;
  if new.group_id is not null then
    insert into notifications (user_id, actor_id, type, post_id, link)
      select user_id, new.user_id, 'group_post', new.id, '/post/' || new.id
      from group_members where group_id = new.group_id and user_id <> new.user_id;
  elsif new.page_id is not null then
    insert into notifications (user_id, actor_id, type, post_id, link)
      select user_id, new.user_id, 'page_post', new.id, '/post/' || new.id
      from page_follows where page_id = new.page_id and user_id <> new.user_id;
  elsif new.privacy in ('friends', 'public') then
    insert into notifications (user_id, actor_id, type, post_id, link)
      select case when requester_id = new.user_id then addressee_id else requester_id end,
             new.user_id, 'post', new.id, '/post/' || new.id
      from friendships where status = 'accepted' and new.user_id in (requester_id, addressee_id);
  end if;
  return new;
exception when others then
  return new; -- নোটিফিকেশন ব্যর্থ হলেও পোস্ট সেভ হবে
end $$;
drop trigger if exists trg_notify_post on public.posts;
create trigger trg_notify_post after insert on public.posts for each row execute function public.notify_post();

-- গ্রুপ মেসেজের পুশ: আপনার আগের push_on_insert() ফাংশনটাই ডাকে (থাকলে)
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'push_on_insert') then
    drop trigger if exists trg_push_group_messages on public.group_messages;
    create trigger trg_push_group_messages after insert on public.group_messages
      for each row execute function public.push_on_insert();
  end if;
end $$;
