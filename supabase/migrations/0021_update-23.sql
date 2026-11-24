-- ফ্যামিলি ফিচার: আমন্ত্রণ লিংক/QR, সম্পর্কের ট্যাগ, জন্মদিন ও অনুষ্ঠান, শেয়ার্ড ফ্যামিলি অ্যালবাম।
-- Supabase > SQL Editor-এ একবার Run করুন। একাধিকবার চালালেও সমস্যা নেই।
-- (update-13 ও update-22 আগে চালানো থাকতে হবে। না চালালেও অ্যাপ আগের মতো চলবে; নতুন সুবিধাগুলো শুধু চালু হবে না।)

-- ═══ ০) নতুন নোটিফিকেশন ধরন ═══
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('like','comment','reply','friend_request','friend_accept','post','group_post','page_post','group_add','poke','group_call',
                  'invite_joined','birthday','event_new','event_reminder','album_add'));
do $$ begin  -- notification_prefs (update-22) থাকলে "পরিবার" ক্যাটেগরি যোগ হয়; না থাকলে বাদ যায়
  if to_regclass('public.notification_prefs') is not null then
    alter table public.notification_prefs add column if not exists n_family boolean not null default true;
  end if;
end $$;

-- সরাসরি accepted বন্ধুত্ব (আমন্ত্রণ লিংক) তৈরি হলে "ফ্রেন্ড রিকুয়েস্ট" নোটিফিকেশন যাবে না
create or replace function public.notify_friend() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      insert into notifications (user_id, actor_id, type) values (new.addressee_id, new.requester_id, 'friend_request');
    end if;
  elsif old.status = 'pending' and new.status = 'accepted' then
    insert into notifications (user_id, actor_id, type) values (new.requester_id, new.addressee_id, 'friend_accept');
  end if;
  return new;
end $$;

