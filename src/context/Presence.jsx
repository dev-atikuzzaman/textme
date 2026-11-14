import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './Auth'

const Ctx = createContext(null)
// অনলাইন আছে কিনা (Supabase Presence — কোনো SQL লাগে না)
export const usePresence = () => useContext(Ctx) || { online: new Set(), isOnline: () => false }

export function PresenceProvider({ children }) {
  const { user } = useAuth()
  const [online, setOnline] = useState(new Set())
  useEffect(() => {
    const ch = supabase.channel('apon-presence', { config: { presence: { key: user.id } } })
    ch.on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(ch.presenceState()))))
      .subscribe((s) => { if (s === 'SUBSCRIBED') ch.track({ at: Date.now() }) })
    return () => { supabase.removeChannel(ch) }
  }, [user.id])
  return <Ctx.Provider value={{ online, isOnline: (id) => online.has(id) }}>{children}</Ctx.Provider>
}
