-- পোস্ট/রিল/ভিডিও আপলোড ঠিক করার জন্য। একাধিকবার চালালেও সমস্যা নেই। SQL Editor-এ পুরোটা Run করুন।

-- ১) media বাকেট (পাবলিক, ৫০MB)
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

-- ২) স্টোরেজ পলিসি (প্রতিটি ইউজার শুধু নিজের ফোল্ডারে আপলোড/মুছতে পারে)
drop policy if exists "media read" on storage.objects;
drop policy if exists "media upload" on storage.objects;
drop policy if exists "media delete" on storage.objects;
create policy "media read" on storage.objects for select using (bucket_id = 'media');
create policy "media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ৩) প্রোফাইল ছাড়া ইউজারের পোস্ট সেভ হয় না — যাদের প্রোফাইল নেই তাদের জন্য বানিয়ে দেয়
insert into public.profiles (id, username, full_name)
select u.id,
       lower(regexp_replace(split_part(coalesce(u.email, 'user'), '@', 1), '[^a-zA-Z0-9_.]', '', 'g')) || floor(random() * 9000 + 1000)::int,
       coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), 'ব্যবহারকারী')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ৪) পোস্ট টেবিলের পলিসি
drop policy if exists "posts read" on public.posts;
drop policy if exists "posts insert" on public.posts;
drop policy if exists "posts delete" on public.posts;
create policy "posts read" on public.posts for select to authenticated
  using (user_id = auth.uid() or privacy = 'public'
         or (privacy = 'friends' and public.are_friends(auth.uid(), user_id)));
create policy "posts insert" on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy "posts delete" on public.posts for delete to authenticated using (user_id = auth.uid());

-- ৫) ফিডের কোয়েরি comments টেবিল চায়; না থাকলে ফিড খালি দেখায়
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);
alter table public.comments enable row level security;
drop policy if exists "comments read" on public.comments;
drop policy if exists "comments insert" on public.comments;
drop policy if exists "comments delete" on public.comments;
create policy "comments read" on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "comments insert" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy "comments delete" on public.comments for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

-- যাচাই: বাকেটের অবস্থা (public = true ও file_size_limit = 52428800 হওয়া উচিত)
select id, public, file_size_limit from storage.buckets where id = 'media';
