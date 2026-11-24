-- ⚠️ স্বয়ংক্রিয়ভাবে তৈরি (scripts/build-sql.mjs)। হাতে বদলাবেন না; supabase/migrations/ বদলে `npm run build:sql` চালান।
-- Supabase > SQL Editor-এ পুরোটা Run করুন। যেসব migration আগে প্রয়োগ হয়েছে সেগুলো বাদ যাবে।
-- ইতোমধ্যে সব হাতে চালিয়ে থাকলে আগে একবার supabase/migrations/_baseline.sql চালান।

create table if not exists public.schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security; -- কোনো policy নেই: ক্লায়েন্ট দেখতে পাবে না

-- ═══ 0000_schema ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0000_schema') then
    execute $mig_0000_schema$
-- Supabase Dashboard > SQL Editor > New query > পুরোটা paste করে Run দিন

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null default 'ব্যবহারকারী',
  avatar_url text,
  bio text,
  created_at timestamptz default now()
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'post' check (kind in ('post','reel','video')),
  content text, title text, category text,
  media_url text,
  media_type text check (media_type in ('image','video')),
  privacy text not null default 'friends' check (privacy in ('only_me','friends','public')),
  created_at timestamptz default now()
);
create index on public.posts (kind, created_at desc);

create table public.likes (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);
create index on public.messages (sender_id, receiver_id, created_at);

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where status = 'accepted'
    and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a)))
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1) || floor(random()*1000)::int),
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), 'ব্যবহারকারী')
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.messages enable row level security;

create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);

create policy "friend read" on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));
create policy "friend request" on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id and status = 'pending');
create policy "friend accept" on public.friendships for update to authenticated
  using (auth.uid() = addressee_id) with check (auth.uid() = addressee_id);
create policy "friend delete" on public.friendships for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));

create policy "posts read" on public.posts for select to authenticated
  using (user_id = auth.uid() or privacy = 'public'
         or (privacy = 'friends' and public.are_friends(auth.uid(), user_id)));
create policy "posts insert" on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy "posts delete" on public.posts for delete to authenticated using (user_id = auth.uid());

create policy "likes read" on public.likes for select to authenticated using (true);
create policy "likes insert" on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "likes delete" on public.likes for delete to authenticated using (user_id = auth.uid());

create policy "msg read" on public.messages for select to authenticated
  using (auth.uid() in (sender_id, receiver_id));
create policy "msg send" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.are_friends(sender_id, receiver_id));

alter publication supabase_realtime add table public.messages;

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800) on conflict (id) do nothing;
create policy "media read" on storage.objects for select using (bucket_id = 'media');
create policy "media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

$mig_0000_schema$;
    insert into public.schema_migrations (id) values ('0000_schema');
    raise notice 'applied 0000_schema';
  end if;
end $mig$;

-- ═══ 0001_update-1 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0001_update-1') then
    execute $mig_0001_update_1$
