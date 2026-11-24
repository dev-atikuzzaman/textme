-- আপডেট ১৫: চ্যাট পিন / আর্কাইভ (প্রতি ইউজারের নিজস্ব)
-- chat_key: 'u:<ইউজার-id>' (পারসোনাল চ্যাট) অথবা 'g:<গ্রুপ-id>' (গ্রুপ চ্যাট)
create table if not exists public.chat_prefs (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  chat_key text not null,
  pinned boolean not null default false,
  archived boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, chat_key)
);
alter table public.chat_prefs enable row level security;
drop policy if exists "chat_prefs own" on public.chat_prefs;
create policy "chat_prefs own" on public.chat_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
