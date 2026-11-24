-- মেসেজ "পড়া হয়েছে" (✓✓) ও ইনবক্সের আনরিড সংখ্যার জন্য। update-12.sql-এর পর Run করুন।
-- একাধিকবার চালালেও সমস্যা নেই।

alter table public.messages add column if not exists read_at timestamptz;
create index if not exists messages_unread_idx on public.messages (receiver_id, sender_id) where read_at is null;

-- প্রাপক শুধু read_at বসাতে পারবে (মেসেজের লেখা বদলানোর সুযোগ নেই), তাই সরাসরি policy না দিয়ে ফাংশন
create or replace function public.mark_chat_read(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update messages set read_at = now()
  where receiver_id = auth.uid() and sender_id = p_other and read_at is null;
end $$;
revoke execute on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;