-- আগের schema.sql চালানোর পর এটা আলাদাভাবে Run করুন (কমেন্ট + নোটিফিকেশন)

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);
create index on public.comments (post_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','comment','friend_request','friend_accept')),
  post_id uuid references public.posts(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz default now()
);
create index on public.notifications (user_id, created_at desc);

alter table public.comments enable row level security;
alter table public.notifications enable row level security;

-- যে পোস্ট দেখার অনুমতি আছে, শুধু তার কমেন্টই দেখা/করা যাবে
create policy "comments read" on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "comments insert" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy "comments delete" on public.comments for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

create policy "notif read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif update" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "notif delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- নোটিফিকেশন অটো তৈরির ট্রিগার
create or replace function public.notify_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from posts where id = new.post_id;
  if owner is not null and owner <> new.user_id and not exists (
    select 1 from notifications where user_id = owner and actor_id = new.user_id and type = 'like' and post_id = new.post_id
  ) then
    insert into notifications (user_id, actor_id, type, post_id) values (owner, new.user_id, 'like', new.post_id);
  end if;
  return new;
end $$;
create trigger trg_notify_like after insert on public.likes for each row execute function public.notify_like();

create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into notifications (user_id, actor_id, type, post_id) values (owner, new.user_id, 'comment', new.post_id);
  end if;
  return new;
end $$;
create trigger trg_notify_comment after insert on public.comments for each row execute function public.notify_comment();

create or replace function public.notify_friend() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into notifications (user_id, actor_id, type) values (new.addressee_id, new.requester_id, 'friend_request');
  elsif old.status = 'pending' and new.status = 'accepted' then
    insert into notifications (user_id, actor_id, type) values (new.requester_id, new.addressee_id, 'friend_accept');
  end if;
  return new;
end $$;
create trigger trg_notify_friend_ins after insert on public.friendships for each row execute function public.notify_friend();
create trigger trg_notify_friend_upd after update on public.friendships for each row execute function public.notify_friend();

alter publication supabase_realtime add table public.notifications;

$mig_0001_update_1$;
    insert into public.schema_migrations (id) values ('0001_update-1');
    raise notice 'applied 0001_update-1';
  end if;
end $mig$;

-- ═══ 0002_update-2 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0002_update-2') then
    execute $mig_0002_update_2$
-- Background Push এর জন্য। update-1.sql চালানোর পর এটা Run করুন।
-- ⚠️ নিচের YOUR_PROJECT_REF ও YOUR_SECRET দুই জায়গায় নিজের মান বসিয়ে তারপর Run দিন।
--    YOUR_SECRET = যেকোনো লম্বা র‍্যান্ডম স্ট্রিং (WEBHOOK_SECRET হিসেবে একই মান Edge Function-এও দিতে হবে)

create extension if not exists pg_net with schema extensions;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
create policy "push read own" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "push delete own" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- একই ফোনে অন্য অ্যাকাউন্টে লগ-ইন করলেও সাবস্ক্রিপশন ঠিকভাবে বদলে যায়
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language sql security definer set search_path = public as $$
  insert into push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth
$$;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- নতুন নোটিফিকেশন বা মেসেজ এলে Edge Function-কে ডাকে
create or replace function public.push_on_insert() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://aaa.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '...'),
    body := jsonb_build_object('table', tg_table_name, 'record', to_jsonb(new))
  );
  return new;
exception when others then
  return new; -- পুশ ব্যর্থ হলেও মূল ডাটা সেভ হবে
end $$;

create trigger trg_push_notifications after insert on public.notifications
  for each row execute function public.push_on_insert();
create trigger trg_push_messages after insert on public.messages
  for each row execute function public.push_on_insert();

$mig_0002_update_2$;
    insert into public.schema_migrations (id) values ('0002_update-2');
    raise notice 'applied 0002_update-2';
  end if;
end $mig$;

-- ═══ 0003_update-3 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0003_update-3') then
    execute $mig_0003_update_3$
-- Google লগ-ইনের জন্য প্রোফাইল ট্রিগার আপডেট। SQL Editor-এ Run করুন।
-- (Google থেকে নাম ও ছবি আনে, ইউজারনেম ডুপ্লিকেট হলে নিজে থেকে সংখ্যা জুড়ে দেয়)

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  uname text;
begin
  base := lower(regexp_replace(
    coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    '[^a-zA-Z0-9_.]', '', 'g'));
  if length(base) < 3 then base := 'user' || base; end if;
  base := left(base, 20);
  uname := base;
  while exists (select 1 from profiles where username = uname) loop
    uname := left(base, 16) || floor(random() * 9000 + 1000)::int;
  end loop;

  insert into profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    uname,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), 'ব্যবহারকারী'),
    coalesce(nullif(new.raw_user_meta_data->>'avatar_url', ''), nullif(new.raw_user_meta_data->>'picture', ''))
  );
  return new;
end $$;

$mig_0003_update_3$;
    insert into public.schema_migrations (id) values ('0003_update-3');
    raise notice 'applied 0003_update-3';
  end if;
end $mig$;

-- ═══ 0004_update-4 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0004_update-4') then
    execute $mig_0004_update_4$
-- ইউটিউব শর্টস + ফেসবুক লিংক ফিডের জন্য। update-3.sql এর পর SQL Editor-এ Run করুন।

-- ১) বাইরের ভিডিও (ইউটিউব শর্টস অটো, ফেসবুক রিল লিংক শেয়ার করলে)
create table public.external_videos (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('youtube','facebook')),
  external_id text not null,          -- ইউটিউবের ভিডিও ID, ফেসবুকের ক্ষেত্রে পরিষ্কার করা লিংক
  url text,
  title text,
  channel_id text,
  channel_title text,
  thumbnail text,
  category text,
  feeds text[] not null default '{}', -- sub, trending_bd, trending_world, topic, shared
  added_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  fetched_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (source, external_id)
);
create index on public.external_videos (source, published_at desc);
create index on public.external_videos (channel_id);
create index on public.external_videos using gin (feeds);

alter table public.external_videos enable row level security;
create policy "ext read" on public.external_videos for select to authenticated using (true);
create policy "ext share" on public.external_videos for insert to authenticated
  with check (added_by = auth.uid() and source = 'facebook');
