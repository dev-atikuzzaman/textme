import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './Auth'

const Ctx = createContext(null)
// update-21.sql না চালানো থাকলেও অ্যাপ ভাঙবে না — শুধু সেভ কাজ করবে না
export const useSavedVideos = () => useContext(Ctx) || { ids: new Set(), list: [], ready: true, toggle: async () => ({ ok: false }) }

// ইউটিউব ভিডিও (শর্টস বা সাধারণ) সেভ: v = { id, title, channel }
export function SavedVideosProvider({ children }) {
  const { user } = useAuth()
  const [list, setList] = useState([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let off = false
    supabase.from('saved_videos').select('video_id,title,channel,created_at').order('created_at', { ascending: false })
      .then(({ data }) => { if (off) return; setList((data || []).map((x) => ({ id: x.video_id, title: x.title, channel: x.channel }))); setReady(true) })
    return () => { off = true }
  }, [user.id])

  const toggle = useCallback(async (v) => {
    const has = list.some((x) => x.id === v.id)
    setList((l) => (has ? l.filter((x) => x.id !== v.id) : [{ id: v.id, title: v.title || '', channel: v.channel || '' }, ...l]))
    const r = has
      ? await supabase.from('saved_videos').delete().match({ user_id: user.id, video_id: v.id })
      : await supabase.from('saved_videos').insert({ user_id: user.id, video_id: v.id, title: v.title || null, channel: v.channel || null })
    if (r.error) { setList((l) => (has ? [v, ...l] : l.filter((x) => x.id !== v.id))); return { ok: false } }
    return { ok: true, saved: !has }
  }, [list, user.id])

  const ids = new Set(list.map((x) => x.id))
  return <Ctx.Provider value={{ ids, list, ready, toggle }}>{children}</Ctx.Provider>
}
