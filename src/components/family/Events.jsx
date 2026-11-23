import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { X, Plus, MapPin, Trash2, Cake, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/Auth'
import { MONTHS, EVENT_KINDS, KIND, RSVP, bn, daysIn, nextBirthday, dayWord, fmtDate, fmtTime, eventDays, tableMissing } from '../../lib/family'
import { toast, confirmDialog, errMsg } from '../../lib/ui'
import Avatar from '../Avatar'

const pad = (n) => String(n).padStart(2, '0')
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/55 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="pop-in max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------- নিজের জন্মদিন ঠিক করা ----------
function BirthdaySheet({ current, onClose, onSaved }) {
  const { user } = useAuth()
  const [month, setMonth] = useState(current?.month || 1)
  const [day, setDay] = useState(current?.day || 1)
  const [year, setYear] = useState(current?.year || '')
  const [busy, setBusy] = useState(false)
  const max = daysIn(month)

  const save = async () => {
    const y = year === '' ? null : Number(year)
    if (y !== null && (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear())) return toast.error('সালটি ঠিক নয় (ফাঁকা রাখলেও চলবে)')
    setBusy(true)
    const { error } = await supabase.from('birthdays').upsert({ user_id: user.id, month, day: Math.min(day, max), year: y, updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) return toast.error(tableMissing(error) ? 'চালু হয়নি — update-23.sql চালানো হয়নি' : errMsg(error))
    toast.success('জন্মদিন সেভ হয়েছে 🎂'); onSaved(); onClose()
  }
  const remove = async () => {
    const { error } = await supabase.from('birthdays').delete().eq('user_id', user.id)
    if (error) return toast.error(errMsg(error))
    toast.success('জন্মদিন সরানো হয়েছে'); onSaved(); onClose()
  }
  return (
    <Sheet title="আমার জন্মদিন" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold">মাস
          <select className="input mt-1" value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        </label>
        <label className="block text-sm font-semibold">তারিখ
          <select className="input mt-1" value={Math.min(day, max)} onChange={(e) => setDay(Number(e.target.value))}>{Array.from({ length: max }, (_, i) => <option key={i} value={i + 1}>{bn(i + 1)}</option>)}</select>
        </label>
      </div>
      <label className="block text-sm font-semibold">সাল (ঐচ্ছিক — দিলে বয়স দেখানো যাবে)
        <input className="input mt-1" inputMode="numeric" maxLength={4} placeholder="যেমন 1990" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} />
      </label>
      <p className="text-xs text-fg/55">শুধু আপনার বন্ধুরা এটি দেখতে পাবে। জন্মদিনে তাদের কাছে রিমাইন্ডার যাবে।</p>
      <div className="flex gap-3">
        {current && <button onClick={remove} className="btn-soft !text-danger">সরান</button>}
        <button onClick={save} disabled={busy} className="btn-primary flex-1">{busy ? 'সেভ হচ্ছে…' : 'সেভ করুন'}</button>
      </div>
    </Sheet>
  )
}

// ---------- নতুন অনুষ্ঠান ----------
function EventSheet({ onClose, onSaved }) {
  const { user } = useAuth()
  const tomorrow = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return d }, [])
  const [kind, setKind] = useState('gathering')
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState(localInput(tomorrow))
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [groupId, setGroupId] = useState('')
  const [groups, setGroups] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => { supabase.from('group_members').select('groups(id,name)').eq('user_id', user.id).then(({ data }) => setGroups((data || []).map((r) => r.groups).filter(Boolean))) }, [user.id])

  const save = async () => {
    const t = title.trim(); if (!t) return toast.error('অনুষ্ঠানের নাম লিখুন')
    const at = new Date(when); if (Number.isNaN(at.getTime())) return toast.error('তারিখ ও সময় দিন')
    setBusy(true)
    const { error } = await supabase.from('family_events').insert({ kind, title: t, starts_at: at.toISOString(), place: place.trim() || null, note: note.trim() || null, group_id: groupId || null })
    setBusy(false)
    if (error) return toast.error(tableMissing(error) ? 'চালু হয়নি — update-23.sql চালানো হয়নি' : errMsg(error))
    toast.success('অনুষ্ঠান যোগ হয়েছে — সবাইকে জানানো হয়েছে 🎉'); onSaved(); onClose()
  }
  return (
    <Sheet title="নতুন অনুষ্ঠান" onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        {EVENT_KINDS.map((k) => (
          <button key={k.id} onClick={() => { setKind(k.id); if (!title.trim() && k.titles[0]) setTitle(k.titles[0]) }} aria-pressed={kind === k.id}
            className={`rounded-full px-3.5 py-2 text-sm font-semibold ${kind === k.id ? 'bg-brand text-inverse' : 'bg-surface2'}`}>{k.emoji} {k.label}</button>
        ))}
      </div>
      <input className="input" placeholder="অনুষ্ঠানের নাম" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      {KIND[kind].titles.length > 1 && (
        <div className="flex flex-wrap gap-1.5">{KIND[kind].titles.map((t) => <button key={t} onClick={() => setTitle(t)} className="rounded-full bg-surface2 px-3 py-1 text-xs font-semibold">{t}</button>)}</div>
      )}
      <label className="block text-sm font-semibold">কবে ও কখন
        <input type="datetime-local" className="input mt-1" value={when} onChange={(e) => setWhen(e.target.value)} />
      </label>
      <input className="input" placeholder="কোথায় (ঐচ্ছিক)" maxLength={120} value={place} onChange={(e) => setPlace(e.target.value)} />
      <textarea className="input" rows={2} placeholder="আরও কিছু জানাতে চাইলে (ঐচ্ছিক)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="block text-sm font-semibold">কারা দেখবে
        <select className="input mt-1" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">আমার সব বন্ধু</option>
          {groups.map((g) => <option key={g.id} value={g.id}>গ্রুপ: {g.name}</option>)}
        </select>
      </label>
      <p className="text-xs text-fg/55">ঈদের তারিখ চাঁদ দেখার ওপর নির্ভর করে, তাই নিশ্চিত হয়ে তারিখ বসান। আগের দিন ও সেদিন সবার কাছে রিমাইন্ডার যাবে।</p>
      <button onClick={save} disabled={busy} className="btn-primary w-full">{busy ? 'যোগ হচ্ছে…' : 'অনুষ্ঠান যোগ করুন'}</button>
    </Sheet>
  )
}

