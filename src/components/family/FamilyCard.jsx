import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/Auth'
import { KIND, nextBirthday, dayWord, eventDays, fmtTime, bn } from '../../lib/family'

// হোম ফিডের ওপরে: আজকের জন্মদিন, আসন্ন (৭ দিন) জন্মদিন ও অনুষ্ঠান। কিছু না থাকলে (প্রথমবার) ছোট পরিচিতি কার্ড
export default function FamilyCard() {
  const { user, profile } = useAuth()
  const [data, setData] = useState(null)
  const [seen, setSeen] = useState(() => { try { return !!localStorage.getItem('apon-family-seen') } catch { return true } })

  useEffect(() => {
    let off = false
    const since = new Date(); since.setHours(0, 0, 0, 0)
    Promise.all([
      supabase.from('birthdays').select('*, profiles(id, full_name)'),
      supabase.from('family_events').select('id, title, kind, starts_at').gte('starts_at', since.toISOString()).order('starts_at').limit(10),
    ]).then(([b, e]) => { if (!off) setData(b.error || e.error ? { off: true } : { bds: b.data || [], evs: e.data || [] }) })
    return () => { off = true }
  }, [])

  if (!data) return null
  const bds = (data.bds || []).map((b) => ({ ...b, ...nextBirthday(b) })).filter((b) => b.days <= 7).sort((a, b) => a.days - b.days)
  const evs = (data.evs || []).map((e) => ({ ...e, days: eventDays(e.starts_at) })).filter((e) => e.days <= 7)
  const rows = bds.length + evs.length

  if (data.off || (rows === 0 && seen)) return null
  if (rows === 0) {
    return (
      <div className="relative flex items-center gap-3 rounded-3xl bg-gradient-to-r from-brand/12 to-coral/12 p-4">
        <span className="text-3xl" aria-hidden="true">🌳</span>
        <Link to="/family" className="min-w-0 flex-1"><b className="block">পরিবার</b><span className="text-sm text-fg/65">ফ্যামিলি ট্রি, জন্মদিন, অনুষ্ঠান, অ্যালবাম ও আপনজনদের আমন্ত্রণ — এক জায়গায় →</span></Link>
        <button onClick={() => { try { localStorage.setItem('apon-family-seen', '1') } catch { /* ignore */ } setSeen(true) }} aria-label="বন্ধ করুন" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface/70"><X size={16} /></button>
      </div>
    )
  }
  return (
    <div className="space-y-2 rounded-3xl bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between"><b className="text-lg">🌳 পরিবার</b><Link to="/family?tab=events" className="text-sm font-bold text-brand">সব দেখুন →</Link></div>
      {bds.slice(0, 3).map((b) => (
        <div key={b.user_id} className="flex items-center gap-2 text-[15px]">
          <span aria-hidden="true">🎂</span>
          <span className="min-w-0 flex-1">
            {b.user_id === user.id ? (b.days === 0 ? <b>শুভ জন্মদিন, {profile?.full_name}! 🎉</b> : <span>আপনার জন্মদিন {dayWord(b.days)}</span>) : <span><b>{b.profiles?.full_name}</b>-এর জন্মদিন {dayWord(b.days)}{b.turning && b.days === 0 ? ` (${bn(b.turning)} বছর)` : ''}</span>}
          </span>
          {b.days === 0 && b.user_id !== user.id && <Link to={`/chat/${b.user_id}`} className="shrink-0 rounded-full bg-coral/15 px-3 py-1 text-sm font-bold text-coral">শুভেচ্ছা</Link>}
        </div>
      ))}
      {evs.slice(0, 3).map((e) => (
        <Link key={e.id} to={`/family?tab=events&event=${e.id}`} className="flex items-center gap-2 text-[15px]">
          <span aria-hidden="true">{KIND[e.kind]?.emoji || '📅'}</span>
          <span className="min-w-0 flex-1 truncate"><b>{e.title}</b> • {dayWord(e.days)}, {fmtTime(e.starts_at)}</span>
        </Link>
      ))}
    </div>
  )
}
