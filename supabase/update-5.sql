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
