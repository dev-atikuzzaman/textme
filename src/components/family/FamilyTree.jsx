import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/Auth'
import { useFriends } from '../../lib/useFriends'
import { useRelations } from '../../lib/useRelations'
import { GENERATIONS, REL, relLabel } from '../../lib/family'
import { toast } from '../../lib/ui'
import Avatar from '../Avatar'
import RelationPicker from './RelationPicker'

function Person({ p, rel, onTag }) {
  return (
    <div className="flex w-20 flex-col items-center gap-1 text-center">
      <Link to={`/profile/${p.id}`} aria-label={`${p.full_name}-এর প্রোফাইল`}><Avatar p={p} size={56} /></Link>
      <span className="w-full truncate text-xs font-bold">{p.full_name}</span>
      <button onClick={onTag} className="max-w-full truncate rounded-full bg-brand/12 px-2 py-0.5 text-[11px] font-semibold text-brand">{rel ? relLabel(rel) : 'সম্পর্ক ঠিক করুন'}</button>
    </div>
  )
}
const Line = () => <div className="mx-auto h-5 w-0.5 rounded bg-brand/30" aria-hidden="true" />

// ফ্যামিলি ট্রি: আপনার দেওয়া সম্পর্কের ট্যাগ অনুযায়ী প্রজন্ম ধরে সাজানো (দাদা-নানা → বাবা-মা → আপনি → সন্তান → নাতি-নাতনি)
export default function FamilyTree({ onInvite }) {
  const { profile } = useAuth()
  const { friends, people, other } = useFriends()
  const rels = useRelations()
  const [pick, setPick] = useState(null)

  const list = friends.map((r) => people[other(r)]).filter(Boolean)
  const tagged = (gen) => list.filter((p) => REL[rels.map[p.id]]?.gen === gen).sort((a, b) => REL[rels.map[a.id]].order - REL[rels.map[b.id]].order)
  const others = list.filter((p) => rels.map[p.id] && REL[rels.map[p.id]]?.gen === null)
  const untagged = list.filter((p) => !rels.map[p.id])

  const choose = async (id) => { const ok = await rels.set(pick.id, id); if (ok) { toast.success(id ? 'সম্পর্ক সেভ হয়েছে' : 'ট্যাগ সরানো হয়েছে'); setPick(null) } }

  if (rels.missing) return <p className="rounded-3xl bg-danger/10 p-4 text-sm text-danger">ফ্যামিলি ট্রি চালু করতে Supabase-এ update-23.sql একবার চালাতে হবে।</p>
  if (list.length === 0) return (
    <div className="space-y-3 rounded-3xl bg-surface p-6 text-center shadow-soft">
      <p className="text-4xl">🌳</p>
      <p className="font-bold">আপনার ফ্যামিলি ট্রি এখনও খালি</p>
      <p className="text-sm text-fg/65">আপনজনদের আমন্ত্রণ জানান, তারপর প্রত্যেককে সম্পর্কের ট্যাগ (মামা, খালা, দাদু…) দিন।</p>
      <button onClick={onInvite} className="btn-primary">আপনজনদের আমন্ত্রণ জানান</button>
    </div>
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-fg/65">প্রতিটি নামের নিচের ট্যাগে চাপ দিয়ে সম্পর্ক বদলাতে পারেন।</p>
      {GENERATIONS.map((g) => {
        const items = tagged(g.gen)
        if (!items.length && g.gen !== 0) return null
        return (
          <div key={g.gen}>
            <Line />
            <section className="rounded-3xl bg-surface p-4 shadow-soft">
              <p className="mb-3 text-center text-xs font-bold tracking-wide text-fg/65">{g.title}</p>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-4">
                {g.gen === 0 && (
                  <div className="flex w-20 flex-col items-center gap-1 text-center">
                    <span className="rounded-full ring-2 ring-coral"><Avatar p={profile} size={56} /></span>
                    <span className="w-full truncate text-xs font-bold">{profile?.full_name}</span>
                    <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-semibold text-coral">আপনি</span>
                  </div>
                )}
                {items.map((p) => <Person key={p.id} p={p} rel={rels.map[p.id]} onTag={() => setPick(p)} />)}
              </div>
            </section>
          </div>
        )
      })}

      {others.length > 0 && (
        <section className="rounded-3xl bg-surface p-4 shadow-soft">
          <p className="mb-3 text-center text-xs font-bold tracking-wide text-fg/65">বন্ধু ও অন্যান্য আত্মীয়</p>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-4">{others.map((p) => <Person key={p.id} p={p} rel={rels.map[p.id]} onTag={() => setPick(p)} />)}</div>
        </section>
      )}

      {untagged.length > 0 && (
        <section className="rounded-3xl bg-surface2 p-4">
          <p className="mb-3 font-bold">সম্পর্ক ঠিক করা বাকি ({untagged.length.toLocaleString('bn-BD')})</p>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-4">{untagged.map((p) => <Person key={p.id} p={p} onTag={() => setPick(p)} />)}</div>
        </section>
      )}
      <button onClick={onInvite} className="btn-soft w-full">+ আরও আপনজনকে আমন্ত্রণ জানান</button>

      {pick && <RelationPicker person={pick} current={rels.map[pick.id]} onPick={choose} onClose={() => setPick(null)} />}
    </div>
  )
}
