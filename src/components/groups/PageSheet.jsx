import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/Auth'

export const PAGE_CATEGORIES = ['ব্যক্তিগত ব্লগ', 'ব্যবসা', 'শিক্ষা', 'সংবাদ', 'বিনোদন', 'প্রযুক্তি', 'ধর্ম', 'খেলাধুলা', 'সংগঠন', 'অন্যান্য']

// পেজ তৈরি (page = null) বা এডিট (page দিলে)
export default function PageSheet({ page, onClose, onDone }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ name: page?.name || '', category: page?.category || PAGE_CATEGORIES[0], about: page?.about || '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!f.name.trim()) return setErr('পেজের নাম দিন')
    setBusy(true); setErr('')
    const row = { name: f.name.trim(), category: f.category, about: f.about.trim() || null }
    const r = page
      ? await supabase.from('pages').update(row).eq('id', page.id).select().single()
      : await supabase.from('pages').insert({ ...row, owner_id: user.id }).select().single()
    setBusy(false)
    if (r.error) return setErr(/relation|schema cache|does not exist/i.test(r.error.message) ? 'update-14.sql চালানো হয়নি' : r.error.message)
    onDone?.(); onClose()
    if (!page) nav(`/pages/${r.data.id}`)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div className="max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{page ? 'পেজ এডিট' : 'নতুন পেজ'}</h2>
          <button disabled={busy} onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button></div>
        <input className="input" placeholder="পেজের নাম" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {PAGE_CATEGORIES.map((c) => <button key={c} onClick={() => setF({ ...f, category: c })} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${f.category === c ? 'bg-ink text-white' : 'bg-surface2'}`}>{c}</button>)}
        </div>
        <textarea className="input min-h-[100px]" placeholder="পেজ সম্পর্কে লিখুন" value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} />
        {err && <p className="rounded-xl bg-danger/15 p-3 text-sm text-danger">{err}</p>}
        <button disabled={busy} onClick={save} className="btn-primary w-full">{busy ? 'অপেক্ষা করুন…' : page ? 'সেভ করুন' : 'পেজ তৈরি করুন'}</button>
      </div>
    </div>
  )
}
