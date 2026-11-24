import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X, Plus, Images } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useFriends } from '../../lib/useFriends'
import { bn, tableMissing } from '../../lib/family'
import { toast, errMsg } from '../../lib/ui'
import Avatar from '../Avatar'
import SmartImg from '../SmartImg'

// নতুন অ্যালবাম: নাম + কাদের সাথে শেয়ার (শুধু বন্ধুদের)
function CreateAlbumSheet({ onClose, onCreated }) {
  const { friends, people, other } = useFriends()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [sel, setSel] = useState([])
  const [busy, setBusy] = useState(false)
  const list = friends.map((r) => people[other(r)]).filter(Boolean)
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const create = async () => {
    const t = title.trim(); if (!t) return toast.error('অ্যালবামের নাম লিখুন')
    setBusy(true)
    const { data: a, error } = await supabase.from('albums').insert({ title: t, description: desc.trim() || null }).select().single()
    if (error) { setBusy(false); return toast.error(tableMissing(error) ? 'চালু হয়নি — update-23.sql চালানো হয়নি' : errMsg(error)) }
    if (sel.length) {
      const { error: e2 } = await supabase.from('album_members').insert(sel.map((uid) => ({ album_id: a.id, user_id: uid })))
      if (e2) toast.error('কয়েকজনকে যোগ করা যায়নি — অ্যালবাম খুলে আবার যোগ করুন')
    }
    setBusy(false); toast.success('অ্যালবাম তৈরি হয়েছে 📷'); onCreated(a.id)
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/55 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="নতুন অ্যালবাম" onClick={(e) => e.stopPropagation()}
        className="pop-in max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">নতুন ফ্যামিলি অ্যালবাম</h2>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        <input className="input" placeholder="অ্যালবামের নাম (যেমন: ঈদ ২০২৬)" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input" placeholder="ছোট বর্ণনা (ঐচ্ছিক)" maxLength={200} value={desc} onChange={(e) => setDesc(e.target.value)} />
        <p className="font-bold">কাদের সাথে শেয়ার করবেন? <span className="text-sm font-normal text-fg/65">({bn(sel.length)} জন)</span></p>
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {list.length === 0 && <p className="text-sm text-fg/65">আগে আপনজনদের বন্ধু বানান বা আমন্ত্রণ জানান।</p>}
          {list.map((p) => (
            <button key={p.id} onClick={() => toggle(p.id)} aria-pressed={sel.includes(p.id)}
              className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left ${sel.includes(p.id) ? 'bg-brand/15 ring-2 ring-brand' : 'bg-surface2'}`}>
              <Avatar p={p} size={38} /><span className="min-w-0 flex-1 truncate font-semibold">{p.full_name}</span>
              <span className={`grid h-5 w-5 place-items-center rounded-full border-2 text-[11px] ${sel.includes(p.id) ? 'border-brand bg-brand text-inverse' : 'border-fg/30'}`}>{sel.includes(p.id) && '✓'}</span>
            </button>
          ))}
        </div>
        <button onClick={create} disabled={busy} className="btn-primary w-full">{busy ? 'তৈরি হচ্ছে…' : 'অ্যালবাম তৈরি করুন'}</button>
      </div>
    </div>
  )
}

// ট্যাব: আমার সব অ্যালবাম
export default function Albums() {
  const nav = useNavigate()
  const [list, setList] = useState(null)
  const [missing, setMissing] = useState(false)
  const [sheet, setSheet] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_albums')
    if (error) { setMissing(tableMissing(error)); setList([]); if (!tableMissing(error)) toast.error(errMsg(error)); return }
    setList(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  if (missing) return <p className="rounded-3xl bg-danger/10 p-4 text-sm text-danger">অ্যালবাম চালু করতে Supabase-এ update-23.sql একবার চালাতে হবে।</p>
  if (list === null) return <p className="py-10 text-center text-fg/65">লোড হচ্ছে…</p>
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold">📷 ফ্যামিলি অ্যালবাম</h3>
        <button onClick={() => setSheet(true)} className="btn-primary !px-3.5 !py-2 text-sm"><Plus size={16} />নতুন</button>
      </div>
      {list.length === 0 && (
        <div className="space-y-2 rounded-3xl bg-surface p-6 text-center shadow-soft">
          <Images size={36} className="mx-auto text-brand" />
          <p className="font-bold">এখনও কোনো অ্যালবাম নেই</p>
          <p className="text-sm text-fg/65">আপনজনদের নিয়ে একটি অ্যালবাম বানান। সবাই মিলে ছবি যোগ করতে পারবে।</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {list.map((a) => (
          <Link key={a.id} to={`/albums/${a.id}`} className="overflow-hidden rounded-3xl bg-surface shadow-soft active:scale-[0.98]">
            <div className="grid aspect-square place-items-center bg-surface2">
              {a.cover_url ? <SmartImg src={a.cover_url} alt="অ্যালবামের কভার" className="h-full w-full object-cover" /> : <Images size={34} className="text-fg/65" />}
            </div>
            <div className="p-3">
              <b className="block truncate">{a.title}</b>
              <span className="text-xs text-fg/65">{bn(a.photo_count)}টি ছবি • {bn(a.member_count)} জন</span>
            </div>
          </Link>
        ))}
      </div>
      {sheet && <CreateAlbumSheet onClose={() => setSheet(false)} onCreated={(id) => nav(`/albums/${id}`)} />}
    </div>
  )
}