-- ═══ ১) আমন্ত্রণ লিংক / QR ═══
create table if not exists public.invites (
  code text primary key,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  uses int not null default 0,
  max_uses int not null default 25,
  expires_at timestamptz not null default now() + interval '30 days',
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.invites enable row level security;
drop policy if exists "invites own" on public.invites;
create policy "invites own" on public.invites for select to authenticated using (created_by = auth.uid()); -- লেখা শুধু ফাংশন দিয়ে

-- আমার চালু আমন্ত্রণ কোড (না থাকলে নতুন বানায়); p_new = true হলে পুরনোটা বাতিল করে নতুন
create or replace function public.create_invite(p_new boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if auth.uid() is null then raise exception 'not allowed'; end if;
  if p_new then update public.invites set revoked = true where created_by = auth.uid() and not revoked; end if;
  select code into c from public.invites
    where created_by = auth.uid() and not revoked and expires_at > now() and uses < max_uses
    order by created_at desc limit 1;
  if c is null then
    c := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    insert into public.invites (code, created_by) values (c, auth.uid());
  end if;
  return c;
end $$;
grant execute on function public.create_invite(boolean) to authenticated;

-- লিংক খুললে "কে আমন্ত্রণ জানিয়েছেন" দেখানো (লগ-ইনের আগেও কাজ করে)
create or replace function public.peek_invite(p_code text)
returns table (inviter_id uuid, full_name text, avatar_url text, valid boolean)
language sql stable security definer set search_path = public as $$
  select i.created_by, p.full_name, p.avatar_url, (not i.revoked and i.expires_at > now() and i.uses < i.max_uses)
  from public.invites i join public.profiles p on p.id = i.created_by
  where i.code = p_code limit 1
$$;
grant execute on function public.peek_invite(text) to anon, authenticated;

-- আমন্ত্রণ গ্রহণ: সরাসরি বন্ধু হয়ে যায় (ব্লক থাকলে নয়)। ফেরত দেয় আমন্ত্রণকারীর id
create or replace function public.accept_invite(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i public.invites; me uuid := auth.uid();
begin
  if me is null then raise exception 'not allowed'; end if;
  select * into i from public.invites where code = p_code for update;
  if not found or i.revoked or i.expires_at <= now() or i.uses >= i.max_uses then raise exception 'invite_invalid'; end if;
  if i.created_by = me then raise exception 'invite_self'; end if;
  if public.is_blocked_between(me, i.created_by) then raise exception 'not allowed'; end if;
  if exists (select 1 from public.friendships
             where (requester_id = me and addressee_id = i.created_by) or (requester_id = i.created_by and addressee_id = me)) then
    update public.friendships set status = 'accepted'
      where status = 'pending' and ((requester_id = me and addressee_id = i.created_by) or (requester_id = i.created_by and addressee_id = me));
  else
    insert into public.friendships (requester_id, addressee_id, status) values (i.created_by, me, 'accepted');
    update public.invites set uses = uses + 1 where code = p_code;
    insert into public.notifications (user_id, actor_id, type, link) values (i.created_by, me, 'invite_joined', '/profile/' || me);
  end if;
  return i.created_by;
end $$;
grant execute on function public.accept_invite(text) to authenticated;

-- ═══ ২) সম্পর্কের ট্যাগ (আমি ওকে কী বলে ডাকি: মামা, খালা, দাদু…) ═══
create table if not exists public.family_relations (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  other_id uuid not null references public.profiles(id) on delete cascade,
  relation text not null check (char_length(relation) between 1 and 30),
  created_at timestamptz not null default now(),
  primary key (user_id, other_id),
  check (user_id <> other_id)
);
alter table public.family_relations enable row level security;
drop policy if exists "relations own" on public.family_relations;
create policy "relations own" on public.family_relations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.are_friends(auth.uid(), other_id));

-- ═══ ৩) জন্মদিন (শুধু নিজে ও বন্ধুরা দেখতে পায়; সাল দেওয়া ঐচ্ছিক) ═══
create table if not exists public.birthdays (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31),
  year smallint check (year is null or year between 1900 and 2100),
  updated_at timestamptz not null default now()
);
alter table public.birthdays enable row level security;
drop policy if exists "birthdays read" on public.birthdays;
drop policy if exists "birthdays write" on public.birthdays;
create policy "birthdays read" on public.birthdays for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
create policy "birthdays write" on public.birthdays for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══ ৪) ফ্যামিলি ইভেন্ট (ঈদ, বিয়ে, মিলাদ, গেট-টুগেদার) ও RSVP ═══
create table if not exists public.family_events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null default 'gathering' check (kind in ('eid','wedding','milad','gathering','birthday','other')),
  title text not null check (char_length(title) between 1 and 120),
  note text,
  place text,
  starts_at timestamptz not null,
  group_id uuid references public.groups(id) on delete set null,   -- না থাকলে নির্মাতার সব বন্ধু দেখে
  created_at timestamptz not null default now()
);
create index if not exists family_events_starts_idx on public.family_events (starts_at);
alter table public.family_events enable row level security;
drop policy if exists "events read" on public.family_events;
drop policy if exists "events insert" on public.family_events;
drop policy if exists "events update" on public.family_events;
drop policy if exists "events delete" on public.family_events;
create policy "events read" on public.family_events for select to authenticated using (
  created_by = auth.uid()
  or (group_id is null and public.are_friends(auth.uid(), created_by))
  or (group_id is not null and public.is_group_member(group_id, auth.uid())));
create policy "events insert" on public.family_events for insert to authenticated
  with check (created_by = auth.uid() and (group_id is null or public.is_group_member(group_id, auth.uid())));
create policy "events update" on public.family_events for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "events delete" on public.family_events for delete to authenticated using (created_by = auth.uid());

create table if not exists public.event_rsvps (
  event_id uuid not null references public.family_events(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  status text not null check (status in ('going','maybe','no')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_rsvps enable row level security;
drop policy if exists "rsvp read" on public.event_rsvps;
drop policy if exists "rsvp write" on public.event_rsvps;
-- যে ইভেন্ট আপনি দেখতে পান (ওপরের পলিসি অনুযায়ী), তার RSVP-ও দেখতে ও দিতে পারেন
create policy "rsvp read" on public.event_rsvps for select to authenticated
  using (exists (select 1 from public.family_events e where e.id = event_id));
create policy "rsvp write" on public.event_rsvps for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.family_events e where e.id = event_id));

-- নতুন ইভেন্ট হলে দর্শকদের জানানো
create or replace function public.notify_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type, link)
  select u, new.created_by, 'event_new', '/family?tab=events&event=' || new.id
  from (
    select case when f.requester_id = new.created_by then f.addressee_id else f.requester_id end as u
      from public.friendships f
      where new.group_id is null and f.status = 'accepted' and new.created_by in (f.requester_id, f.addressee_id)
    union
    select m.user_id from public.group_members m where new.group_id is not null and m.group_id = new.group_id
  ) t
  where u <> new.created_by and not public.is_blocked_between(u, new.created_by);
  return new;
