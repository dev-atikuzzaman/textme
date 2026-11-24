-- "Could not embed because more than one relationship was found for 'posts' and 'profiles'" ঠিক করার জন্য।
-- একাধিকবার চালালেও সমস্যা নেই। SQL Editor-এ পুরোটা Run করুন।

-- ১) একই কলামে একই টেবিলের দিকে একাধিক ফরেন কী থাকলে বাড়তিগুলো মুছে ফেলা
do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tbl, conname,
           row_number() over (partition by conrelid, conkey, confrelid order by conname) as rn
    from pg_constraint
    where contype = 'f' and connamespace = 'public'::regnamespace
  loop
    if r.rn > 1 then
      execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    end if;
  end loop;
end $$;

-- ২) অ্যাপের কোয়েরি যে নামে ফরেন কী খোঁজে (posts_user_id_fkey, comments_user_id_fkey), সেই নামে মিলিয়ে দেওয়া
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.posts'::regclass and contype = 'f' and confrelid = 'public.profiles'::regclass
     and conkey = (select array_agg(attnum) from pg_attribute where attrelid = 'public.posts'::regclass and attname = 'user_id');
  if c is not null and c <> 'posts_user_id_fkey' then
    execute format('alter table public.posts rename constraint %I to posts_user_id_fkey', c);
  end if;

  select conname into c from pg_constraint
   where conrelid = 'public.comments'::regclass and contype = 'f' and confrelid = 'public.profiles'::regclass
     and conkey = (select array_agg(attnum) from pg_attribute where attrelid = 'public.comments'::regclass and attname = 'user_id');
  if c is not null and c <> 'comments_user_id_fkey' then
    execute format('alter table public.comments rename constraint %I to comments_user_id_fkey', c);
  end if;
end $$;

-- ৩) যাচাই: posts ও comments থেকে profiles-এ ঠিক একটি করে সংযোগ থাকা উচিত
select conrelid::regclass as tbl, conname from pg_constraint
where contype = 'f' and confrelid = 'public.profiles'::regclass and conrelid in ('public.posts'::regclass, 'public.comments'::regclass);
