import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const uid = session?.user?.id
  const loadProfile = async () => {
    if (!uid) return setProfile(null)
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data)
  }
  useEffect(() => { loadProfile() }, [uid])

  return (
    <Ctx.Provider value={{ user: session?.user, profile, loading: session === undefined, refreshProfile: loadProfile }}>
      {children}
    </Ctx.Provider>
  )
}