end $$;
drop trigger if exists trg_notify_event on public.family_events;
create trigger trg_notify_event after insert on public.family_events for each row execute function public.notify_event();

-- ═══ ৫) দৈনিক রিমাইন্ডার (জন্মদিন + আগামীকালের/আজকের অনুষ্ঠান) ═══
create table if not exists public.reminder_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.reminder_log enable row level security;   -- কোনো পলিসি নেই: শুধু নিচের ফাংশন ব্যবহার করে

create or replace function public.run_family_reminders() returns void
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Dhaka')::date;
        leap boolean := (extract(year from (now() at time zone 'Asia/Dhaka'))::int % 4 = 0
                         and (extract(year from (now() at time zone 'Asia/Dhaka'))::int % 100 <> 0 or extract(year from (now() at time zone 'Asia/Dhaka'))::int % 400 = 0));
begin
  -- জন্মদিন: আজ যাদের, তাদের সব বন্ধুকে (২৯ ফেব্রুয়ারি হলে নন-লিপ বছরে ২৮ তারিখে)
  with cand as (
    select case when f.requester_id = b.user_id then f.addressee_id else f.requester_id end as uid,
           b.user_id as actor,
           'bday:' || b.user_id || ':' || extract(year from today)::int as key
    from public.birthdays b
    join public.profiles p on p.id = b.user_id and p.deactivated_at is null
    join public.friendships f on f.status = 'accepted' and b.user_id in (f.requester_id, f.addressee_id)
    where (b.month = extract(month from today) and b.day = extract(day from today))
       or (b.month = 2 and b.day = 29 and not leap and extract(month from today) = 2 and extract(day from today) = 28)
  ), ins as (
    insert into public.reminder_log (user_id, key)
    select c.uid, c.key from cand c where not public.is_blocked_between(c.uid, c.actor)
    on conflict do nothing returning user_id, key
  )
  insert into public.notifications (user_id, actor_id, type, link)
  select c.uid, c.actor, 'birthday', '/profile/' || c.actor from cand c join ins on ins.user_id = c.uid and ins.key = c.key;

  -- অনুষ্ঠান: আগামীকাল (d1) ও আজ (d0), যারা "পারব না" বলেননি
  with ev as (
    select e.*, ((e.starts_at at time zone 'Asia/Dhaka')::date - today) as dleft
    from public.family_events e
    where (e.starts_at at time zone 'Asia/Dhaka')::date in (today, today + 1)
  ), aud as (
    select ev.id as eid, ev.created_by as actor, ev.dleft, u.uid
    from ev
    cross join lateral (
      select ev.created_by as uid
      union
      select case when f.requester_id = ev.created_by then f.addressee_id else f.requester_id end
        from public.friendships f where ev.group_id is null and f.status = 'accepted' and ev.created_by in (f.requester_id, f.addressee_id)
      union
      select m.user_id from public.group_members m where ev.group_id is not null and m.group_id = ev.group_id
    ) u
  ), cand as (
    select a.uid, a.actor, a.eid, 'ev:' || a.eid || ':d' || a.dleft as key
    from aud a
    where not exists (select 1 from public.event_rsvps r where r.event_id = a.eid and r.user_id = a.uid and r.status = 'no')
  ), ins as (
    insert into public.reminder_log (user_id, key) select c.uid, c.key from cand c on conflict do nothing returning user_id, key
  )
  insert into public.notifications (user_id, actor_id, type, link)
  select c.uid, c.actor, 'event_reminder', '/family?tab=events&event=' || c.eid from cand c join ins on ins.user_id = c.uid and ins.key = c.key;
end $$;
revoke all on function public.run_family_reminders() from public, anon, authenticated;

-- pg_cron থাকলে প্রতিদিন সকাল ৮টায় (বাংলাদেশ সময়) নিজে নিজে চলবে। না থাকলে শুধু অ্যাপের ভেতরের কার্ড কাজ করবে।
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin perform cron.unschedule('apon-family-reminders'); exception when others then null; end;
    perform cron.schedule('apon-family-reminders', '0 2 * * *', 'select public.run_family_reminders()');
  end if;
