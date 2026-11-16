-- আপডেট ১৬: ইউনিক ইউজারনেম, ইমেইল/ফোন, সার্চ, ব্লক, পোক, ডিঅ্যাক্টিভেট/ডিলিট
-- Supabase > SQL Editor-এ পুরোটা একবার Run করুন (বারবার চালালেও সমস্যা নেই)

-- ১) প্রোফাইলে ডিঅ্যাক্টিভেট ঘর + ব্যক্তিগত যোগাযোগ টেবিল
-- ইমেইল/ফোন profiles-এ রাখা হয়নি, কারণ profiles সবাই পড়তে পারে। user_contacts শুধু নিজে পড়তে পারে;
-- অন্যরা কেবল search_people() দিয়ে হুবহু মিলিয়ে খুঁজতে পারে, ইমেইল/ফোন কখনো দেখতে পায় না।
alter table public.profiles add column if not exists deactivated_at timestamptz;

create table if not exists public.user_contacts (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  phone text,                      -- শুধু অঙ্ক (যেমন 8801712345678)
  contact_email text,              -- যাচাই করা লগ-ইন ইমেইল (sync_my_email দিয়ে আসে)
  discoverable boolean not null default true  -- ইমেইল/ফোন দিয়ে খোঁজা যাবে?
);
alter table public.user_contacts enable row level security;
drop policy if exists "contacts own" on public.user_contacts;
create policy "contacts own" on public.user_contacts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
do $$ begin
  create unique index if not exists user_contacts_phone_idx on public.user_contacts (phone) where phone is not null;
exception when others then raise notice 'ফোন ইউনিক ইনডেক্স বানানো যায়নি: %', sqlerrm; end $$;

do $$ begin
  create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
exception when others then
  raise notice 'ইউজারনেম ইউনিক ইনডেক্স বানানো যায়নি (একই নামের ডুপ্লিকেট আছে?): %', sqlerrm;
end $$;

-- ২) ইউজারনেম পাওয়া যাবে কিনা
create or replace function public.username_available(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select u ~ '^[A-Za-z0-9_.]{3,20}$'
     and not exists (select 1 from profiles where lower(username) = lower(u) and id <> auth.uid())
$$;
grant execute on function public.username_available(text) to authenticated;

-- ৩) যাচাই করা লগ-ইন ইমেইল সিঙ্ক (ইমেইল দিয়ে খোঁজার জন্য; অ্যাপ খুললে নিজে থেকে চলে)
create or replace function public.sync_my_email() returns void
language sql security definer set search_path = public, auth as $$
  insert into public.user_contacts (user_id, contact_email)
  select u.id, lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null
  on conflict (user_id) do update set contact_email = excluded.contact_email
$$;
grant execute on function public.sync_my_email() to authenticated;

-- ৪) ব্লক
create table if not exists public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists "blocks own" on public.blocks;
create policy "blocks own" on public.blocks for select to authenticated using (blocker_id = auth.uid());

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user = auth.uid() then raise exception 'নিজেকে ব্লক করা যায় না'; end if;
  insert into blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  delete from friendships where (requester_id = auth.uid() and addressee_id = p_user) or (requester_id = p_user and addressee_id = auth.uid());
