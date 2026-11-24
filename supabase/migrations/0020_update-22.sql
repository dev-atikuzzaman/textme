-- ধাপ ৫–৭: নোটিফিকেশন সেটিংস, চ্যাট টুলস (পিন করা মেসেজ, অদৃশ্য হওয়া মেসেজ), রিপোর্ট, লগইন করা ডিভাইস।
-- Supabase > SQL Editor-এ একবার Run করুন। একাধিকবার চালালেও সমস্যা নেই।
-- (এটি না চালালেও অ্যাপ আগের মতো চলবে; নতুন সুবিধাগুলো শুধু চালু হবে না।)

-- ═══ ১) নোটিফিকেশন সেটিংস (ক্যাটেগরি অন/অফ + চুপ থাকার সময়) ═══
create table if not exists public.notification_prefs (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  n_likes boolean not null default true,      -- লাইক
  n_comments boolean not null default true,   -- কমেন্ট ও উত্তর
  n_friends boolean not null default true,    -- ফ্রেন্ড রিকুয়েস্ট, গ্রহণ, পোক
  n_posts boolean not null default true,      -- নতুন পোস্ট (বন্ধু/গ্রুপ/পেজ)
  n_messages boolean not null default true,   -- মেসেজ ও গ্রুপ চ্যাট (কল সবসময় আসে)
  quiet_on boolean not null default false,
  quiet_from smallint not null default 1320,  -- রাত ১০:০০ (মিনিটে)
  quiet_to smallint not null default 420,     -- সকাল ৭:০০ (মিনিটে)
  tz_offset smallint not null default 360,    -- UTC থেকে মিনিটে (বাংলাদেশ = +৩৬০); অ্যাপ নিজে হালনাগাদ করে
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
drop policy if exists "nprefs own" on public.notification_prefs;
create policy "nprefs own" on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══ ২) পিন করা মেসেজ (১-১ চ্যাট, সর্বোচ্চ ৩টি) ═══
alter table public.messages add column if not exists pinned_at timestamptz;
alter table public.messages add column if not exists pinned_by uuid;
create index if not exists messages_pinned_idx on public.messages (sender_id, receiver_id) where pinned_at is not null;

create or replace function public.pin_message(p_msg uuid, p_pin boolean) returns void
language plpgsql security definer set search_path = public as $$
declare m public.messages; n int;
begin
  select * into m from public.messages where id = p_msg;
  if not found or auth.uid() is null or auth.uid() not in (m.sender_id, m.receiver_id) then raise exception 'not allowed'; end if;
  if p_pin then
    select count(*) into n from public.messages
      where pinned_at is not null and id <> p_msg
        and ((sender_id = m.sender_id and receiver_id = m.receiver_id) or (sender_id = m.receiver_id and receiver_id = m.sender_id));
    if n >= 3 then raise exception 'pin_limit'; end if;
    update public.messages set pinned_at = now(), pinned_by = auth.uid() where id = p_msg;
  else
    update public.messages set pinned_at = null, pinned_by = null where id = p_msg;
  end if;
end $$;
grant execute on function public.pin_message(uuid, boolean) to authenticated;

-- গ্রুপ চ্যাটেও পিন (গ্রুপের যেকোনো সদস্য, সর্বোচ্চ ৩টি)
alter table public.group_messages add column if not exists pinned_at timestamptz;
create or replace function public.pin_group_message(p_msg uuid, p_pin boolean) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid; n int;
begin
  select group_id into g from public.group_messages where id = p_msg;
  if g is null or auth.uid() is null or not public.is_group_member(g, auth.uid()) then raise exception 'not allowed'; end if;
  if p_pin then
    select count(*) into n from public.group_messages where group_id = g and pinned_at is not null and id <> p_msg;
    if n >= 3 then raise exception 'pin_limit'; end if;
    update public.group_messages set pinned_at = now() where id = p_msg;
  else
    update public.group_messages set pinned_at = null where id = p_msg;
  end if;
end $$;
grant execute on function public.pin_group_message(uuid, boolean) to authenticated;

