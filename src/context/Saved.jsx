import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './Auth'

const Ctx = createContext(null)
// update-12.sql না চালানো থাকলেও অ্যাপ ভাঙবে না — শুধু সেভ কাজ করবে না
export const useSaved = () => useContext(Ctx) || { ids: new Set(), ready: true, toggle: async () => ({ ok: false }) }

export function SavedProvider({ children }) {
  const { user } = useAuth()
  const [ids, setIds] = useState(new Set())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let off = false
    supabase.from('saved_posts').select('post_id').then(({ data }) => {
      if (off) return
      setIds(new Set((data || []).map((x) => x.post_id)))
      setReady(true)
    })
    return () => { off = true }
  }, [user.id])

  const toggle = useCallback(async (postId) => {
    const has = ids.has(postId)
    const flip = (on) => setIds((s) => { const n = new Set(s); on ? n.add(postId) : n.delete(postId); return n })
    flip(!has)
    const r = has
      ? await supabase.from('saved_posts').delete().match({ user_id: user.id, post_id: postId })
      : await supabase.from('saved_posts').insert({ user_id: user.id, post_id: postId })
    if (r.error) { flip(has); return { ok: false } }
    return { ok: true, saved: !has }
  }, [ids, user.id])

  return <Ctx.Provider value={{ ids, ready, toggle }}>{children}</Ctx.Provider>
}
