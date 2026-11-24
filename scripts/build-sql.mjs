// supabase/migrations/*.sql থেকে এক-ফাইলের supabase/all-in-one.sql বানায়।
// প্রতিটি migration নিজের ট্র্যাকিং-সহ: public.schema_migrations টেবিলে আগে থেকে থাকলে বাদ যায়,
// তাই ফাইলটি বারবার (নতুন migration যোগ হওয়ার পরও) নিরাপদে Run করা যায়।
// ব্যবহার: npm run build:sql
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'supabase', 'migrations')
const files = fs.readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()

export function trackedSql(files, read = (f) => fs.readFileSync(path.join(dir, f), 'utf8')) {
  let out = `-- ⚠️ স্বয়ংক্রিয়ভাবে তৈরি (scripts/build-sql.mjs)। হাতে বদলাবেন না; supabase/migrations/ বদলে \`npm run build:sql\` চালান।
-- Supabase > SQL Editor-এ পুরোটা Run করুন। যেসব migration আগে প্রয়োগ হয়েছে সেগুলো বাদ যাবে।
-- ইতোমধ্যে সব হাতে চালিয়ে থাকলে আগে একবার supabase/migrations/_baseline.sql চালান।

create table if not exists public.schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security; -- কোনো policy নেই: ক্লায়েন্ট দেখতে পাবে না

`
  for (const f of files) {
    const id = f.replace(/\.sql$/, '')
    const body = read(f)
    const tag = `$mig_${id.replace(/\W/g, '_')}$`
    if (body.includes(tag)) throw new Error(`${f}: ট্যাগ ${tag} ফাইলের ভেতরেই আছে`)
    out += `-- ═══ ${id} ═══
do $mig$ begin
  if not exists (select 1 from public.schema_migrations where id = '${id}') then
    execute ${tag}
${body}
${tag};
    insert into public.schema_migrations (id) values ('${id}');
    raise notice 'applied ${id}';
  end if;
end $mig$;

`
  }
  return out
}

export function baselineSql(files) {
  const ids = files.map((f) => f.replace(/\.sql$/, ''))
  return `-- একবারই চালান, শুধু যদি আপনি আগেই (update-N ফাইলগুলো হাতে) সবকিছু Run করে থাকেন।
-- এটি migration গুলোকে "প্রয়োগ হয়ে গেছে" চিহ্নিত করে, কোনো SQL আবার চালায় না।
create table if not exists public.schema_migrations (id text primary key, applied_at timestamptz not null default now());
alter table public.schema_migrations enable row level security;
insert into public.schema_migrations (id) values
${ids.map((i) => `  ('${i}')`).join(',\n')}
on conflict do nothing;
`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(path.join(root, 'supabase', 'all-in-one.sql'), trackedSql(files))
  fs.writeFileSync(path.join(dir, '_baseline.sql'), baselineSql(files))
  console.log(`✓ ${files.length}টি migration → supabase/all-in-one.sql ও migrations/_baseline.sql`)
}
