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
