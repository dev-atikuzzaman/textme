-- Google লগ-ইনের জন্য প্রোফাইল ট্রিগার আপডেট। SQL Editor-এ Run করুন।
-- (Google থেকে নাম ও ছবি আনে, ইউজারনেম ডুপ্লিকেট হলে নিজে থেকে সংখ্যা জুড়ে দেয়)

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  uname text;
begin
  base := lower(regexp_replace(
    coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    '[^a-zA-Z0-9_.]', '', 'g'));
  if length(base) < 3 then base := 'user' || base; end if;
  base := left(base, 20);
  uname := base;
  while exists (select 1 from profiles where username = uname) loop
    uname := left(base, 16) || floor(random() * 9000 + 1000)::int;
  end loop;

  insert into profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    uname,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), 'ব্যবহারকারী'),
    coalesce(nullif(new.raw_user_meta_data->>'avatar_url', ''), nullif(new.raw_user_meta_data->>'picture', ''))
  );
  return new;
end $$;
