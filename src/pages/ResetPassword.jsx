import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, KeyRound } from '../lib/icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import PasswordInput from '../components/PasswordInput'

// ইমেইলের রিসেট লিংকে ক্লিক করলে এখানে আসে (/reset)
export default function ResetPassword() {
  const { user, loading } = useAuth()
  const nav = useNavigate()
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (pw.length < 6) return setErr('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে')
    if (pw !== pw2) return setErr('দুটি পাসওয়ার্ড মিলছে না')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr(/different/i.test(error.message) ? 'নতুন পাসওয়ার্ড আগেরটি থেকে আলাদা হতে হবে' : error.message)
    setDone(true); setTimeout(() => nav('/', { replace: true }), 1800)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-brand to-coral text-inverse shadow-soft"><KeyRound size={30} /></div>
      <h1 className="text-3xl font-extrabold">নতুন পাসওয়ার্ড দিন</h1>
      {loading ? <p className="mt-6 text-fg/65">যাচাই হচ্ছে…</p> : !user ? (
        <div className="mt-4 space-y-4">
          <p className="rounded-2xl bg-danger/10 p-4 text-danger">লিংকটির মেয়াদ শেষ বা আগেই ব্যবহার হয়ে গেছে। আবার "পাসওয়ার্ড ভুলে গেছেন?" থেকে নতুন লিংক নিন।</p>
          <Link to="/auth" className="btn-primary w-full">লগ-ইন পেজে যান</Link>
        </div>
      ) : done ? (
        <p className="mt-6 flex items-center gap-2 rounded-2xl bg-success/10 p-4 font-semibold text-success"><CheckCircle2 />পাসওয়ার্ড বদলানো হয়েছে। অ্যাপে নিয়ে যাচ্ছি…</p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <PasswordInput placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <PasswordInput placeholder="নতুন পাসওয়ার্ড আবার লিখুন" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          {pw2 && pw !== pw2 && <p className="text-sm text-danger">দুটি পাসওয়ার্ড মিলছে না</p>}
          {err && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <button disabled={busy} className="btn-primary w-full">{busy ? 'অপেক্ষা করুন…' : 'পাসওয়ার্ড বদলান'}</button>
        </form>
      )}
    </div>
  )
}
