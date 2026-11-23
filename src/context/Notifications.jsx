import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './Auth'
import { syncPush } from '../lib/push'
import { playDing } from '../lib/sound'
import { loadPrefs, TYPE_CAT, quietNow } from '../lib/notifPrefs'

const Ctx = createContext(null)
export const useNotifs = () => useContext(Ctx)

export const NOTIF_TEXT = {
  like: 'আপনার পোস্টে লাইক দিয়েছেন',
  comment: 'আপনার পোস্টে কমেন্ট করেছেন',
  reply: 'আপনার কমেন্টের উত্তর দিয়েছেন',
  friend_request: 'আপনাকে ফ্রেন্ড রিকুয়েস্ট পাঠিয়েছেন',
  friend_accept: 'আপনার ফ্রেন্ড রিকুয়েস্ট গ্রহণ করেছেন',
  post: 'নতুন পোস্ট করেছেন',
  group_post: 'আপনার গ্রুপে নতুন পোস্ট করেছেন',
  page_post: 'আপনার ফলো করা পেজে নতুন পোস্ট করেছেন',
  group_add: 'আপনাকে একটি গ্রুপে যোগ করেছেন',
  poke: 'আপনাকে পোক করেছেন 👉',
  group_call: 'গ্রুপ কল শুরু করেছেন 📞',
  invite_joined: 'আপনার আমন্ত্রণে যোগ দিয়েছেন — এখন আপনারা বন্ধু 🎉',
  birthday: 'আজ জন্মদিন পালন করছেন 🎂 — শুভেচ্ছা জানান',
  event_new: 'একটি নতুন অনুষ্ঠানের আয়োজন করেছেন 📅',
  event_reminder: 'আয়োজিত অনুষ্ঠানটি খুব কাছে 📅',
  album_add: 'আপনাকে একটি ফ্যামিলি অ্যালবামে যোগ করেছেন 📷',
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
    // নোটিফিকেশন সেটিংস: বন্ধ করা ধরনের ব্যানার/সাউন্ড আসে না; "চুপ থাকার সময়"-এ সাউন্ড বন্ধ
    let prefs = null
    const refreshPrefs = () => loadPrefs().then((p) => { prefs = p })
    refreshPrefs(); window.addEventListener('apon-prefs', refreshPrefs)
    const on = (cat) => !cat || prefs?.[cat] !== false
    const ding = (v) => { if (!quietNow(prefs)) playDing(v) }
    const nameOf = async (id) => (await supabase.from('profiles').select('full_name').eq('id', id).single()).data?.full_name || 'কেউ'
    const ch = supabase.channel(`notif-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (p) => {
          load()
          if (!on(TYPE_CAT[p.new.type])) return // এই ধরনের অ্যালার্ট ব্যবহারকারী বন্ধ রেখেছেন
          // গ্রুপ কলের রিং GroupCall নিজেই বাজায়, তাই আলাদা ডিং নয়
          if (p.new.type !== 'group_call') ding()
          announce(await nameOf(p.new.actor_id), NOTIF_TEXT[p.new.type], p.new.link || '/notifications')
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        async (p) => {
          if (p.new.type === 'call') return // কলের রিংটোন Call context বাজায়
          if (!on('n_messages')) return
          // চ্যাট খোলা থাকলেও নতুন মেসেজে হালকা সাউন্ড (WhatsApp-এর মতো), কিন্তু পপ-আপ নয়
          if (path.current === `/chat/${p.new.sender_id}`) { ding(0.5); return }
          ding()
          announce(await nameOf(p.new.sender_id), p.new.content, `/chat/${p.new.sender_id}`)
        })
      // গ্রুপ মেসেজ: RLS অনুযায়ী শুধু আপনার গ্রুপগুলোর মেসেজই আসে
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' },
        async (p) => {
          if (p.new.sender_id === user.id || !on('n_messages')) return
          const to = `/groups/${p.new.group_id}?tab=chat`
          if (path.current.startsWith(`/groups/${p.new.group_id}`)) { ding(0.5); return }
          ding()
          const [{ data: g }, who] = await Promise.all([
            supabase.from('groups').select('name').eq('id', p.new.group_id).maybeSingle(),
            nameOf(p.new.sender_id),
          ])
          announce(g?.name || 'গ্রুপ', `${who}: ${p.new.content ? String(p.new.content).slice(0, 100) : '📷 ছবি/ফাইল'}`, to)
        })
      .subscribe()
    return () => { supabase.removeChannel(ch); window.removeEventListener('apon-prefs', refreshPrefs) }
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
