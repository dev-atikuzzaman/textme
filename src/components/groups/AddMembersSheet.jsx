import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useFriends } from '../../lib/useFriends'
import Avatar from '../Avatar'

export default function AddMembersSheet({ groupId, memberIds, onClose, onDone }) {
  const { friends, people, other } = useFriends()
  const [sel, setSel] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [asAdmin, setAsAdmin] = useState(false)
  const [err, setErr] = useState('')
  const list = friends.map((r) => people[other(r)]).filter((p) => p && !memberIds.includes(p.id))
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const add = async () => {
    if (!sel.size) return
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('add_group_members_as', { p_group: groupId, p_members: [...sel], p_admin: asAdmin })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone?.(); onClose()
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">সদস্য যোগ করুন</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button></div>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-brand/10 p-3">
          <input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--brand))]" />
          <span className="min-w-0 flex-1"><b className="block">অ্যাডমিন হিসেবে যোগ করুন</b><span className="text-xs text-fg/60">তারাও অন্য বন্ধুদের যোগ করতে ও অ্যাডমিন বানাতে পারবেন</span></span>
        </label>
        {list.length === 0 && <p className="py-6 text-center text-sm text-fg/55">যোগ করার মতো আর কোনো বন্ধু নেই।</p>}
        {list.map((p) => (
          <button key={p.id} onClick={() => toggle(p.id)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left active:bg-surface2">
            <Avatar p={p} size={40} /><span className="min-w-0 flex-1 truncate font-semibold">{p.full_name}</span>
            <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${sel.has(p.id) ? 'border-brand bg-brand text-inverse' : 'border-fg/25'}`}>{sel.has(p.id) && <Check size={14} strokeWidth={3} />}</span>
          </button>
        ))}
        {err && <p className="rounded-xl bg-danger/15 p-3 text-sm text-danger">{err}</p>}
        <button disabled={busy || !sel.size} onClick={add} className="btn-primary w-full disabled:opacity-50">{busy ? 'যোগ হচ্ছে…' : `${asAdmin ? 'অ্যাডমিন হিসেবে যোগ করুন' : 'যোগ করুন'} (${sel.size.toLocaleString('bn-BD')})`}</button>
      </div>
    </div>
  )
}
