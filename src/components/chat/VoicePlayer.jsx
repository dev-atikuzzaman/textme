import { useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { mmss } from '../../lib/media'

// পুরনো ভয়েস মেসেজে আসল তরঙ্গ নেই, তাই সেগুলোর জন্য আইডি থেকে বানানো নকশা
const fakeBars = (seed, n = 40) => {
  let x = [...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 7)
  return Array.from({ length: n }, () => { x = (x * 9301 + 49297) % 233280; return 0.25 + 0.75 * (x / 233280) })
}
const RATES = [1, 1.5, 2]

// ওয়েভফর্মসহ ভয়েস প্লেয়ার: প্লে/পজ, তরঙ্গে ট্যাপ করে এগোনো-পেছানো, ১x/১.৫x/২x গতি
export default function VoicePlayer({ url, duration = 0, peaks, mine, seed }) {
  const a = useRef()
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(duration || 0)
  const [rate, setRate] = useState(1)
  const bars = peaks?.length ? peaks.map((p) => Math.max(0.12, p)) : fakeBars(seed)
  const total = dur || duration || 0
  const progress = total ? Math.min(1, t / total) : 0

  const toggle = () => {
    const el = a.current; if (!el || !url) return
    if (el.paused) {
      document.querySelectorAll('audio[data-voice]').forEach((x) => { if (x !== el) x.pause() }) // একসাথে একটাই বাজবে
      el.playbackRate = rate
      el.play().catch(() => {})
    } else el.pause()
  }
  const seek = (e) => {
    const el = a.current; if (!el || !total) return
    const r = e.currentTarget.getBoundingClientRect()
    el.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * total
    setT(el.currentTime)
  }
  const cycle = () => { const n = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; setRate(n); if (a.current) a.current.playbackRate = n }

  const on = mine ? 'bg-white' : 'bg-brand', off = mine ? 'bg-white/40' : 'bg-fg/25'
  return (
    <div className="flex w-60 items-center gap-2.5">
      <audio ref={a} src={url || undefined} preload="metadata" data-voice hidden
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setT(0) }}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDur(d) }} />
      <button onClick={toggle} disabled={!url} aria-label={playing ? 'থামান' : 'চালান'}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-40 ${mine ? 'bg-white text-bubble' : 'bg-brand text-inverse'}`}>
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div onClick={seek} role="slider" aria-label="ভয়েস মেসেজের অবস্থান" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(t)}
          className="flex h-8 cursor-pointer items-center gap-[2px]">
          {bars.map((b, i) => <span key={i} style={{ height: `${Math.round(b * 100)}%` }} className={`w-[3px] flex-1 rounded-full ${(i + 0.5) / bars.length <= progress ? on : off}`} />)}
        </div>
        <p className="mt-0.5 text-[11px] tabular-nums opacity-70">{mmss(Math.round(playing || t > 0 ? t : total))}</p>
      </div>
      <button onClick={cycle} aria-label="গতি বদলান" className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${mine ? 'bg-white/20' : 'bg-surface2'}`}>{rate === 1 ? '১x' : rate === 1.5 ? '১.৫x' : '২x'}</button>
    </div>
  )
}
