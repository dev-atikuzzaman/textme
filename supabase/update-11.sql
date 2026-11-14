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
