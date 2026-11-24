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
