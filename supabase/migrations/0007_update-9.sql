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
