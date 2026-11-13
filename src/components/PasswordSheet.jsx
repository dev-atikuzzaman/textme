import { useState } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'

export default function PasswordSheet({ onClose }) {
  const { user } = useAuth()
  const hasPw = user.app_metadata?.providers?.includes('email')
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const type = show ? 'text' : 'password'

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (pw.length < 6) return setErr('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে')
    if (pw !== pw2) return setErr('দুটি পাসওয়ার্ড মিলছে না')
    setBusy(true)
    if (hasPw) {
      if (!cur) { setBusy(false); return setErr('বর্তমান পাসওয়ার্ড দিন') }
      if (cur === pw) { setBusy(false); return setErr('নতুন পাসওয়ার্ড বর্তমানটি থেকে আলাদা হতে হবে') }
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: cur })
      if (error) { setBusy(false); return setErr('বর্তমান পাসওয়ার্ড ভুল') }
    }
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr(/different/i.test(error.message) ? 'নতুন পাসওয়ার্ড আগেরটি থেকে আলাদা হতে হবে' : error.message)
    setOk(true); setTimeout(onClose, 1500)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-t-[32px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">পাসওয়ার্ড পরিবর্তন</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-mist"><X size={18} /></button>
        </div>
        {!hasPw && <p className="rounded-2xl bg-mist p-3 text-sm text-ink/70">আপনি Google দিয়ে ঢুকেছেন। এখানে পাসওয়ার্ড সেট করলে ইমেইল ও পাসওয়ার্ড দিয়েও লগ-ইন করা যাবে।</p>}
        {hasPw && <input className="input" type={type} placeholder="বর্তমান পাসওয়ার্ড" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />}
        <input className="input" type={type} placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input className="input" type={type} placeholder="নতুন পাসওয়ার্ড আবার লিখুন" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {pw2 && pw !== pw2 && <p className="text-sm text-coral">দুটি পাসওয়ার্ড মিলছে না</p>}
        <button type="button" onClick={() => setShow(!show)} className="flex items-center gap-2 text-sm font-semibold text-brand">{show ? <EyeOff size={16} /> : <Eye size={16} />}{show ? 'লুকান' : 'পাসওয়ার্ড দেখুন'}</button>
        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{err}</p>}
        {ok && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">পাসওয়ার্ড পরিবর্তন হয়েছে ✓</p>}
        <button disabled={busy || ok} className="btn-primary w-full">{busy ? 'অপেক্ষা করুন…' : 'পাসওয়ার্ড বদলান'}</button>
      </form>
    </div>
  )
}
