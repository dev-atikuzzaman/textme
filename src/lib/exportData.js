import { supabase } from './supabase'

// "আমার ডেটা ডাউনলোড": নিজের প্রোফাইল, পোস্ট, কমেন্ট, মেসেজ ইত্যাদি একটি JSON ফাইলে (ডিভাইসে নামে, কোথাও আপলোড হয় না)
const PAGE = 1000
async function fetchAll(table, build, order) {
  const all = []
  for (let from = 0; ; from += PAGE) {
    let q = build(supabase.from(table).select('*'))
    if (order) q = q.order(order, { ascending: true })
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) return { error }
    all.push(...(data || []))
    if ((data || []).length < PAGE) break
  }
  return { data: all }
}

export async function exportMyData(user, onStep) {
  const id = user.id
  const jobs = [
    ['profile', 'profiles', (q) => q.eq('id', id)],
    ['posts', 'posts', (q) => q.eq('user_id', id), 'created_at'],
    ['comments', 'comments', (q) => q.eq('user_id', id), 'created_at'],
    ['likes', 'likes', (q) => q.eq('user_id', id)],
    ['stories', 'stories', (q) => q.eq('user_id', id), 'created_at'],
    ['friendships', 'friendships', (q) => q.or(`requester_id.eq.${id},addressee_id.eq.${id}`), 'created_at'],
    ['messages', 'messages', (q) => q.or(`sender_id.eq.${id},receiver_id.eq.${id}`), 'created_at'],
    ['group_messages', 'group_messages', (q) => q.eq('sender_id', id), 'created_at'],
    ['saved_posts', 'saved_posts', (q) => q.eq('user_id', id)],
    ['blocks', 'blocks', (q) => q.eq('blocker_id', id)],
  ]
  const out = { exported_at: new Date().toISOString(), account: { id, email: user.email || null } }
  const errors = {}, counts = {}
  for (const [name, table, build, order] of jobs) {
    onStep?.(name)
    const r = await fetchAll(table, build, order)
    if (r.error) { errors[name] = r.error.message; continue }
    out[name] = name === 'profile' ? r.data[0] || null : r.data
    counts[name] = r.data.length
  }
  if (Object.keys(errors).length) out.errors = errors

  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `apon-data-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return counts
}
