import { supabase } from './supabase'

// পোস্টের সাথে গ্রুপ/পেজের নাম জুড়ে দেয় (update-14.sql না চালানো থাকলে চুপচাপ আগের মতোই থাকে)
export async function withContext(posts) {
  const list = posts || []
  const pids = [...new Set(list.map((p) => p.page_id).filter(Boolean))]
  const gids = [...new Set(list.map((p) => p.group_id).filter(Boolean))]
  if (!pids.length && !gids.length) return list
  const [pg, gr] = await Promise.all([
    pids.length ? supabase.from('pages').select('id,name,avatar_url').in('id', pids) : { data: [] },
    gids.length ? supabase.from('groups').select('id,name').in('id', gids) : { data: [] },
  ])
  const P = Object.fromEntries((pg.data || []).map((x) => [x.id, { ...x, full_name: x.name }]))
  const G = Object.fromEntries((gr.data || []).map((x) => [x.id, x]))
  return list.map((p) => ({ ...p, page: P[p.page_id], group: G[p.group_id] }))
}