-- ═══ ৩) অদৃশ্য হওয়া মেসেজ (১-১ চ্যাট; দুজনের জন্য একই সেটিং; শুধু নতুন মেসেজে প্রযোজ্য) ═══
alter table public.messages add column if not exists expires_at timestamptz;
create index if not exists messages_expires_idx on public.messages (expires_at) where expires_at is not null;

create table if not exists public.chat_ttl (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  ttl_secs int not null default 0 check (ttl_secs >= 0),
  set_by uuid,
  updated_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.chat_ttl enable row level security;
drop policy if exists "chat_ttl read" on public.chat_ttl;
create policy "chat_ttl read" on public.chat_ttl for select to authenticated
  using (auth.uid() in (user_a, user_b));   -- লেখা শুধু নিচের ফাংশন দিয়ে

create or replace function public.set_chat_ttl(p_other uuid, p_secs int) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid; b uuid;
begin
  if auth.uid() is null or p_other is null or p_other = auth.uid() or p_secs < 0 then raise exception 'not allowed'; end if;
  if not public.are_friends(auth.uid(), p_other) then raise exception 'not allowed'; end if;
  a := least(auth.uid(), p_other); b := greatest(auth.uid(), p_other);
  insert into public.chat_ttl (user_a, user_b, ttl_secs, set_by) values (a, b, p_secs, auth.uid())
  on conflict (user_a, user_b) do update set ttl_secs = excluded.ttl_secs, set_by = excluded.set_by, updated_at = now();
end $$;
grant execute on function public.set_chat_ttl(uuid, int) to authenticated;

-- নতুন মেসেজ ঢোকার সময় মেয়াদ বসানো (কল-লগ বাদে)
create or replace function public.set_msg_expiry() returns trigger
language plpgsql security definer set search_path = public as $$
declare t int;
begin
  if new.type = 'call' then return new; end if;
  select ttl_secs into t from public.chat_ttl
    where user_a = least(new.sender_id, new.receiver_id) and user_b = greatest(new.sender_id, new.receiver_id);
  if coalesce(t, 0) > 0 then new.expires_at := now() + make_interval(secs => t); end if;
  return new;
end $$;
drop trigger if exists trg_msg_expiry on public.messages;
create trigger trg_msg_expiry before insert on public.messages for each row execute function public.set_msg_expiry();

-- মেয়াদ শেষ মেসেজ মুছে ফেলা। অ্যাপ খুললেই এটি চলে; pg_cron থাকলে প্রতি ১০ মিনিটে নিজে নিজেও চলবে
create or replace function public.purge_expired_messages() returns void
language sql security definer set search_path = public as $$
  delete from public.messages where expires_at is not null and expires_at < now()
$$;
grant execute on function public.purge_expired_messages() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin perform cron.unschedule('apon-purge-messages'); exception when others then null; end;
    perform cron.schedule('apon-purge-messages', '*/10 * * * *', 'select public.purge_expired_messages()');
  end if;
exception when others then
  raise notice 'pg_cron সেট করা যায়নি (ঐচ্ছিক, অ্যাপ খুললেই পরিষ্কার হয়): %', sqlerrm;
end $$;

-- ═══ ৪) রিপোর্ট (ব্যবহারকারী/পোস্ট) — আপনি Table Editor > reports-এ দেখতে পাবেন ═══
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user','post','comment','message','group')),
  target_id uuid not null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  note text,
  status text not null default 'open',   -- open | reviewed | dismissed
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
alter table public.reports enable row level security;
drop policy if exists "reports insert" on public.reports;
drop policy if exists "reports read own" on public.reports;
create policy "reports insert" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reports read own" on public.reports for select to authenticated using (reporter_id = auth.uid());

-- ═══ ৫) লগইন করা ডিভাইসের তালিকা ═══
create table if not exists public.login_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  device_id text not null,
  label text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);
alter table public.login_devices enable row level security;
drop policy if exists "devices own" on public.login_devices;
create policy "devices own" on public.login_devices for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
