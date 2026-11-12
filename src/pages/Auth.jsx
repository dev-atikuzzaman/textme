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
