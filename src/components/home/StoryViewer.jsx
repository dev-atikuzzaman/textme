import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Eye, Volume2, VolumeX } from '../../lib/icons'
import { supabase } from '../../lib/supabase'
import { mediaPathFromUrl } from '../../lib/media'
import Avatar from '../Avatar'
import { STORY_BG, ago } from './storyUtils'

const DURATION = 5000

export default function StoryViewer({ groups, start, startIndex = 0, meId, onClose }) {
  const [gi, setGi] = useState(start)
  const [si, setSi] = useState(startIndex)
  const [p, setP] = useState(0)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [views, setViews] = useState(null)
  const vid = useRef()
  const down = useRef(0)

  const g = groups[gi]
  const s = g.items[si]
  const own = g.uid === meId
  const isVideo = s.media_type === 'video'

  const next = () => {
    if (si < g.items.length - 1) { setSi(si + 1); setP(0) }
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); setP(0) }
    else onClose()
  }
  const prev = () => {
    if (si > 0) { setSi(si - 1) }
    else if (gi > 0) { setGi(gi - 1); setSi(groups[gi - 1].items.length - 1) }
    setP(0)
  }

  // ছবি/লেখা: ৫ সেকেন্ডে অটো এগোয়
  useEffect(() => {
    if (paused || isVideo) return
    let raf, last = performance.now()
    const tick = (t) => {
      const dt = t - last; last = t
      setP((x) => Math.min(1, x + dt / DURATION))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [s.id, paused, isVideo])
  useEffect(() => { if (p >= 1) next() }, [p]) // eslint-disable-line

  // ভিডিও: চালু/বিরতি, সাউন্ড আটকালে নিঃশব্দে চালায়
  useEffect(() => {
    const v = vid.current
    if (!v) return
    if (paused) v.pause()
    else v.play().catch(() => { setMuted(true); v.muted = true; v.play().catch(() => {}) })
  }, [s.id, paused])

  // দেখা হয়েছে চিহ্নিত / নিজের স্টোরির ভিউ সংখ্যা
  useEffect(() => {
    setViews(null)
    if (!own) {
      supabase.from('story_views').upsert({ story_id: s.id, viewer_id: meId }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }).then(() => {})
    } else {
      supabase.from('story_views').select('viewer_id', { count: 'exact', head: true }).eq('story_id', s.id).then(({ count }) => setViews(count || 0))
    }
  }, [s.id]) // eslint-disable-line

  const remove = async () => {
    if (!window.confirm('এই স্টোরিটি মুছে ফেলবেন?')) return
    const path = mediaPathFromUrl(s.media_url)
    const { error } = await supabase.from('stories').delete().eq('id', s.id)
    if (error) return window.alert(error.message)
    if (path) supabase.storage.from('media').remove([path])
    onClose()
  }

  const stop = (e) => e.stopPropagation()
  const onDown = () => { down.current = Date.now(); setPaused(true) }
  const onUp = (e) => {
    setPaused(false)
    if (Date.now() - down.current > 220) return // চেপে ধরে ছেড়েছে, ট্যাপ নয়
    const r = e.currentTarget.getBoundingClientRect()
    if (e.clientX - r.left < r.width * 0.3) prev(); else next()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <div className="relative mx-auto h-full max-w-md select-none overflow-hidden bg-black">
        <div className="absolute inset-0" style={!s.media_url ? { background: STORY_BG[s.bg] || STORY_BG[0] } : undefined}>
          {s.media_type === 'image' && <img src={s.media_url} alt="" className="h-full w-full object-contain" draggable={false} />}
          {isVideo && (
            <video key={s.id} ref={vid} src={s.media_url} playsInline muted={muted} autoPlay className="h-full w-full object-contain"
              onTimeUpdate={(e) => setP(e.target.currentTime / (e.target.duration || 1))} onEnded={() => setP(1)} />
          )}
          {!s.media_url && <p className="grid h-full place-items-center whitespace-pre-wrap break-words px-8 text-center text-3xl font-bold leading-snug text-white">{s.content}</p>}
        </div>

        {/* ট্যাপ এলাকা: বাঁয়ে = আগের, ডানে = পরের, চেপে ধরলে থামে */}
        <div className="absolute inset-0" onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={() => setPaused(false)} onContextMenu={(e) => e.preventDefault()} />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex gap-1">
            {g.items.map((it, i) => (
              <div key={it.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <div className="h-full bg-white" style={{ width: i < si ? '100%' : i === si ? `${p * 100}%` : '0%' }} />
              </div>
            ))}
          </div>
          <div className="pointer-events-auto mt-3 flex items-center gap-3 text-white">
            <Avatar p={g.profile} size={38} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate font-bold">{own ? 'আপনার স্টোরি' : g.profile?.full_name}</p>
              <p className="text-xs text-white/70">{ago(s.created_at)}</p>
            </div>
            {isVideo && <button onPointerDown={stop} onPointerUp={stop} onClick={() => { setMuted(!muted); if (vid.current) vid.current.muted = !muted }} className="grid h-10 w-10 place-items-center rounded-full bg-white/15">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>}
            {own && <button onPointerDown={stop} onPointerUp={stop} onClick={remove} aria-label="মুছুন" className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><Trash2 size={18} /></button>}
            <button onPointerDown={stop} onPointerUp={stop} onClick={onClose} aria-label="বন্ধ করুন" className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><X size={20} /></button>
          </div>
        </div>

        {s.media_url && s.content && (
          <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16 text-center text-lg font-semibold text-white">{s.content}</p>
        )}
        {own && views !== null && (
          <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white"><Eye size={16} />{views.toLocaleString('bn-BD')} জন দেখেছেন</div>
        )}
      </div>
    </div>
  )
}
