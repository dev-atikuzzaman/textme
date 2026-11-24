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
