import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { REACTIONS } from '../../lib/constants'
import Avatar from '../Avatar'

export default function ReactionsSheet({ table = 'likes', col = 'post_id', id, onClose }) {
  const [rows, setRows] = useState(null)
  const [tab, setTab] = useState('all')

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from(table).select('user_id,type').eq(col, id)
      const ids = (data || []).map((d) => d.user_id)
      let pm = {}
      if (ids.length) {
        const { data: ps } = await supabase.from('profiles').select('id,full_name,avatar_url').in('id', ids)
        pm = Object.fromEntries((ps || []).map((p) => [p.id, p]))
      }
      setRows((data || []).map((d) => ({ ...d, p: pm[d.user_id] })))
    })()
  }, [table, col, id])

  const shown = (rows || []).filter((r) => tab === 'all' || r.type === tab)
  const tabs = [{ id: 'all', emoji: 'সব', n: rows?.length || 0 }, ...REACTIONS.map((r) => ({ id: r.id, emoji: r.emoji, n: (rows || []).filter((x) => x.type === r.id).length })).filter((t) => t.n)]

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in flex max-h-[75vh] w-full max-w-md flex-col rounded-t-[32px] bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-2">
          <h2 className="text-lg font-bold">রিয়্যাকশন</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t.id ? 'bg-ink text-white' : 'bg-surface2'}`}>{t.emoji} {t.n}</button>
          ))}
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          {rows === null && <p className="py-6 text-center text-fg/50">লোড হচ্ছে…</p>}
          {rows?.length === 0 && <p className="py-6 text-center text-fg/60">এখনও কেউ রিয়্যাক্ট করেনি।</p>}
          {shown.map((r) => (
            <Link key={r.user_id} to={`/profile/${r.user_id}`} onClick={onClose} className="flex items-center gap-3 rounded-2xl p-2 active:bg-surface2">
              <Avatar p={r.p} size={44} />
              <b className="min-w-0 flex-1 truncate">{r.p?.full_name || 'ব্যবহারকারী'}</b>
              <span className="text-2xl">{REACTIONS.find((x) => x.id === r.type)?.emoji}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
