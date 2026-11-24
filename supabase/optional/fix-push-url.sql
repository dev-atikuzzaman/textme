-- পুশ নোটিফিকেশনের URL ঠিক করার জন্য। SQL Editor-এ Run করুন (ট্রিগার আগের মতোই থাকবে, শুধু ফাংশন বদলাবে)।
-- ⚠️ YOUR_PROJECT_REF ও YOUR_SECRET বসিয়ে Run করুন। এই ফাইলে আসল মান বসিয়ে GitHub-এ কমিট করবেন না।

create or replace function public.push_on_insert() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://aaa.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '...'),
    body := jsonb_build_object('table', tg_table_name, 'record', to_jsonb(new))
  );
  return new;
exception when others then
  return new;
end $$;
