import { useEffect, useState } from 'react'
import { X, Check, AlertCircle, BadgeCheck, Mail, Phone, AtSign, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'

const normPhone = (v) => {
  let d = (v || '').replace(/[^0-9]/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = '88' + d // বাংলাদেশি 01XXXXXXXXX → 8801XXXXXXXXX
  return d
}
const showPhone = (d) => (d ? '+' + d : '')

// প্রোফাইল এডিট: নাম, ইউনিক ইউজারনেম, বায়ো, যাচাই করা ইমেইল, ফোন, "খোঁজা যাবে" সেটিং
export default function ProfileEditSheet({ profile, onClose, onSaved }) {
  const { user } = useAuth()
  const [f, setF] = useState({ full_name: profile.full_name || '', username: profile.username || '', bio: profile.bio || '', phone: '', discoverable: true })
  const [orig, setOrig] = useState('')
  const [uname, setUname] = useState('idle') // idle | checking | ok | taken | bad
  const [email, setEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('user_contacts').select('phone,discoverable').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) { setF((x) => ({ ...x, phone: showPhone(data.phone), discoverable: data.discoverable })); setOrig(data.phone || '') }
    })
  }, [user.id])

  // ইউজারনেম: লিখতে লিখতেই আছে কিনা চেক
  useEffect(() => {
    const u = f.username.trim()
    if (u.toLowerCase() === (profile.username || '').toLowerCase()) return setUname('idle')
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(u)) return setUname('bad')
    setUname('checking')
    let off = false
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', { u })
      if (!off) setUname(error ? 'idle' : data ? 'ok' : 'taken')
    }, 400)
    return () => { off = true; clearTimeout(t) }
  }, [f.username, profile.username])

  const changeEmail = async () => {
    setEmailMsg(null)
    const e = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(e)) return setEmailMsg({ bad: true, t: 'সঠিক ইমেইল দিন' })
    if (e === (user.email || '').toLowerCase()) return setEmailMsg({ bad: true, t: 'এটাই এখন আপনার ইমেইল' })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ email: e }, { emailRedirectTo: window.location.origin })
    setBusy(false)
    setEmailMsg(error ? { bad: true, t: error.message } : { t: `${e} ঠিকানায় যাচাইকরণ লিংক গেছে। লিংকে ক্লিক করলেই ইমেইল বদলাবে (সেটিংসে "Secure email change" চালু থাকলে পুরনো ইমেইলেও একটি লিংক যাবে)।` })
    if (!error) setEmail('')
  }

  const save = async () => {
    setErr('')
    if (!f.full_name.trim()) return setErr('নাম খালি রাখা যাবে না')
    if (uname === 'taken' || uname === 'bad') return setErr('ইউজারনেমটি ঠিক করুন')
    if (uname === 'checking') return setErr('ইউজারনেম যাচাই হচ্ছে, একটু অপেক্ষা করুন')
    const ph = normPhone(f.phone)
    if (f.phone.trim() && (ph.length < 10 || ph.length > 15)) return setErr('ফোন নম্বর সঠিক নয় (যেমন 01712345678)')
    setBusy(true)
    const { error: e1 } = await supabase.from('profiles').update({ full_name: f.full_name.trim(), username: f.username.trim(), bio: f.bio.trim() || null }).eq('id', user.id)
    if (e1) { setBusy(false); return setErr(e1.code === '23505' ? 'এই ইউজারনেম অন্য কেউ নিয়ে ফেলেছে' : e1.message) }
    const { error: e2 } = await supabase.from('user_contacts').upsert({ user_id: user.id, phone: ph || null, discoverable: f.discoverable })
    setBusy(false)
    if (e2) return setErr(e2.code === '23505' ? 'এই ফোন নম্বর অন্য একাউন্টে আছে' : e2.message)
    onSaved(); onClose()
  }

  const verified = !!user.email_confirmed_at
  const hint = {
    checking: <span className="flex items-center gap-1 text-fg/50"><Loader2 size={14} className="animate-spin" />যাচাই হচ্ছে…</span>,
    ok: <span className="flex items-center gap-1 text-success"><Check size={14} />ইউজারনেমটি পাওয়া যাবে</span>,
    taken: <span className="flex items-center gap-1 text-danger"><AlertCircle size={14} />এই ইউজারনেম আগে থেকেই আছে</span>,
    bad: <span className="flex items-center gap-1 text-danger"><AlertCircle size={14} />৩–২০ অক্ষর, শুধু a-z, 0-9, _ ও .</span>,
    idle: null,
  }[uname]

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">প্রোফাইল এডিট</h2><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button></div>

        <div className="space-y-3">
          <label className="block"><span className="mb-1 block text-sm font-semibold text-fg/70">নাম</span>
            <input className="input" value={f.full_name} maxLength={60} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></label>

          <label className="block"><span className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-fg/70"><AtSign size={15} />ইউজারনেম (ইউনিক)</span>
            <input className="input" value={f.username} maxLength={20} autoCapitalize="none" autoCorrect="off" onChange={(e) => setF({ ...f, username: e.target.value.replace(/\s/g, '') })} />
            <span className="mt-1 block min-h-5 text-xs">{hint}</span></label>

          <label className="block"><span className="mb-1 block text-sm font-semibold text-fg/70">বায়ো</span>
            <textarea className="input min-h-[80px]" maxLength={200} placeholder="নিজের সম্পর্কে লিখুন" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></label>

          <div className="rounded-2xl bg-surface2 p-3.5">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-fg/70"><Mail size={15} />ইমেইল</p>
            <p className="flex flex-wrap items-center gap-2 break-all font-semibold">{user.email}
              {verified ? <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success"><BadgeCheck size={13} />যাচাই করা</span> : <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">যাচাই হয়নি</span>}</p>
            {user.new_email && <p className="mt-1 text-xs text-amber-700">অপেক্ষমাণ: {user.new_email} — ইমেইলের লিংকে ক্লিক করে নিশ্চিত করুন</p>}
            <div className="mt-3 flex gap-2"><input className="input !py-2.5" type="email" placeholder="নতুন ইমেইল" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="button" disabled={busy || !email} onClick={changeEmail} className="btn-soft shrink-0 bg-surface !px-4 text-sm ring-1 ring-fg/10">যাচাই করুন</button></div>
            {emailMsg && <p className={`mt-2 text-xs ${emailMsg.bad ? 'text-danger' : 'text-success'}`}>{emailMsg.t}</p>}
          </div>

          <label className="block"><span className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-fg/70"><Phone size={15} />মোবাইল নম্বর</span>
            <input className="input" type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <span className="mt-1 block text-xs text-fg/50">নম্বর কাউকে দেখানো হয় না। ওটিপি দিয়ে যাচাই করা হয় না।</span></label>

          <label className="flex items-start gap-3 rounded-2xl bg-surface2 p-3.5">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" checked={f.discoverable} onChange={(e) => setF({ ...f, discoverable: e.target.checked })} />
            <span><b className="block text-sm">ইমেইল/ফোন দিয়ে আমাকে খোঁজা যাবে</b><span className="text-xs text-fg/55">বন্ধ করলে কেউ আমার ইমেইল বা নম্বর লিখে আমাকে পাবে না (নাম/ইউজারনেমে পাবে)।</span></span>
          </label>

          {err && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{err}</p>}
          <button disabled={busy} onClick={save} className="btn-primary w-full">{busy ? 'সেভ হচ্ছে…' : 'সেভ করুন'}</button>
        </div>
      </div>
    </div>
  )
}
