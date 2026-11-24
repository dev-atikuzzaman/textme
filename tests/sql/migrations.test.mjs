import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { newDb, applyAll, migrations, migDir, root, stripExt } from './shim.mjs'

test('সব migration ক্রমানুসারে নতুন ডেটাবেসে প্রয়োগ হয়', async () => {
  const db = await newDb()
  await applyAll(db)
  const t = await db.query(`select count(*)::int n from information_schema.tables where table_schema='public'`)
  assert.ok(t.rows[0].n > 20)
})

test('all-in-one.sql হালনাগাদ (npm run build:sql)', async () => {
  const { trackedSql } = await import('../../scripts/build-sql.mjs')
  const want = trackedSql(migrations())
  const have = fs.readFileSync(path.join(root, 'supabase', 'all-in-one.sql'), 'utf8')
  assert.equal(have, want, 'migrations বদলেছে কিন্তু all-in-one.sql পুরনো — `npm run build:sql` চালান')
})

test('all-in-one.sql: নতুন DB-তে চলে, দ্বিতীয়বার কিছুই আবার চালায় না', async () => {
  const db = await newDb()
  const sql = stripExt(fs.readFileSync(path.join(root, 'supabase', 'all-in-one.sql'), 'utf8'))
  await db.exec(sql)
  const n1 = (await db.query('select count(*)::int n from public.schema_migrations')).rows[0].n
  assert.equal(n1, migrations().length)
  await db.exec(sql) // non-idempotent migration (update-1) আবার চললে এখানেই ফাটত
  const n2 = (await db.query('select count(*)::int n from public.schema_migrations')).rows[0].n
  assert.equal(n2, n1)
})

test('_baseline.sql: আগে-থেকে-চালানো DB-কে চিহ্নিত করে, তারপর all-in-one কিছু ভাঙে না', async () => {
  const db = await newDb()
  await applyAll(db) // হাতে সব চালানো
  await db.exec(fs.readFileSync(path.join(migDir, '_baseline.sql'), 'utf8'))
  await db.exec(stripExt(fs.readFileSync(path.join(root, 'supabase', 'all-in-one.sql'), 'utf8')))
  const n = (await db.query('select count(*)::int n from public.schema_migrations')).rows[0].n
  assert.equal(n, migrations().length)
})

test('ক্লায়েন্ট schema_migrations পড়তে পারে না', async () => {
  const db = await newDb()
  await db.exec(stripExt(fs.readFileSync(path.join(root, 'supabase', 'all-in-one.sql'), 'utf8')))
  await db.exec('grant usage on schema public to authenticated; grant all on public.schema_migrations to authenticated; set role authenticated')
  const r = await db.query('select * from public.schema_migrations')
  assert.equal(r.rows.length, 0)
})