create policy "ext delete own" on public.external_videos for delete to authenticated
  using (added_by = auth.uid());

-- ২) ইউটিউব কানেকশন। টোকেন টেবিলে কোনো policy নেই, তাই শুধু Edge Function (service role) পড়তে পারবে।
create table public.yt_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz default now()
);
alter table public.yt_tokens enable row level security;

create table public.yt_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  channel_count int default 0,
  synced_at timestamptz,
  created_at timestamptz default now()
);
alter table public.yt_connections enable row level security;
create policy "yt conn read own" on public.yt_connections for select to authenticated using (user_id = auth.uid());

create table public.yt_subscriptions (
  user_id uuid references public.profiles(id) on delete cascade,
  channel_id text,
  primary key (user_id, channel_id)
);
alter table public.yt_subscriptions enable row level security;
create policy "yt subs read own" on public.yt_subscriptions for select to authenticated using (user_id = auth.uid());

-- ৩) নিজের সাবস্ক্রাইব করা চ্যানেলের শর্টস
create or replace function public.my_sub_shorts(p_limit int default 60)
returns setof public.external_videos
language sql stable security invoker set search_path = public as $$
  select v.* from external_videos v
  where v.source = 'youtube'
    and v.channel_id in (select channel_id from yt_subscriptions where user_id = auth.uid())
  order by v.published_at desc nulls last
  limit p_limit
$$;

-- ৪) ইউটিউব বিচ্ছিন্ন করা (টোকেন ও সাবস্ক্রিপশন তালিকা মুছে যায়)
create or replace function public.yt_disconnect() returns void
language sql security definer set search_path = public as $$
  delete from yt_tokens where user_id = auth.uid();
  delete from yt_subscriptions where user_id = auth.uid();
  delete from yt_connections where user_id = auth.uid();
$$;
revoke execute on function public.yt_disconnect() from public, anon;
grant execute on function public.yt_disconnect() to authenticated;

-- ৫) অটো সিঙ্ক (ঐচ্ছিক কিন্তু দরকারি)। Database > Extensions থেকে pg_cron ও pg_net চালু করে
--    নিচের দুই লাইনে YOUR_PROJECT_REF ও YOUR_SECRET (WEBHOOK_SECRET এর মান) বসিয়ে Run করুন।
--    ⚠️ আসল সিক্রেট কখনো GitHub-এ কমিট করবেন না।
--
-- select cron.schedule('yt-sync-feeds', '0 */6 * * *', $$
--   select net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-shorts',
--     headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret','YOUR_SECRET'),
--     body := jsonb_build_object('parts', jsonb_build_array('trending','subs')));
-- $$);
-- select cron.schedule('yt-sync-topics', '30 3 * * *', $$
--   select net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-shorts',
--     headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret','YOUR_SECRET'),
--     body := jsonb_build_object('parts', jsonb_build_array('topics')));
-- $$);

$mig_0004_update_4$;
    insert into public.schema_migrations (id) values ('0004_update-4');
    raise notice 'applied 0004_update-4';
  end if;
end $mig$;

-- ═══ 0005_update-5 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0005_update-5') then
    execute $mig_0005_update_5$
-- চ্যাটে মিডিয়া/ফাইল/কন্টাক্ট/পোল/কল + প্রোফাইল ছবি। SQL Editor-এ Run করুন।

alter table public.messages
  add column type text not null default 'text'
    check (type in ('text','image','video','audio','voice','file','contact','poll','call')),
  add column media_path text,
  add column file_name text,
  add column file_size bigint,
  add column mime text,
  add column meta jsonb;
create index on public.messages (media_path) where media_path is not null;

-- কল শেষে স্ট্যাটাস আপডেট করার জন্য (শুধু নিজের পাঠানো মেসেজ)
create policy "msg update own" on public.messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- পোলের ভোট (প্রতি মেসেজে প্রতি ইউজারের একটি ভোট, বদলানো যায়)
create table public.poll_votes (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  option_idx int not null check (option_idx between 0 and 5),
  primary key (message_id, user_id)
);
alter table public.poll_votes enable row level security;
create policy "votes read" on public.poll_votes for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id));
create policy "votes insert" on public.poll_votes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id and m.type = 'poll'));
create policy "votes update" on public.poll_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "votes delete" on public.poll_votes for delete to authenticated using (user_id = auth.uid());
alter publication supabase_realtime add table public.poll_votes;

