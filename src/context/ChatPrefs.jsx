import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './Auth'
import { toast, errMsg } from '../lib/ui'

// পিন / আর্কাইভ = অ্যাকাউন্টে সেভ (সব ডিভাইসে)। চ্যাট লক = এই ডিভাইসের PIN দিয়ে (WhatsApp-এর মতোই)।
const Ctx = createContext(null)
export const useChatPrefs = () => useContext(Ctx)

const LS_LOCKS = 'apon_locked_chats', LS_PIN = 'apon_chat_pin'
const rd = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }
const hash = async (pin) => {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('apon:' + pin))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export function ChatPrefsProvider({ children }) {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState({})            // key -> {pinned, archived}
  const [locks, setLocks] = useState(() => rd(LS_LOCKS, []))
  const [pinHash, setPinHash] = useState(() => rd(LS_PIN, null))
  const [open, setOpen] = useState(() => new Set()) // এই সেশনে আনলক করা

  useEffect(() => {
    supabase.from('chat_prefs').select('chat_key,pinned,archived').eq('user_id', user.id)
      .then(({ data }) => setPrefs(Object.fromEntries((data || []).map((r) => [r.chat_key, r]))))
  }, [user.id])

  // অ্যাপ ব্যাকগ্রাউন্ডে গেলে আবার লক
  useEffect(() => {
    const f = () => { if (document.hidden) setOpen(new Set()) }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  const setPref = useCallback(async (key, patch) => {
    const next = { chat_key: key, pinned: false, archived: false, ...prefs[key], ...patch }
    setPrefs((p) => ({ ...p, [key]: next }))
    const { error } = await supabase.from('chat_prefs').upsert({ user_id: user.id, chat_key: key, pinned: next.pinned, archived: next.archived, updated_at: new Date().toISOString() })
    if (error) toast.error(/relation|does not exist|schema cache/i.test(error.message || '') ? 'সেভ করা যায়নি — update-15.sql চালানো হয়েছে কি?' : errMsg(error, 'সেভ করা যায়নি — আবার চেষ্টা করুন'))
  }, [prefs, user.id])

  const value = useMemo(() => ({
    isPinned: (k) => !!prefs[k]?.pinned,
    isArchived: (k) => !!prefs[k]?.archived,
    pinnedCount: Object.values(prefs).filter((p) => p.pinned).length,
    setPref,
    hasPin: !!pinHash,
    isLocked: (k) => locks.includes(k),
    isOpen: (k) => open.has(k),
    lockedCount: locks.length,
    setPin: async (pin) => { const h = await hash(pin); wr(LS_PIN, h); setPinHash(h) },
    verify: async (pin) => (await hash(pin)) === pinHash,
    lock: (k) => { const l = [...new Set([...locks, k])]; setLocks(l); wr(LS_LOCKS, l) },
    unlock: (k) => { const l = locks.filter((x) => x !== k); setLocks(l); wr(LS_LOCKS, l) },
    unlockSession: (k) => setOpen((s) => new Set(s).add(k)),
  }), [prefs, locks, pinHash, open, setPref])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
