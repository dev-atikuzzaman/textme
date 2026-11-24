import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { newDb, applyAll, addUser, as } from './shim.mjs'

let db, A, B, C, D
before(async () => {
  db = await newDb(); await applyAll(db)
  A = await addUser(db, 1, 'a'); B = await addUser(db, 2, 'b'); C = await addUser(db, 3, 'c'); D = await addUser(db, 4, 'd')
  // A–B বন্ধু; C → A রিকুয়েস্ট পেন্ডিং; D একা
  await db.exec(`insert into friendships (requester_id,addressee_id,status) values ('${A}','${B}','accepted'),('${C}','${A}','pending')`)
})
const isErr = (r) => r && r.error

test('প্রাইভেসি: only_me কেউ দেখে না; বন্ধু friends/public পোস্ট দেখে; অপরিচিত শুধু পাবলিক রিল/ভিডিও দেখে', async () => {
  await db.exec(`insert into posts (user_id,content,privacy) values ('${A}','me','only_me'),('${A}','fr','friends'),('${A}','pub','public')`)
  await db.exec(`insert into posts (user_id,content,privacy,kind) values ('${A}','reel','public','reel')`)
  const names = async (u) => (await as(db, u, `select content from posts where user_id='${A}' order by content`)).map((r) => r.content)
  assert.deepEqual(await names(A), ['fr', 'me', 'pub', 'reel'])
  assert.deepEqual(await names(B), ['fr', 'pub', 'reel'])
  assert.deepEqual(await names(D), ['reel'])
})

test('অন্যের নামে পোস্ট বানানো যায় না', async () => {
  const r = await as(db, D, `insert into posts (user_id,content) values ('${A}','fake') returning id`)
  assert.ok(isErr(r))
})

test('friendships: গ্রহণকারী শুধু pending→accepted করতে পারে', async () => {
  const ok = await as(db, A, `update friendships set status='accepted' where requester_id='${C}' and addressee_id='${A}' returning status`)
  assert.equal(ok[0]?.status, 'accepted')
})

test('friendships: requester_id বদলে ভুয়া বন্ধুত্ব বানানো ব্লক', async () => {
  await db.exec(`insert into friendships (requester_id,addressee_id,status) values ('${D}','${B}','pending')`)
  const r = await as(db, B, `update friendships set requester_id='${C}', status='accepted' where requester_id='${D}' and addressee_id='${B}'`)
  assert.ok(isErr(r), 'requester_id বদল আটকানো উচিত')
})

test('messages: প্রেরক পাঠানো মেসেজের receiver/content বদলাতে পারে না', async () => {
  await db.exec(`insert into messages (sender_id,receiver_id,content) values ('${A}','${B}','hello')`)
  const r1 = await as(db, A, `update messages set receiver_id='${D}' where sender_id='${A}'`)
  assert.ok(isErr(r1))
  const r2 = await as(db, A, `update messages set content='changed' where sender_id='${A}'`)
  assert.ok(isErr(r2))
})

test('messages: অপরিচিত দুজনের চ্যাট তৃতীয়জন পড়তে পারে না', async () => {
  assert.equal((await as(db, D, `select * from messages`)).length, 0)
  assert.equal((await as(db, B, `select * from messages`)).length, 1)
})

test('notifications: শুধু read কলাম বদলানো যায়', async () => {
  await db.exec(`insert into notifications (user_id,actor_id,type) values ('${B}','${A}','poke')`)
  const bad = await as(db, B, `update notifications set type='like' where user_id='${B}'`)
  assert.ok(isErr(bad))
  const ok = await as(db, B, `update notifications set read=true where user_id='${B}' returning read`)
  assert.equal(ok[0]?.read, true)
})

test('গ্রুপ: সদস্যের বন্ধু (পাবলিক গ্রুপে) গ্রুপের পোস্ট দেখে, অপরিচিত দেখে না', async () => {
  const g = (await as(db, A, `select create_group('G','x','public','{}'::uuid[]) as id`))[0].id
  await db.exec(`insert into posts (user_id,content,privacy,group_id) values ('${A}','gpost','public','${g}')`)
  const seen = async (u) => (await as(db, u, `select content from posts where group_id='${g}'`)).map((r) => r.content)
  assert.deepEqual(await seen(A), ['gpost'])
  assert.deepEqual(await seen(B), ['gpost'], 'A-এর বন্ধু B দেখবে')
  assert.deepEqual(await seen(D), [], 'অপরিচিত D দেখবে না')
})

test('গ্রুপ: অ-অ্যাডমিন সদস্য যোগ করতে পারে না', async () => {
  const g = (await as(db, A, `select create_group('G2','x','private','{}'::uuid[]) as id`))[0].id
  const r = await as(db, D, `select add_group_members_as('${g}', array['${D}']::uuid[], false)`)
  assert.ok(isErr(r))
})