-- চ্যাট ফাইলের জন্য প্রাইভেট বাকেট (শুধু প্রেরক ও প্রাপক সাইনড লিংকে দেখতে পারবে)
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat', 'chat', false, 52428800) on conflict (id) do nothing;

create policy "chat upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "chat read" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.messages m where m.media_path = name and m.receiver_id = auth.uid())
  ));
create policy "chat delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat' and (storage.foldername(name))[1] = auth.uid()::text);

$mig_0005_update_5$;
    insert into public.schema_migrations (id) values ('0005_update-5');
    raise notice 'applied 0005_update-5';
  end if;
end $mig$;

-- ═══ 0006_update-8 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0006_update-8') then
    execute $mig_0006_update_8$
-- পোস্ট পিন/এডিট ও ৬ রকম রিয়্যাকশনের জন্য। SQL Editor-এ Run করুন (একাধিকবার চালালেও সমস্যা নেই)।

-- ১) পিন ও এডিটের তারিখ
alter table public.posts add column if not exists pinned_at timestamptz;
alter table public.posts add column if not exists edited_at timestamptz;
create index if not exists posts_pinned_idx on public.posts (pinned_at desc nulls last);

-- ২) নিজের পোস্ট এডিটের অনুমতি
drop policy if exists "posts update own" on public.posts;
create policy "posts update own" on public.posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ৩) রিয়্যাকশনের ধরন (আগের সব লাইক ❤️ হিসেবে থাকবে)
alter table public.likes add column if not exists type text not null default 'love';
alter table public.likes drop constraint if exists likes_type_check;
alter table public.likes add constraint likes_type_check check (type in ('like','love','haha','wow','sad','angry'));
drop policy if exists "likes update own" on public.likes;
create policy "likes update own" on public.likes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ৪) পিন: প্রতিজন ইউজারের একসাথে একটি পোস্টই পিন থাকে
create or replace function public.set_pin(p_post uuid, p_pin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from posts where id = p_post and user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  if p_pin then
    update posts set pinned_at = null where user_id = auth.uid() and pinned_at is not null;
    update posts set pinned_at = now() where id = p_post;
  else
    update posts set pinned_at = null where id = p_post;
  end if;
end $$;
revoke execute on function public.set_pin(uuid, boolean) from public, anon;
grant execute on function public.set_pin(uuid, boolean) to authenticated;

$mig_0006_update_8$;
    insert into public.schema_migrations (id) values ('0006_update-8');
    raise notice 'applied 0006_update-8';
  end if;
end $mig$;

-- ═══ 0007_update-9 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0007_update-9') then
    execute $mig_0007_update_9$
-- পোস্টে যেকোনো ফাইল, কমেন্টে ছবি/ভিডিও/ফাইল ও কমেন্টের রিয়্যাকশনের জন্য।
-- SQL Editor-এ পুরোটা Run করুন (একাধিকবার চালালেও সমস্যা নেই)।

-- ১) পোস্টে ফাইলের তথ্য ও 'file' ধরন
alter table public.posts add column if not exists media_name text;
alter table public.posts add column if not exists media_size bigint;
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.posts'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%media_type%'
  loop
    execute format('alter table public.posts drop constraint %I', c);
  end loop;
end $$;
alter table public.posts add constraint posts_media_type_check check (media_type is null or media_type in ('image','video','file'));

-- ২) কমেন্টে অ্যাটাচমেন্ট (শুধু ফাইল দিয়েও কমেন্ট করা যাবে)
alter table public.comments alter column content drop not null;
alter table public.comments add column if not exists media_url text;
alter table public.comments add column if not exists media_type text;
alter table public.comments add column if not exists media_name text;
alter table public.comments add column if not exists media_size bigint;
alter table public.comments drop constraint if exists comments_media_type_check;
alter table public.comments add constraint comments_media_type_check check (media_type is null or media_type in ('image','video','file'));
alter table public.comments drop constraint if exists comments_has_body;
alter table public.comments add constraint comments_has_body check (content is not null or media_url is not null);

-- ৩) কমেন্টের রিয়্যাকশন
create table if not exists public.comment_reactions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'like' check (type in ('like','love','haha','wow','sad','angry')),
  primary key (comment_id, user_id)
);
alter table public.comment_reactions enable row level security;
drop policy if exists "cr read" on public.comment_reactions;
drop policy if exists "cr insert" on public.comment_reactions;
drop policy if exists "cr update" on public.comment_reactions;
drop policy if exists "cr delete" on public.comment_reactions;
create policy "cr read" on public.comment_reactions for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));
create policy "cr insert" on public.comment_reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.comments c where c.id = comment_id));
create policy "cr update" on public.comment_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cr delete" on public.comment_reactions for delete to authenticated using (user_id = auth.uid());

