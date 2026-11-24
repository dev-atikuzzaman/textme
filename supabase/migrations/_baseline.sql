-- একবারই চালান, শুধু যদি আপনি আগেই (update-N ফাইলগুলো হাতে) সবকিছু Run করে থাকেন।
-- এটি migration গুলোকে "প্রয়োগ হয়ে গেছে" চিহ্নিত করে, কোনো SQL আবার চালায় না।
create table if not exists public.schema_migrations (id text primary key, applied_at timestamptz not null default now());
alter table public.schema_migrations enable row level security;
insert into public.schema_migrations (id) values
  ('0000_schema'),
  ('0001_update-1'),
  ('0002_update-2'),
  ('0003_update-3'),
  ('0004_update-4'),
  ('0005_update-5'),
  ('0006_update-8'),
  ('0007_update-9'),
  ('0008_update-10'),
  ('0009_update-11'),
  ('0010_update-12'),
  ('0011_update-13'),
  ('0012_update-14'),
  ('0013_update-15'),
  ('0014_update-16'),
  ('0015_update-17'),
  ('0016_update-18'),
  ('0017_update-19'),
  ('0018_update-20'),
  ('0019_update-21'),
  ('0020_update-22'),
  ('0021_update-23'),
  ('0022_update-24')
on conflict do nothing;
