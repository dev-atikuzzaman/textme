import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Lock, Globe, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useFriends } from '../../lib/useFriends'
import Avatar from '../Avatar'

// WhatsApp/Facebook-এর মতো: নাম দিন, বন্ধুদের বাছুন, গ্রুপ তৈরি
export default function CreateGroupSheet({ onClose }) {
  const nav = useNavigate()
  const { friends, people, other } = useFriends()
  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [privacy, setPrivacy] = useState('private')
  const [sel, setSel] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const list = friends.map((r) => people[other(r)]).filter(Boolean)
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const create = async () => {
    if (!name.trim()) return setErr('গ্রুপের নাম দিন')
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('create_group', { p_name: name, p_about: about, p_privacy: privacy, p_members: [...sel] })
    setBusy(false)
    if (error) return setErr(/function|schema cache/i.test(error.message) ? 'update-14.sql চালানো হয়নি' : error.message)
    onClose(); nav(`/groups/${data}`)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div className="max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">নতুন গ্রুপ</h2>
          <button disabled={busy} onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        <input className="input" placeholder="গ্রুপের নাম" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className="input min-h-[70px]" placeholder="গ্রুপ সম্পর্কে (ঐচ্ছিক)" value={about} onChange={(e) => setAbout(e.target.value)} />
        <div className="flex gap-2">
          {[['private', Lock, 'প্রাইভেট', 'শুধু সদস্যরা দেখে'], ['public', Globe, 'পাবলিক', 'যে কেউ খুঁজে জয়েন করতে পারে']].map(([id, Icon, label, sub]) => (
            <button key={id} onClick={() => setPrivacy(id)} className={`flex-1 rounded-2xl p-3 text-left transition ${privacy === id ? 'bg-brand text-inverse' : 'bg-surface2'}`}>
              <span className="flex items-center gap-1.5 font-bold"><Icon size={16} />{label}</span>
              <span className={`text-xs ${privacy === id ? 'text-inverse/75' : 'text-fg/55'}`}>{sub}</span>
            </button>
          ))}
        </div>
        <p className="pt-1 text-sm font-bold text-fg/60">বন্ধুদের যোগ করুন ({sel.size.toLocaleString('bn-BD')})</p>
        {list.length === 0 && <p className="py-3 text-center text-sm text-fg/50">বন্ধু ছাড়াও গ্রুপ খোলা যায়, পরে যোগ করতে পারবেন।</p>}
        <div className="space-y-1">
          {list.map((p) => (
            <button key={p.id} onClick={() => toggle(p.id)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left active:bg-surface2">
              <Avatar p={p} size={40} /><span className="min-w-0 flex-1 truncate font-semibold">{p.full_name}</span>
              <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${sel.has(p.id) ? 'border-brand bg-brand text-inverse' : 'border-fg/25'}`}>{sel.has(p.id) && <Check size={14} strokeWidth={3} />}</span>
            </button>
          ))}
        </div>
        {err && <p className="rounded-xl bg-danger/15 p-3 text-sm text-danger">{err}</p>}
        <button disabled={busy} onClick={create} className="btn-primary w-full">{busy ? 'তৈরি হচ্ছে…' : 'গ্রুপ তৈরি করুন'}</button>
      </div>
    </div>
  )
}
