import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowLeft, MailCheck } from '../lib/icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { APP_NAME, APP_TAGLINE } from '../lib/brand'
import BrandMark from '../components/BrandMark'
import PasswordInput from '../components/PasswordInput'

export default function Auth() {
  const { user } = useAuth()
  const [mode, setMode] = useState('login') // login | signup | forgot
  const [f, setF] = useState({ full_name: '', username: '', email: '', password: '', password2: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState('')
  if (user) return <Navigate to="/" replace />
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const go = (m) => { setMode(m); setMsg(''); setOk('') }

  const google = async () => {
    setMsg('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    })
    if (error) setMsg(error.message)
  }

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setOk('')
    if (mode === 'signup' && f.password !== f.password2) return setMsg('দুটি পাসওয়ার্ড মিলছে না')
    setBusy(true)
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: `${window.location.origin}/reset` })
      setBusy(false)
      if (error) return setMsg(error.message)
      return setOk('পাসওয়ার্ড রিসেট করার লিংক আপনার ইমেইলে পাঠানো হয়েছে। ইনবক্স (না পেলে স্প্যাম) দেখুন।')
    }
    const { error, data } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password })
      : await supabase.auth.signUp({
          email: f.email.trim(), password: f.password,
          options: { data: { full_name: f.full_name, username: f.username.toLowerCase().replace(/\s/g, '') } },
        })
    if (error) setMsg(/invalid login/i.test(error.message) ? 'ইমেইল বা পাসওয়ার্ড ভুল' : error.message)
    else if (mode === 'signup' && !data.session) setOk('ইমেইলে পাঠানো লিংকে ক্লিক করে একাউন্ট নিশ্চিত করুন, তারপর লগ-ইন করুন।')
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-8">
      <div className="mb-7">
        <BrandMark size={84} className="mb-4 drop-shadow-lg" />
        <h1 className="text-3xl font-extrabold leading-tight">{mode === 'forgot' ? 'পাসওয়ার্ড ভুলে গেছেন?' : <>{APP_NAME}<span className="block text-lg font-semibold text-fg/65">{APP_TAGLINE}</span></>}</h1>
        <p className="mt-2 text-fg/65">{mode === 'forgot' ? 'একাউন্টের ইমেইল দিন, আমরা পাসওয়ার্ড বদলানোর লিংক পাঠাব।' : 'পরিবার ও আত্মীয়দের জন্য ছোট্ট একটি সোশ্যাল স্পেস।'}</p>
          {mode !== 'forgot' && (() => { try { return !!localStorage.getItem('apon-invite') } catch { return false } })() && <p className="mt-3 rounded-2xl bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand">🎉 পরিবারের আমন্ত্রণ পেয়েছেন — লগইন বা একাউন্ট খুলুন, তারপর যোগ দেওয়া যাবে।</p>}
      </div>

      {mode !== 'forgot' && (<>
        <button type="button" onClick={google} className="btn-soft w-full bg-surface shadow-soft ring-1 ring-fg/10">
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/>
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          Google দিয়ে চালিয়ে যান
        </button>
        <div className="my-4 flex items-center gap-3 text-sm text-fg/65"><span className="h-px flex-1 bg-fg/15" />অথবা<span className="h-px flex-1 bg-fg/15" /></div>
      </>)}

      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && (<>
          <input className="input" placeholder="পূর্ণ নাম" required value={f.full_name} onChange={set('full_name')} />
          <input className="input" placeholder="ইউজারনেম (ইংরেজিতে, ইউনিক)" required pattern="[A-Za-z0-9_.]{3,20}" title="৩–২০ অক্ষর: a-z, 0-9, _ বা ." value={f.username} onChange={set('username')} />
        </>)}
        <input className="input" type="email" placeholder="ইমেইল" required autoComplete="email" value={f.email} onChange={set('email')} />
        {mode !== 'forgot' && <PasswordInput placeholder={mode === 'signup' ? 'পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)' : 'পাসওয়ার্ড'} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} />}
        {mode === 'signup' && <PasswordInput placeholder="পাসওয়ার্ড আবার লিখুন" required minLength={6} autoComplete="new-password" value={f.password2} onChange={set('password2')} />}
        {mode === 'signup' && f.password2 && f.password !== f.password2 && <p className="text-sm text-danger">দুটি পাসওয়ার্ড মিলছে না</p>}
        {mode === 'login' && <div className="text-right"><button type="button" onClick={() => go('forgot')} className="text-sm font-semibold text-brand">পাসওয়ার্ড ভুলে গেছেন?</button></div>}
        {msg && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{msg}</p>}
        {ok && <p className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm text-success"><MailCheck size={18} className="mt-0.5 shrink-0" />{ok}</p>}
        <button disabled={busy} className="btn-primary w-full">{busy ? 'অপেক্ষা করুন…' : mode === 'login' ? 'লগ-ইন' : mode === 'signup' ? 'সাইন-আপ' : 'রিসেট লিংক পাঠান'}</button>
      </form>
      {mode === 'forgot'
        ? <button onClick={() => go('login')} className="mt-5 flex items-center justify-center gap-2 font-semibold text-brand"><ArrowLeft size={18} />লগ-ইনে ফিরে যান</button>
        : <button onClick={() => go(mode === 'login' ? 'signup' : 'login')} className="mt-5 text-center font-semibold text-brand">{mode === 'login' ? 'নতুন? একাউন্ট খুলুন' : 'আগে থেকেই একাউন্ট আছে? লগ-ইন'}</button>}
    </div>
  )
}
