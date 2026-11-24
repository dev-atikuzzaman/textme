-- বাংলাদেশ / আন্তর্জাতিক / বিষয়ভিত্তিক / ফেসবুক ফিচারের ডাটা ও অটো-সিঙ্ক বন্ধ করার জন্য। একবার Run করুন।
-- (সাবস্ক্রিপশনের ডাটা ও ইউটিউব কানেকশন অক্ষত থাকবে)

-- ১) অটো-সিঙ্কের নির্ধারিত কাজ বন্ধ (pg_cron না থাকলে বা নাম না মিললে কিছু হবে না)
do $$
declare j record;
begin
  for j in select jobname from cron.job where jobname in ('yt-sync-bd-world', 'yt-sync-topics') loop
    perform cron.unschedule(j.jobname);
  end loop;
exception when others then null;
end $$;

-- ২) ফেসবুক লিংক ও বাংলাদেশ/আন্তর্জাতিক/বিষয়ভিত্তিক ভিডিও মুছে ফেলা (শুধু সাবস্ক্রিপশনের ভিডিও থাকবে)
delete from public.external_videos where source = 'facebook' or not ('sub' = any(feeds));

-- ৩) এখন আর দরকার নেই এমন পলিসি ও টেবিল
drop policy if exists "ext share" on public.external_videos;
drop policy if exists "ext delete own" on public.external_videos;
drop table if exists public.sync_runs;
