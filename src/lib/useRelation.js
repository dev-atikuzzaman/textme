import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../context/Auth'

// আমার ও অন্য একজনের সম্পর্ক: বন্ধুত্ব/রিকুয়েস্ট + ব্লক
export function useRelation(otherId) {
  const { user } = useAuth()
  const [rel, setRel] = useState(null)
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!otherId || otherId === user.id) return
    const me = user.id
    const [{ data: f }, { data: b }] = await Promise.all([
      supabase.from('friendships').select('*')
        .or(`and(requester_id.eq.${me},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${me})`).limit(1),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', me).eq('blocked_id', otherId).limit(1),
    ])
    setRel(f?.[0] || null); setBlocked(!!b?.length)
  }, [otherId, user.id])
  useEffect(() => { load() }, [load])

  const run = async (fn) => {
    setBusy(true)
    const { error } = await fn()
    setBusy(false)
    if (error) { alert(/blocked|policy|row-level/i.test(error.message) ? 'এই কাজটি করা যাচ্ছে না (ব্লক বা অনুমতি সমস্যা)' : error.message); return false }
    await load(); return true
  }
  const state = blocked ? 'blocked' : !rel ? 'none' : rel.status === 'accepted' ? 'friends' : rel.requester_id === user.id ? 'sent' : 'incoming'
  return {
    state, rel, busy, reload: load,
    send: () => run(() => supabase.from('friendships').insert({ requester_id: user.id, addressee_id: otherId })),
    cancel: () => run(() => supabase.from('friendships').delete().eq('id', rel.id)),      // পাঠানো রিকুয়েস্ট বাতিল / প্রাপ্ত রিকুয়েস্ট মুছা / আনফ্রেন্ড
    accept: () => run(() => supabase.from('friendships').update({ status: 'accepted' }).eq('id', rel.id)),
    poke: async () => { const ok = await run(() => supabase.rpc('poke_user', { p_user: otherId })); if (ok) alert('পোক পাঠানো হয়েছে 👉'); return ok },
    block: () => run(() => supabase.rpc('block_user', { p_user: otherId })),
    unblock: () => run(() => supabase.rpc('unblock_user', { p_user: otherId })),
  }
}