$mig_0007_update_9$;
    insert into public.schema_migrations (id) values ('0007_update-9');
    raise notice 'applied 0007_update-9';
  end if;
end $mig$;

-- ═══ 0008_update-10 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0008_update-10') then
    execute $mig_0008_update_10$
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

$mig_0008_update_10$;
    insert into public.schema_migrations (id) values ('0008_update-10');
    raise notice 'applied 0008_update-10';
  end if;
end $mig$;

-- ═══ 0009_update-11 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0009_update-11') then
    execute $mig_0009_update_11$
-- হোম পেজের নতুন ফিচার: স্টোরি (২৪ ঘণ্টা) ও পোস্ট সেভ/বুকমার্ক।
-- update-11.sql-এর পর Run করুন। একাধিকবার চালালেও সমস্যা নেই।

-- ১) সেভ করা পোস্ট (শুধু নিজে দেখতে পায়)
create table if not exists public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);
alter table public.saved_posts enable row level security;
drop policy if exists "saved read" on public.saved_posts;
drop policy if exists "saved insert" on public.saved_posts;
drop policy if exists "saved delete" on public.saved_posts;
create policy "saved read" on public.saved_posts for select to authenticated using (user_id = auth.uid());
create policy "saved insert" on public.saved_posts for insert to authenticated with check (user_id = auth.uid());
create policy "saved delete" on public.saved_posts for delete to authenticated using (user_id = auth.uid());

-- ২) স্টোরি: লেখা বা ছবি/ভিডিও, ২৪ ঘণ্টা পর আর দেখা যায় না
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  bg int not null default 0,
  media_url text,
  media_type text check (media_type is null or media_type in ('image','video')),
  privacy text not null default 'friends' check (privacy in ('friends','public')),
  created_at timestamptz not null default now(),
  constraint stories_has_body check (content is not null or media_url is not null)
);
create index if not exists stories_created_idx on public.stories (created_at desc);
alter table public.stories enable row level security;
drop policy if exists "stories read" on public.stories;
drop policy if exists "stories insert" on public.stories;
drop policy if exists "stories delete" on public.stories;
create policy "stories read" on public.stories for select to authenticated
  using (user_id = auth.uid()
         or (created_at > now() - interval '24 hours'
             and (privacy = 'public' or public.are_friends(auth.uid(), user_id))));
create policy "stories insert" on public.stories for insert to authenticated with check (user_id = auth.uid());
create policy "stories delete" on public.stories for delete to authenticated using (user_id = auth.uid());

-- ৩) কে স্টোরি দেখেছে
create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (story_id, viewer_id)
);
alter table public.story_views enable row level security;
drop policy if exists "sviews read" on public.story_views;
drop policy if exists "sviews insert" on public.story_views;
create policy "sviews read" on public.story_views for select to authenticated
  using (viewer_id = auth.uid()
         or exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));
create policy "sviews insert" on public.story_views for insert to authenticated
  with check (viewer_id = auth.uid() and exists (select 1 from public.stories s where s.id = story_id));

$mig_0009_update_11$;
    insert into public.schema_migrations (id) values ('0009_update-11');
    raise notice 'applied 0009_update-11';
  end if;
end $mig$;

-- ═══ 0010_update-12 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0010_update-12') then
    execute $mig_0010_update_12$
-- মেসেজ "পড়া হয়েছে" (✓✓) ও ইনবক্সের আনরিড সংখ্যার জন্য। update-12.sql-এর পর Run করুন।
-- একাধিকবার চালালেও সমস্যা নেই।

alter table public.messages add column if not exists read_at timestamptz;
create index if not exists messages_unread_idx on public.messages (receiver_id, sender_id) where read_at is null;

-- প্রাপক শুধু read_at বসাতে পারবে (মেসেজের লেখা বদলানোর সুযোগ নেই), তাই সরাসরি policy না দিয়ে ফাংশন
create or replace function public.mark_chat_read(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update messages set read_at = now()
  where receiver_id = auth.uid() and sender_id = p_other and read_at is null;
end $$;
revoke execute on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

$mig_0010_update_12$;
    insert into public.schema_migrations (id) values ('0010_update-12');
    raise notice 'applied 0010_update-12';
  end if;
end $mig$;

-- ═══ 0011_update-13 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0011_update-13') then
    execute $mig_0011_update_13$
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

$mig_0011_update_13$;
    insert into public.schema_migrations (id) values ('0011_update-13');
    raise notice 'applied 0011_update-13';
  end if;
end $mig$;

-- ═══ 0012_update-14 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0012_update-14') then
    execute $mig_0012_update_14$
-- আপডেট ১৫: চ্যাট পিন / আর্কাইভ (প্রতি ইউজারের নিজস্ব)
-- chat_key: 'u:<ইউজার-id>' (পারসোনাল চ্যাট) অথবা 'g:<গ্রুপ-id>' (গ্রুপ চ্যাট)
create table if not exists public.chat_prefs (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  chat_key text not null,
  pinned boolean not null default false,
  archived boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, chat_key)
);
alter table public.chat_prefs enable row level security;
drop policy if exists "chat_prefs own" on public.chat_prefs;
create policy "chat_prefs own" on public.chat_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

