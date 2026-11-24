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
