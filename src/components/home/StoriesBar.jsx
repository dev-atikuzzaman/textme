import { useCallback, useEffect, useState } from 'react'
import { Plus } from '../../lib/icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/Auth'
import Avatar from '../Avatar'
import StoryViewer from './StoryViewer'
import StoryComposer from './StoryComposer'

function Bubble({ p, label, ring, onClick, plus, onPlus }) {
  return (
    <div className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
      <div className="relative">
        <button onClick={onClick} className={`grid h-[66px] w-[66px] place-items-center rounded-full p-[3px] ${ring === 'new' ? 'bg-gradient-to-br from-brand to-coral' : ring === 'seen' ? 'bg-fg/25' : 'bg-transparent'}`}>
          <span className="block rounded-full border-2 border-ink"><Avatar p={p} size={56} /></span>
        </button>
        {plus && (
          <button aria-label="স্টোরি যোগ করুন" onClick={onPlus} className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-brand to-coral text-inverse ring-2 ring-ink"><Plus size={15} strokeWidth={3} /></button>
        )}
      </div>
      <span className="w-full truncate text-center text-xs text-fg/75">{label}</span>
    </div>
  )
}

export default function StoriesBar() {
  const { user, profile } = useAuth()
  const [groups, setGroups] = useState([])
  const [viewer, setViewer] = useState(null)
  const [compose, setCompose] = useState(false)

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 864e5).toISOString()
    const { data: st, error } = await supabase.from('stories').select('id,user_id,content,bg,media_url,media_type,created_at').gte('created_at', since).order('created_at', { ascending: true }).limit(300)
    if (error || !st?.length) return setGroups([])
    const uids = [...new Set(st.map((s) => s.user_id))]
    const [{ data: ps }, { data: vs }] = await Promise.all([
      supabase.from('profiles').select('id,full_name,username,avatar_url').in('id', uids),
      supabase.from('story_views').select('story_id').eq('viewer_id', user.id).in('story_id', st.map((s) => s.id)),
    ])
    const prof = Object.fromEntries((ps || []).map((p) => [p.id, p]))
    const seen = new Set((vs || []).map((v) => v.story_id))
    const map = new Map()
    st.forEach((s) => {
      if (!map.has(s.user_id)) map.set(s.user_id, { uid: s.user_id, profile: prof[s.user_id], items: [] })
      map.get(s.user_id).items.push(s)
    })
    const arr = [...map.values()].map((g) => ({ ...g, seen: g.items.every((i) => seen.has(i.id)), first: Math.max(0, g.items.findIndex((i) => !seen.has(i.id))) }))
    const last = (g) => g.items[g.items.length - 1].created_at
    const mine = arr.filter((g) => g.uid === user.id)
    const rest = arr.filter((g) => g.uid !== user.id).sort((a, b) => (a.seen - b.seen) || (last(b) > last(a) ? 1 : -1))
    setGroups([...mine, ...rest])
  }, [user.id])
  useEffect(() => { load() }, [load])

  const mine = groups.find((g) => g.uid === user.id)
  const open = (g) => setViewer({ start: groups.indexOf(g), si: g.first })

  return (
    <>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        <Bubble p={profile} label="আপনার স্টোরি" plus
          ring={mine ? (mine.seen ? 'seen' : 'new') : 'none'}
          onClick={() => (mine ? open(mine) : setCompose(true))} onPlus={() => setCompose(true)} />
        {groups.filter((g) => g.uid !== user.id).map((g) => (
          <Bubble key={g.uid} p={g.profile} label={g.profile?.full_name?.split(' ')[0] || '—'} ring={g.seen ? 'seen' : 'new'} onClick={() => open(g)} />
        ))}
      </div>
      {viewer && <StoryViewer groups={groups} start={viewer.start} startIndex={viewer.si} meId={user.id} onClose={() => { setViewer(null); load() }} />}
      {compose && <StoryComposer onClose={() => setCompose(false)} onDone={load} />}
    </>
  )
}
