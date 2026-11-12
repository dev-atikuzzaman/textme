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
