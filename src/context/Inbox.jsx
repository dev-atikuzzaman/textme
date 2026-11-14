import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './Auth'

const Ctx = createContext(null)
// threads: { [অন্যজনের id]: { last, unread } }, unread = মোট আনরিড
export const useInbox = () => useContext(Ctx) || { threads: {}, unread: 0, reload: () => {} }

export function InboxProvider({ children }) {
  const { user } = useAuth()
  const [threads, setThreads] = useState({})
  const timer = useRef()

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('messages')
      .select('id,sender_id,receiver_id,content,type,created_at,read_at')
      .order('created_at', { ascending: false }).limit(400)
    if (error) return // update-13.sql চালানো না থাকলে ইনবক্স আগের মতোই থাকবে
    const t = {}
    for (const m of data || []) {
      const o = m.sender_id === user.id ? m.receiver_id : m.sender_id
      t[o] ||= { last: m, unread: 0 }
      if (m.receiver_id === user.id && !m.read_at) t[o].unread++
    }
    setThreads(t)
  }, [user.id])

  const reload = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(load, 250) }, [load])

  useEffect(() => {
    load()
    const ch = supabase.channel(`inbox-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, reload)
      .subscribe()
    return () => { supabase.removeChannel(ch); clearTimeout(timer.current) }
  }, [user.id, load, reload])

  const unread = Object.values(threads).reduce((n, t) => n + t.unread, 0)
  return <Ctx.Provider value={{ threads, unread, reload }}>{children}</Ctx.Provider>
}
