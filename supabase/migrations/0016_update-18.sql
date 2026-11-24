-- আপডেট ১৯: গ্রুপ চ্যাটে ছবি/ভিডিও/অডিও/যেকোনো ফাইল পাঠানো
alter table public.group_messages add column if not exists file_name text;
alter table public.group_messages add column if not exists file_size bigint;
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.group_messages'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%media_type%' loop
    execute format('alter table public.group_messages drop constraint %I', c);
  end loop;
end $$;
alter table public.group_messages add constraint group_messages_media_type_check
  check (media_type is null or media_type in ('image', 'video', 'audio', 'file'));