exception when others then
  raise notice 'pg_cron সেট করা যায়নি (ঐচ্ছিক): %', sqlerrm;
end $$;

-- ═══ ৬) শেয়ার্ড ফ্যামিলি অ্যালবাম ═══
create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  description text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.album_members (
  album_id uuid not null references public.albums(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (album_id, user_id)
);
create table if not exists public.album_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  media_url text not null,
  caption text,
  created_at timestamptz not null default now()
);
create index if not exists album_photos_album_idx on public.album_photos (album_id, created_at desc);

create or replace function public.is_album_member(a uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.album_members where album_id = a and user_id = u)
$$;
create or replace function public.is_album_owner(a uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.albums where id = a and created_by = u)
$$;

grant execute on function public.is_album_member(uuid, uuid), public.is_album_owner(uuid, uuid) to authenticated;

alter table public.albums enable row level security;
alter table public.album_members enable row level security;
alter table public.album_photos enable row level security;
drop policy if exists "albums read" on public.albums;       drop policy if exists "albums insert" on public.albums;
drop policy if exists "albums update" on public.albums;     drop policy if exists "albums delete" on public.albums;
drop policy if exists "amembers read" on public.album_members; drop policy if exists "amembers add" on public.album_members;
drop policy if exists "amembers delete" on public.album_members;
drop policy if exists "aphotos read" on public.album_photos;   drop policy if exists "aphotos insert" on public.album_photos;
drop policy if exists "aphotos update" on public.album_photos; drop policy if exists "aphotos delete" on public.album_photos;

create policy "albums read" on public.albums for select to authenticated using (public.is_album_member(id, auth.uid()) or created_by = auth.uid());
create policy "albums insert" on public.albums for insert to authenticated with check (created_by = auth.uid());
create policy "albums update" on public.albums for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "albums delete" on public.albums for delete to authenticated using (created_by = auth.uid());

create policy "amembers read" on public.album_members for select to authenticated using (public.is_album_member(album_id, auth.uid()));
create policy "amembers add" on public.album_members for insert to authenticated
  with check (public.is_album_owner(album_id, auth.uid()) and public.are_friends(auth.uid(), user_id));
create policy "amembers delete" on public.album_members for delete to authenticated
  using (user_id = auth.uid() or public.is_album_owner(album_id, auth.uid()));

create policy "aphotos read" on public.album_photos for select to authenticated using (public.is_album_member(album_id, auth.uid()));
create policy "aphotos insert" on public.album_photos for insert to authenticated
  with check (user_id = auth.uid() and public.is_album_member(album_id, auth.uid()));
create policy "aphotos update" on public.album_photos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "aphotos delete" on public.album_photos for delete to authenticated
  using (user_id = auth.uid() or public.is_album_owner(album_id, auth.uid()));

-- অ্যালবাম বানালে নির্মাতা নিজে সদস্য হয়ে যায়
create or replace function public.album_owner_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.album_members (album_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  return new;
end $$;
drop trigger if exists trg_album_owner on public.albums;
create trigger trg_album_owner after insert on public.albums for each row execute function public.album_owner_member();

-- কাউকে অ্যালবামে যোগ করলে তাকে জানানো
create or replace function public.notify_album_add() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select created_by into owner from public.albums where id = new.album_id;
  if owner is not null and new.user_id <> owner then
    insert into public.notifications (user_id, actor_id, type, link) values (new.user_id, owner, 'album_add', '/albums/' || new.album_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_album_add on public.album_members;
create trigger trg_notify_album_add after insert on public.album_members for each row execute function public.notify_album_add();

-- আমার অ্যালবামের তালিকা (কভার ছবি, ছবি ও সদস্যের সংখ্যাসহ)
create or replace function public.my_albums()
returns table (id uuid, title text, description text, created_by uuid, created_at timestamptz, photo_count bigint, member_count bigint, cover_url text)
language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.description, a.created_by, a.created_at,
    (select count(*) from public.album_photos p where p.album_id = a.id),
    (select count(*) from public.album_members m where m.album_id = a.id),
    (select p.media_url from public.album_photos p where p.album_id = a.id order by p.created_at desc limit 1)
  from public.albums a
  where public.is_album_member(a.id, auth.uid())
  order by a.created_at desc
$$;
grant execute on function public.my_albums() to authenticated;