$mig_0012_update_14$;
    insert into public.schema_migrations (id) values ('0012_update-14');
    raise notice 'applied 0012_update-14';
  end if;
end $mig$;

-- ═══ 0013_update-15 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0013_update-15') then
    execute $mig_0013_update_15$
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

$mig_0013_update_15$;
    insert into public.schema_migrations (id) values ('0013_update-15');
    raise notice 'applied 0013_update-15';
  end if;
end $mig$;

-- ═══ 0014_update-16 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0014_update-16') then
    execute $mig_0014_update_16$
-- আপডেট ১৭: গ্রুপ কভার ফটো + গ্রুপ কলের নোটিফিকেশন
alter table public.groups add column if not exists cover_url text;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('like','comment','reply','friend_request','friend_accept','post','group_post','page_post','group_add','poke','group_call'));

-- গ্রুপ কল শুরু করলে বাকি সদস্যদের নোটিফিকেশন (অ্যাপে রিং + ব্যাকগ্রাউন্ডে পুশ)
create or replace function public.notify_group_call(p_group uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_group_member(p_group, auth.uid()) then raise exception 'not allowed'; end if;
  insert into notifications (user_id, actor_id, type, link)
  select gm.user_id, auth.uid(), 'group_call',
         '/groups/' || p_group || '?tab=chat&call=' || case when p_kind = 'video' then 'video' else 'audio' end
  from group_members gm where gm.group_id = p_group and gm.user_id <> auth.uid();
end $$;
grant execute on function public.notify_group_call(uuid, text) to authenticated;

$mig_0014_update_16$;
    insert into public.schema_migrations (id) values ('0014_update-16');
    raise notice 'applied 0014_update-16';
  end if;
end $mig$;

-- ═══ 0015_update-17 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0015_update-17') then
    execute $mig_0015_update_17$
-- আপডেট ১৮: প্রাইভেসি — বন্ধু না হলে অন্যের ব্যক্তিগত পোস্ট দেখা যাবে না
-- Supabase > SQL Editor-এ একবার Run করুন (বারবার চালালেও সমস্যা নেই)
--  • গ্রুপের পোস্ট: শুধু গ্রুপের সদস্য (আগের মতোই)
--  • পেজের পোস্ট: পাবলিক হলে সবাই
--  • রিলস/ভিডিও (পাবলিক দেওয়া): সবাই দেখতে পারে — এগুলো পাবলিক চ্যানেল
--  • সাধারণ পোস্ট: নিজে অথবা বন্ধুরা ("পাবলিক" দিলেও শুধু বন্ধুরা)
drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (
  case
    when group_id is not null then public.is_group_member(group_id, auth.uid())
    when user_id = auth.uid() then true
    when page_id is not null then privacy = 'public'
    when kind in ('reel', 'video') and privacy = 'public' then true
    else privacy in ('friends', 'public') and public.are_friends(auth.uid(), user_id)
  end
);

$mig_0015_update_17$;
    insert into public.schema_migrations (id) values ('0015_update-17');
    raise notice 'applied 0015_update-17';
  end if;
end $mig$;

-- ═══ 0016_update-18 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0016_update-18') then
    execute $mig_0016_update_18$
-- আপডেট ১৯: গ্রুপ চ্যাটে ছবি/ভিডিও/অডিও/যেকোনো ফাইল পাঠানো
alter table public.group_messages add column if not exists file_name text;
alter table public.group_messages add column if not exists file_size bigint;
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.group_messages'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%media_type%' loop
    execute format('alter table public.group_messages drop constraint %I', c);
  end loop;
end $$;
alter table public.group_messages add constraint group_messages_media_type_check
  check (media_type is null or media_type in ('image', 'video', 'audio', 'file'));

$mig_0016_update_18$;
    insert into public.schema_migrations (id) values ('0016_update-18');
    raise notice 'applied 0016_update-18';
  end if;
end $mig$;

-- ═══ 0017_update-19 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0017_update-19') then
    execute $mig_0017_update_19$
-- আপডেট ২০: গ্রুপের যেকোনো অ্যাডমিন গ্রুপ পুরোপুরি মুছে ফেলতে পারবেন (আগে শুধু যিনি বানিয়েছেন)
drop policy if exists "groups delete" on public.groups;
create policy "groups delete" on public.groups for delete to authenticated
  using (created_by = auth.uid() or public.is_group_admin(id, auth.uid()));

$mig_0017_update_19$;
    insert into public.schema_migrations (id) values ('0017_update-19');
    raise notice 'applied 0017_update-19';
  end if;
end $mig$;

-- ═══ 0018_update-20 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0018_update-20') then
    execute $mig_0018_update_20$
-- আপডেট ২১: গ্রুপের অ্যাডমিন ব্যবস্থা + গ্রুপ দেখার প্রাইভেসি
-- Supabase > SQL Editor-এ একবার Run করুন (update-14, 18, 20 আগে চালানো থাকতে হবে)

-- ১) গ্রুপ দেখতে পারার নিয়ম:
--    সদস্য / যিনি বানিয়েছেন → সবসময়
--    পাবলিক গ্রুপ → শুধু তারা, যারা গ্রুপের অন্তত একজন সদস্যের বন্ধু
--    প্রাইভেট গ্রুপ → শুধু সদস্য
--    (বন্ধুত্ব শেষ হলে আবার দেখা বন্ধ হয়ে যায়)
create or replace function public.can_see_group(gid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups g where g.id = gid and g.created_by = uid)
      or exists (select 1 from group_members where group_id = gid and user_id = uid)
      or (exists (select 1 from groups g where g.id = gid and g.privacy = 'public')
          and exists (select 1 from group_members gm where gm.group_id = gid and public.are_friends(uid, gm.user_id)))