// ---------- ট্যাব: জন্মদিন + অনুষ্ঠান ----------
export default function Events() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const focus = params.get('event')
  const [bds, setBds] = useState(null)
  const [evs, setEvs] = useState(null)
  const [rsvps, setRsvps] = useState({})
  const [missing, setMissing] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [allB, setAllB] = useState(false)

  const load = useCallback(async () => {
    const since = new Date(); since.setHours(0, 0, 0, 0)
    const [b, e] = await Promise.all([
      supabase.from('birthdays').select('*, profiles(id, full_name, avatar_url)'),
      supabase.from('family_events').select('*, profiles(id, full_name, avatar_url)').gte('starts_at', since.toISOString()).order('starts_at'),
    ])
    if (tableMissing(b.error) || tableMissing(e.error)) { setMissing(true); setBds([]); setEvs([]); return }
    setBds(b.data || [])
    const list = e.data || []; setEvs(list)
    if (list.length) {
      const { data: r } = await supabase.from('event_rsvps').select('event_id, user_id, status, profiles(id, full_name, avatar_url)').in('event_id', list.map((x) => x.id))
      const g = {}; (r || []).forEach((x) => { (g[x.event_id] ||= []).push(x) }); setRsvps(g)
    } else setRsvps({})
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (focus && evs) document.getElementById('ev-' + focus)?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [focus, evs])

  const mine = (bds || []).find((b) => b.user_id === user.id)
  const upcoming = useMemo(() => (bds || []).filter((b) => b.user_id !== user.id && b.profiles)
    .map((b) => ({ ...b, ...nextBirthday(b) })).sort((a, b) => a.days - b.days), [bds, user.id])

  const rsvp = async (ev, status) => {
    const cur = (rsvps[ev.id] || []).find((x) => x.user_id === user.id)?.status
    const { error } = cur === status
      ? await supabase.from('event_rsvps').delete().eq('event_id', ev.id).eq('user_id', user.id)
      : await supabase.from('event_rsvps').upsert({ event_id: ev.id, user_id: user.id, status })
    if (error) return toast.error(errMsg(error))
    load()
  }
  const del = async (ev) => {
    if (!(await confirmDialog(`"${ev.title}" মুছে ফেলবেন?`, { title: 'অনুষ্ঠান মুছবেন?', danger: true, confirmText: 'মুছুন' }))) return
    const { error } = await supabase.from('family_events').delete().eq('id', ev.id)
    if (error) return toast.error(errMsg(error))
    toast.success('অনুষ্ঠান মুছে ফেলা হয়েছে'); load()
  }

  if (missing) return <p className="rounded-3xl bg-danger/10 p-4 text-sm text-danger">জন্মদিন ও অনুষ্ঠান চালু করতে Supabase-এ update-23.sql একবার চালাতে হবে।</p>
  if (evs === null) return <p className="py-10 text-center text-fg/55">লোড হচ্ছে…</p>

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-lg font-extrabold"><Cake size={20} className="text-coral" />জন্মদিন</h3>
        <button onClick={() => setSheet('bday')} className="flex w-full items-center gap-3 rounded-3xl bg-surface p-3.5 text-left shadow-soft">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-coral/15 text-xl">🎂</span>
          <span className="min-w-0 flex-1">
            <b className="block">আমার জন্মদিন</b>
            <span className="text-sm text-fg/60">{mine ? `${bn(mine.day)} ${MONTHS[mine.month - 1]}${mine.year ? ` ${bn(mine.year)}` : ''}` : 'এখনও দেওয়া হয়নি — দিলে আপনজনেরা শুভেচ্ছা জানাতে পারবে'}</span>
          </span>
          <Pencil size={18} className="text-fg/50" aria-hidden="true" />
        </button>
        {upcoming.length === 0 && <p className="px-1 text-sm text-fg/55">বন্ধুদের কেউ এখনও জন্মদিন দেননি।</p>}
        {(allB ? upcoming : upcoming.slice(0, 5)).map((b) => (
          <div key={b.user_id} className={`flex items-center gap-3 rounded-3xl p-3 ${b.days === 0 ? 'bg-coral/15 ring-1 ring-coral/40' : 'bg-surface'} shadow-soft`}>
            <Link to={`/profile/${b.user_id}`}><Avatar p={b.profiles} size={46} /></Link>
            <div className="min-w-0 flex-1">
              <b className="block truncate">{b.profiles.full_name}</b>
              <span className="text-sm text-fg/60">{bn(b.date.getDate())} {MONTHS[b.date.getMonth()]} • {dayWord(b.days)}{b.turning ? ` • ${bn(b.turning)} বছর হবে` : ''}</span>
            </div>
            {b.days === 0 && <Link to={`/chat/${b.user_id}`} className="btn-primary !px-3.5 !py-2 text-sm">শুভেচ্ছা 🎉</Link>}
          </div>
        ))}
        {upcoming.length > 5 && <button onClick={() => setAllB(!allB)} className="w-full text-center text-sm font-semibold text-brand">{allB ? 'কম দেখুন' : `আরও ${bn(upcoming.length - 5)}টি দেখুন`}</button>}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold">📅 অনুষ্ঠান</h3>
          <button onClick={() => setSheet('event')} className="btn-primary !px-3.5 !py-2 text-sm"><Plus size={16} />নতুন</button>
        </div>
        {evs.length === 0 && <p className="rounded-3xl bg-surface p-5 text-center text-sm text-fg/60 shadow-soft">আসন্ন কোনো অনুষ্ঠান নেই। ঈদ, বিয়ে, মিলাদ বা পারিবারিক আড্ডার আয়োজন করুন।</p>}
        {evs.map((ev) => {
          const list = rsvps[ev.id] || [], my = list.find((x) => x.user_id === user.id)?.status
          const going = list.filter((x) => x.status === 'going'), days = eventDays(ev.starts_at)
          return (
            <article key={ev.id} id={`ev-${ev.id}`} className={`space-y-2.5 rounded-3xl bg-surface p-4 shadow-soft ${focus === ev.id ? 'ring-2 ring-coral/60' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/12 text-2xl">{KIND[ev.kind]?.emoji || '📅'}</span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-lg font-extrabold leading-snug">{ev.title}</h4>
                  <p className="text-sm font-semibold text-brand">{fmtDate(ev.starts_at)}, {fmtTime(ev.starts_at)} • {dayWord(days)}</p>
                  {ev.place && <p className="mt-0.5 flex items-center gap-1 text-sm text-fg/65"><MapPin size={14} />{ev.place}</p>}
                  <p className="text-xs text-fg/50">আয়োজক: {ev.created_by === user.id ? 'আপনি' : ev.profiles?.full_name}</p>
                </div>
                {ev.created_by === user.id && <button onClick={() => del(ev)} aria-label="অনুষ্ঠান মুছুন" className="grid h-9 w-9 place-items-center rounded-full bg-surface2 text-danger"><Trash2 size={16} /></button>}
              </div>
              {ev.note && <p className="whitespace-pre-wrap rounded-2xl bg-surface2 px-3 py-2 text-sm">{ev.note}</p>}
              <div className="grid grid-cols-3 gap-2">
                {RSVP.map((r) => (
                  <button key={r.id} onClick={() => rsvp(ev, r.id)} aria-pressed={my === r.id}
                    className={`rounded-2xl px-1 py-2.5 text-sm font-semibold transition active:scale-95 ${my === r.id ? 'bg-brand text-inverse' : 'bg-surface2'}`}>{r.label}</button>
                ))}
              </div>
              <p className="text-xs text-fg/60">
                {going.length ? `✅ যাচ্ছেন (${bn(going.length)}): ${going.slice(0, 4).map((x) => x.user_id === user.id ? 'আপনি' : x.profiles?.full_name).join(', ')}${going.length > 4 ? ` ও আরও ${bn(going.length - 4)} জন` : ''}` : 'এখনও কেউ "যাচ্ছি" বলেননি'}
                {list.filter((x) => x.status === 'maybe').length > 0 && ` • হয়তো: ${bn(list.filter((x) => x.status === 'maybe').length)}`}
              </p>
            </article>
          )
        })}
      </section>

      {sheet === 'bday' && <BirthdaySheet current={mine} onClose={() => setSheet(null)} onSaved={load} />}
      {sheet === 'event' && <EventSheet onClose={() => setSheet(null)} onSaved={load} />}
    </div>
  )
}
