-- ═══ update-24: RLS কলাম-সুরক্ষা (একাধিকবার চালালেও সমস্যা নেই) ═══
-- সমস্যা: RLS শুধু "কোন সারি" বদলানো যাবে ঠিক করে, "কোন কলাম" নয়। তাই
--  • friendships: যে রিকুয়েস্ট পেয়েছে সে requester_id বদলে যে-কারো সাথে ভুয়া বন্ধুত্ব বানাতে পারত
--  • messages: প্রেরক নিজের মেসেজের receiver_id/content/type বদলে (ব্লক-চেক এড়িয়ে) অন্যকে পাঠাতে পারত,
--    এবং pinned_at দিয়ে ৩টির পিন-সীমা ভাঙতে পারত
--  • notifications: নিজের নোটিফিকেশনের যেকোনো কলাম বদলানো যেত
-- সমাধান: ক্লায়েন্ট (role = authenticated) সরাসরি UPDATE করলে শুধু অনুমোদিত কলাম বদলাতে পারবে।
-- SECURITY DEFINER ফাংশন (accept_invite, pin_message, mark-read ইত্যাদি) এতে আটকায় না।

create or replace function public.guard_friendship_update() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status')
       or old.status <> 'pending' or new.status <> 'accepted' then
      raise exception 'only pending -> accepted is allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_friendship_update on public.friendships;
create trigger trg_guard_friendship_update before update on public.friendships
  for each row execute function public.guard_friendship_update();

create or replace function public.guard_message_update() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (to_jsonb(new) - 'meta') is distinct from (to_jsonb(old) - 'meta') then
      raise exception 'only meta can be updated directly' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_message_update on public.messages;
create trigger trg_guard_message_update before update on public.messages
  for each row execute function public.guard_message_update();

create or replace function public.guard_notification_update() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (to_jsonb(new) - 'read') is distinct from (to_jsonb(old) - 'read') then
      raise exception 'only read can be updated directly' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_notification_update on public.notifications;
create trigger trg_guard_notification_update before update on public.notifications
  for each row execute function public.guard_notification_update();
