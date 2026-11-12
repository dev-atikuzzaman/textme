import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './Auth'
import { syncPush } from '../lib/push'

const Ctx = createContext(null)
export const useNotifs = () => useContext(Ctx)

export const NOTIF_TEXT = {
  like: 'আপনার পোস্টে লাইক দিয়েছেন',
  comment: 'আপনার পোস্টে কমেন্ট করেছেন',
  friend_request: 'আপনাকে ফ্রেন্ড রিকুয়েস্ট পাঠিয়েছেন',
  friend_accept: 'আপনার ফ্রেন্ড রিকুয়েস্ট গ্রহণ করেছেন',
}

export function NotifProvider({ children }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const path = useRef(pathname)
  path.current = pathname
  const [items, setItems] = useState([])
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications')
      .select('*, actor:profiles!actor_id(id,full_name,username,avatar_url)')
      .order('created_at', { ascending: false }).limit(50)
    setItems(data || [])
  }, [])

  const announce = useCallback((title, body, to) => {
    setToast({ title, body, to })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const markAllRead = useCallback(async () => {
    await supabase.from('notifications').update({ read: true }).eq('read', false)
    setItems((l) => l.map((n) => ({ ...n, read: true })))
  }, [])

  useEffect(() => {
    load()
    syncPush()
    const nameOf = async (id) => (await supabase.from('profiles').select('full_name').eq('id', id).single()).data?.full_name || 'কেউ'
    const ch = supabase.channel(`notif-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (p) => { load(); announce(await nameOf(p.new.actor_id), NOTIF_TEXT[p.new.type], '/notifications') })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        async (p) => {
          if (path.current === `/chat/${p.new.sender_id}`) return
          announce(await nameOf(p.new.sender_id), p.new.content, `/chat/${p.new.sender_id}`)
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user.id, load, announce])

  return (
    <Ctx.Provider value={{ items, unread: items.filter((n) => !n.read).length, markAllRead }}>
      {children}
      {toast && (
        <button onClick={() => { nav(toast.to); setToast(null) }}
          className="fixed inset-x-4 top-4 z-[90] mx-auto max-w-sm rounded-3xl bg-ink p-4 text-left text-white shadow-2xl">
          <p className="font-bold">{toast.title}</p>
          <p className="line-clamp-2 text-sm text-white/75">{toast.body}</p>
        </button>
      )}
    </Ctx.Provider>
  )
}
