-- আপডেট ১৮: প্রাইভেসি — বন্ধু না হলে অন্যের ব্যক্তিগত পোস্ট দেখা যাবে না
-- Supabase > SQL Editor-এ একবার Run করুন (বারবার চালালেও সমস্যা নেই)
--  • গ্রুপের পোস্ট: শুধু গ্রুপের সদস্য (আগের মতোই)
--  • পেজের পোস্ট: পাবলিক হলে সবাই
--  • রিলস/ভিডিও (পাবলিক দেওয়া): সবাই দেখতে পারে — এগুলো পাবলিক চ্যানেল
--  • সাধারণ পোস্ট: নিজে অথবা বন্ধুরা ("পাবলিক" দিলেও শুধু বন্ধুরা)
drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (
  case
    when group_id is not null then public.is_group_member(group_id, auth.uid())
    when user_id = auth.uid() then true
    when page_id is not null then privacy = 'public'
    when kind in ('reel', 'video') and privacy = 'public' then true
    else privacy in ('friends', 'public') and public.are_friends(auth.uid(), user_id)
  end
);
