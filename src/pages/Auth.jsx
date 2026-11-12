import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'

export default function Auth() {
  const { user } = useAuth()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ full_name: '', username: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  if (user) return <Navigate to="/" replace />
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const google = async () => {
    setMsg('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    })
    if (error) setMsg(error.message)
  }

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('')
    const { error, data } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
      : await supabase.auth.signUp({
          email: f.email, password: f.password,
          options: { data: { full_name: f.full_name, username: f.username.toLowerCase().replace(/\s/g, '') } },
        })
    if (error) setMsg(error.message)
    else if (mode === 'signup' && !data.session) setMsg('ইমেইলে পাঠানো লিংকে ক্লিক করে একাউন্ট নিশ্চিত করুন, তারপর লগ-ইন করুন।')
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8">
        <div className="mb-5 grid h-20 w-20 place-items-center rounded-[28px] bg-gradient-to-br from-brand to-coral text-4xl font-extrabold text-white shadow-soft">আ</div>
        <h1 className="text-4xl font-extrabold leading-tight">আপনজনদের সাথে,<br />আপন ঠিকানায়</h1>
        <p className="mt-2 text-ink/60">পরিবার ও আত্মীয়দের জন্য ছোট্ট একটি সোশ্যাল স্পেস।</p>
      </div>
      <button type="button" onClick={google} className="btn-soft w-full shadow-soft ring-1 ring-ink/10">
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/>
          <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/>
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
        </svg>
        Google দিয়ে চালিয়ে যান
      </button>
      <div className="my-4 flex items-center gap-3 text-sm text-ink/40"><span className="h-px flex-1 bg-ink/10" />অথবা<span className="h-px flex-1 bg-ink/10" /></div>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && (<>
          <input className="input" placeholder="পূর্ণ নাম" required value={f.full_name} onChange={set('full_name')} />
          <input className="input" placeholder="ইউজারনেম (ইংরেজিতে)" required pattern="[A-Za-z0-9_.]{3,20}" value={f.username} onChange={set('username')} />
        </>)}
        <input className="input" type="email" placeholder="ইমেইল" required value={f.email} onChange={set('email')} />
        <input className="input" type="password" placeholder="পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)" required minLength={6} value={f.password} onChange={set('password')} />
        {msg && <p className="rounded-xl bg-white p-3 text-sm text-coral">{msg}</p>}
        <button disabled={busy} className="btn-primary w-full">{busy ? 'অপেক্ষা করুন…' : mode === 'login' ? 'লগ-ইন' : 'সাইন-আপ'}</button>
      </form>
      <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg('') }} className="mt-5 text-center font-semibold text-brand">
        {mode === 'login' ? 'নতুন? একাউন্ট খুলুন' : 'আগে থেকেই একাউন্ট আছে? লগ-ইন'}
      </button>
    </div>
  )
}
