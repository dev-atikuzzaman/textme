// Supabase-এর auth/storage/net স্কিমা ও রোলের ছোট নকল, যাতে PGlite-এ migration চালানো যায়।
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const migDir = path.join(root, 'supabase', 'migrations')
export const migrations = () => fs.readdirSync(migDir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
export const stripExt = (sql) => sql.replace(/create extension[^;]*;/gi, '')

export async function newDb() {
  const db = new PGlite()
  await db.exec(`
    create schema auth; create schema storage; create schema extensions; create schema net;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz default now(), raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
    create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
    create function net.http_post(url text, headers jsonb, body jsonb) returns bigint language sql as $$ select 1::bigint $$;
    create publication supabase_realtime;
    create role authenticated; create role anon; create role service_role;`)
  return db
}

export async function applyAll(db) {
  for (const f of migrations()) await db.exec(stripExt(fs.readFileSync(path.join(migDir, f), 'utf8')))
  await db.exec(`grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;
    grant all on all functions in schema public to authenticated; grant all on all sequences in schema public to authenticated;`)
}

export const U = (n) => `0000000${n}-0000-0000-0000-000000000000`
export async function addUser(db, n, name) {
  await db.exec(`insert into auth.users (id,email,raw_user_meta_data) values ('${U(n)}','${name}@x.com','{"username":"${name}","full_name":"${name}"}')`)
  return U(n)
}
// RLS-সহ, নির্দিষ্ট ইউজার হিসেবে চালানো (authenticated রোল)
export async function as(db, uid, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false)`)
  try { return (await db.query(sql)).rows } catch (e) { return { error: e.message } } finally { await db.exec('reset role') }
}