end $$;
create or replace function public.unblock_user(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = p_user
$$;
grant execute on function public.block_user(uuid), public.unblock_user(uuid) to authenticated;

-- ব্লক থাকলে ফ্রেন্ড রিকুয়েস্ট ও মেসেজ যাবে না (আগের পলিসির সাথে যোগ হয়)
drop policy if exists "no friend req when blocked" on public.friendships;
create policy "no friend req when blocked" on public.friendships as restrictive for insert to authenticated
  with check (not public.is_blocked_between(requester_id, addressee_id));
drop policy if exists "no msg when blocked" on public.messages;
create policy "no msg when blocked" on public.messages as restrictive for insert to authenticated
  with check (not public.is_blocked_between(sender_id, receiver_id));
-- ব্লক করা/ডিঅ্যাক্টিভ ব্যবহারকারীর পোস্ট দেখা যাবে না
drop policy if exists "posts hide blocked or deactivated" on public.posts;
create policy "posts hide blocked or deactivated" on public.posts as restrictive for select to authenticated
  using (user_id = auth.uid() or (
    not public.is_blocked_between(auth.uid(), user_id)
    and not exists (select 1 from public.profiles p where p.id = user_id and p.deactivated_at is not null)));

-- ৫) পোক
create table if not exists public.pokes (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists pokes_pair_idx on public.pokes (from_id, to_id, created_at desc);
alter table public.pokes enable row level security;
drop policy if exists "pokes read own" on public.pokes;
create policy "pokes read own" on public.pokes for select to authenticated using (auth.uid() in (from_id, to_id));

do $$ declare c text; begin
  for c in select conname from pg_constraint
           where conrelid = 'public.notifications'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%friend_accept%'
  loop execute format('alter table public.notifications drop constraint %I', c); end loop;
end $$;
alter table public.notifications add constraint notifications_type_check
  check (type in ('like','comment','reply','friend_request','friend_accept','post','group_post','page_post','group_add','poke'));

create or replace function public.poke_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user = auth.uid() then raise exception 'নিজেকে পোক করা যায় না'; end if;
  if public.is_blocked_between(auth.uid(), p_user) then raise exception 'পোক করা যাচ্ছে না'; end if;
  if exists (select 1 from pokes where from_id = auth.uid() and to_id = p_user and created_at > now() - interval '1 hour') then
    raise exception 'আপনি একটু আগেই পোক করেছেন, পরে আবার চেষ্টা করুন';
  end if;
  insert into pokes (from_id, to_id) values (auth.uid(), p_user);
  insert into notifications (user_id, actor_id, type, link) values (p_user, auth.uid(), 'poke', '/profile/' || auth.uid());
end $$;
grant execute on function public.poke_user(uuid) to authenticated;

-- ৬) মানুষ খোঁজা: নাম/ইউজারনেম (আংশিক) + ইমেইল/ফোন (হুবহু মিললে, এবং যিনি "খোঁজা যাবে" রেখেছেন)
create or replace function public.search_people(q text) returns table (id uuid, username text, full_name text, avatar_url text, matched text)
language plpgsql stable security definer set search_path = public as $$
declare t text := lower(trim(q)); digits text := regexp_replace(coalesce(q, ''), '[^0-9]', '', 'g'); pat text;
begin
  if t is null or length(t) < 2 then return; end if;
  pat := '%' || replace(replace(replace(t, '\', ''), '%', ''), '_', '\_') || '%';
  return query
  select p.id, p.username, p.full_name, p.avatar_url,
    case when c.contact_email = t and c.discoverable then 'email'
         when c.phone is not null and c.discoverable and length(digits) >= 10 and right(c.phone, 10) = right(digits, 10) then 'phone'
         else 'name' end
  from profiles p left join user_contacts c on c.user_id = p.id
  where p.id <> auth.uid() and p.deactivated_at is null
    and not public.is_blocked_between(auth.uid(), p.id)
    and (
      p.username ilike pat or p.full_name ilike pat
      or (c.discoverable and t like '%@%.%' and c.contact_email = t)
      or (c.discoverable and length(digits) >= 10 and c.phone is not null and right(c.phone, 10) = right(digits, 10))
    )
  order by (c.contact_email = t) desc, p.full_name
  limit 15;
end $$;
grant execute on function public.search_people(text) to authenticated;

-- ৭) ডিঅ্যাক্টিভেট / রি-অ্যাক্টিভেট / স্থায়ী ডিলিট
create or replace function public.deactivate_my_account() returns void
language sql security definer set search_path = public as $$
  update profiles set deactivated_at = now() where id = auth.uid()
$$;
create or replace function public.reactivate_my_account() returns void
language sql security definer set search_path = public as $$
  update profiles set deactivated_at = null where id = auth.uid()
$$;
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'লগ-ইন নেই'; end if;
  delete from auth.users where id = auth.uid();   -- প্রোফাইল, পোস্ট, মেসেজ ইত্যাদি cascade-এ মুছে যায়
end $$;
grant execute on function public.deactivate_my_account(), public.reactivate_my_account(), public.delete_my_account() to authenticated;
