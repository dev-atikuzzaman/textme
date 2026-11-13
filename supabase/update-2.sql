-- Background Push এর জন্য। update-1.sql চালানোর পর এটা Run করুন।
-- ⚠️ নিচের YOUR_PROJECT_REF ও YOUR_SECRET দুই জায়গায় নিজের মান বসিয়ে তারপর Run দিন।
--    YOUR_SECRET = যেকোনো লম্বা র‍্যান্ডম স্ট্রিং (WEBHOOK_SECRET হিসেবে একই মান Edge Function-এও দিতে হবে)

create extension if not exists pg_net with schema extensions;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
create policy "push read own" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "push delete own" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- একই ফোনে অন্য অ্যাকাউন্টে লগ-ইন করলেও সাবস্ক্রিপশন ঠিকভাবে বদলে যায়
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language sql security definer set search_path = public as $$
  insert into push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth
$$;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- নতুন নোটিফিকেশন বা মেসেজ এলে Edge Function-কে ডাকে
create or replace function public.push_on_insert() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://uvpwnislgslfidvwecpw.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', 'P7UY!qg-Qz=v+vU!P@%W]_RAbM<7$m>_'),
    body := jsonb_build_object('table', tg_table_name, 'record', to_jsonb(new))
  );
  return new;
exception when others then
  return new; -- পুশ ব্যর্থ হলেও মূল ডাটা সেভ হবে
end $$;

create trigger trg_push_notifications after insert on public.notifications
  for each row execute function public.push_on_insert();
create trigger trg_push_messages after insert on public.messages
  for each row execute function public.push_on_insert();
