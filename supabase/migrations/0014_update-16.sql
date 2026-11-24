-- আপডেট ১৭: গ্রুপ কভার ফটো + গ্রুপ কলের নোটিফিকেশন
alter table public.groups add column if not exists cover_url text;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('like','comment','reply','friend_request','friend_accept','post','group_post','page_post','group_add','poke','group_call'));

-- গ্রুপ কল শুরু করলে বাকি সদস্যদের নোটিফিকেশন (অ্যাপে রিং + ব্যাকগ্রাউন্ডে পুশ)
create or replace function public.notify_group_call(p_group uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_group_member(p_group, auth.uid()) then raise exception 'not allowed'; end if;
  insert into notifications (user_id, actor_id, type, link)
  select gm.user_id, auth.uid(), 'group_call',
         '/groups/' || p_group || '?tab=chat&call=' || case when p_kind = 'video' then 'video' else 'audio' end
  from group_members gm where gm.group_id = p_group and gm.user_id <> auth.uid();
end $$;
grant execute on function public.notify_group_call(uuid, text) to authenticated;
