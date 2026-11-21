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