$$;

-- ২) গ্রুপের পোস্ট: সদস্য অথবা (পাবলিক গ্রুপের) সদস্যের বন্ধু দেখতে পারবে
drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (
  case
    when group_id is not null then public.can_see_group(group_id, auth.uid())
    when user_id = auth.uid() then true
    when page_id is not null then privacy = 'public'
    when kind in ('reel', 'video') and privacy = 'public' then true
    else privacy in ('friends', 'public') and public.are_friends(auth.uid(), user_id)
  end
);

-- ৩) যোগ দেওয়া: দেখতে পারলে তবেই
create or replace function public.join_group(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from groups where id = p_group and privacy = 'public') or not can_see_group(p_group, auth.uid()) then
    raise exception 'not allowed';
  end if;
  insert into group_members (group_id, user_id) values (p_group, auth.uid()) on conflict do nothing;
end $$;

-- ৪) অ্যাডমিন যেকোনো বন্ধুকে সরাসরি অ্যাডমিন হিসেবে (বা সাধারণ সদস্য হিসেবে) যোগ করতে পারবেন;
--    সদস্য আগে থেকে থাকলে p_admin=true দিলে অ্যাডমিন হয়ে যায়
create or replace function public.add_group_members_as(p_group uuid, p_members uuid[], p_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
declare m uuid;
begin
  if not is_group_admin(p_group, auth.uid()) then raise exception 'not allowed'; end if;
  foreach m in array coalesce(p_members, '{}'::uuid[]) loop
    if m = auth.uid() or not are_friends(auth.uid(), m) then continue; end if;
    if not is_group_member(p_group, m) then
      insert into group_members (group_id, user_id, role) values (p_group, m, case when p_admin then 'admin' else 'member' end);
      insert into notifications (user_id, actor_id, type, link) values (m, auth.uid(), 'group_add', '/groups/' || p_group);
    elsif p_admin then
      update group_members set role = 'admin' where group_id = p_group and user_id = m;
    end if;
  end loop;
end $$;
revoke execute on function public.add_group_members_as(uuid, uuid[], boolean) from public, anon;
grant execute on function public.add_group_members_as(uuid, uuid[], boolean) to authenticated;

-- ৫) অ্যাডমিন বানানো/সরানো: গ্রুপের নির্মাতাকে কেউ অ্যাডমিন থেকে সরাতে পারবে না
create or replace function public.set_group_admin(p_group uuid, p_user uuid, p_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_admin(p_group, auth.uid()) then raise exception 'not allowed'; end if;
  if not p_admin and exists (select 1 from groups where id = p_group and created_by = p_user) then
    raise exception 'গ্রুপের নির্মাতাকে অ্যাডমিন থেকে সরানো যাবে না';
  end if;
  update group_members set role = case when p_admin then 'admin' else 'member' end where group_id = p_group and user_id = p_user;
end $$;

$mig_0018_update_20$;
    insert into public.schema_migrations (id) values ('0018_update-20');
    raise notice 'applied 0018_update-20';
  end if;
end $mig$;

-- ═══ 0019_update-21 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0019_update-21') then
    execute $mig_0019_update_21$
-- ইউটিউব ভিডিও সেভ করার সুবিধা (সাবস্ক্রিপশন রিলস + ইউটিউব পেজ)।
-- Supabase > SQL Editor-এ একবার Run করুন। একাধিকবার চালালেও সমস্যা নেই।
create table if not exists public.saved_videos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id text not null,
  title text,
  channel text,
  created_at timestamptz default now(),
  primary key (user_id, video_id)
);
alter table public.saved_videos enable row level security;
drop policy if exists "saved videos read" on public.saved_videos;
drop policy if exists "saved videos insert" on public.saved_videos;
drop policy if exists "saved videos delete" on public.saved_videos;
create policy "saved videos read" on public.saved_videos for select to authenticated using (user_id = auth.uid());
create policy "saved videos insert" on public.saved_videos for insert to authenticated with check (user_id = auth.uid());
create policy "saved videos delete" on public.saved_videos for delete to authenticated using (user_id = auth.uid());

$mig_0019_update_21$;
    insert into public.schema_migrations (id) values ('0019_update-21');
    raise notice 'applied 0019_update-21';
  end if;
end $mig$;

-- ═══ 0020_update-22 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0020_update-22') then
    execute $mig_0020_update_22$
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

$mig_0020_update_22$;
    insert into public.schema_migrations (id) values ('0020_update-22');
    raise notice 'applied 0020_update-22';
  end if;
end $mig$;

-- ═══ 0021_update-23 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0021_update-23') then
    execute $mig_0021_update_23$
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

$mig_0021_update_23$;
    insert into public.schema_migrations (id) values ('0021_update-23');
    raise notice 'applied 0021_update-23';
  end if;
end $mig$;

-- ═══ 0022_update-24 ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '0022_update-24') then
    execute $mig_0022_update_24$
-- ═══ update-24: RLS কলাম-সুরক্ষা (একাধিকবার চালালেও সমস্যা নেই) ═══
-- সমস্যা: RLS শুধু "কোন সারি" বদলানো যাবে ঠিক করে, "কোন কলাম" নয়। তাই
--  • friendships: যে রিকুয়েস্ট পেয়েছে সে requester_id বদলে যে-কারো সাথে ভুয়া বন্ধুত্ব বানাতে পারত
--  • messages: প্রেরক নিজের মেসেজের receiver_id/content/type বদলে (ব্লক-চেক এড়িয়ে) অন্যকে পাঠাতে পারত,
--    এবং pinned_at দিয়ে ৩টির পিন-সীমা ভাঙতে পারত
--  • notifications: নিজের নোটিফিকেশনের যেকোনো কলাম বদলানো যেত
-- সমাধান: ক্লায়েন্ট (role = authenticated) সরাসরি UPDATE করলে শুধু অনুমোদিত কলাম বদলাতে পারবে।
-- SECURITY DEFINER ফাংশন (accept_invite, pin_message, mark-read ইত্যাদি) এতে আটকায় না।

create or replace function public.guard_friendship_update() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status')
       or old.status <> 'pending' or new.status <> 'accepted' then
      raise exception 'only pending -> accepted is allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_friendship_update on public.friendships;
create trigger trg_guard_friendship_update before update on public.friendships
  for each row execute function public.guard_friendship_update();

create or replace function public.guard_message_update() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (to_jsonb(new) - 'meta') is distinct from (to_jsonb(old) - 'meta') then
      raise exception 'only meta can be updated directly' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_message_update on public.messages;
create trigger trg_guard_message_update before update on public.messages
  for each row execute function public.guard_message_update();

create or replace function public.guard_notification_update() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (to_jsonb(new) - 'read') is distinct from (to_jsonb(old) - 'read') then
      raise exception 'only read can be updated directly' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_notification_update on public.notifications;
create trigger trg_guard_notification_update before update on public.notifications
  for each row execute function public.guard_notification_update();

$mig_0022_update_24$;
    insert into public.schema_migrations (id) values ('0022_update-24');
    raise notice 'applied 0022_update-24';
  end if;
end $mig$;

