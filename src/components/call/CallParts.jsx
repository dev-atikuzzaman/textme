import { useRef, useState } from 'react'
import { ImagePlus } from '../../lib/icons'
import { EFFECTS, setCustomBg } from '../../lib/videoFx'

// ব্যাকগ্রাউন্ড বাছাইয়ের স্ট্রিপ (হোয়াটসঅ্যাপের মতো নিচে আসে)
export function EffectsTray({ value, onPick, onClose, state }) {
  const file = useRef()
  const custom = async (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return alert('একটি ছবি বাছুন')
    try { await setCustomBg(f); onPick('bg:custom') } catch (er) { alert(er.message) }
  }
  return (
    <div className="relative z-20 mx-3 mb-2 rounded-3xl bg-black/55 p-3 backdrop-blur">
      <div className="mb-2 flex items-center justify-between px-1 text-white"><b className="text-sm">ব্যাকগ্রাউন্ড</b><button onClick={onClose} className="text-xs text-white/70">বন্ধ</button></div>
      <input ref={file} type="file" accept="image/*" hidden onChange={custom} />
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        {EFFECTS.map((e) => (
          <button key={e.id} onClick={() => onPick(e.id)} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
            <span style={{ background: e.css }} className={`grid h-14 w-14 place-items-center rounded-2xl text-2xl ${value === e.id ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-black/40' : ''}`}>{e.emoji}</span>
            <span className={`text-[11px] ${value === e.id ? 'font-bold text-emerald-300' : 'text-white/80'}`}>{e.label}</span>
          </button>
        ))}
        <button onClick={() => file.current.click()} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
          <span className={`grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-white ${value === 'bg:custom' ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-black/40' : ''}`}><ImagePlus size={22} /></span>
          <span className={`text-[11px] ${value === 'bg:custom' ? 'font-bold text-emerald-300' : 'text-white/80'}`}>নিজের ছবি</span>
        </button>
      </div>
      {value !== 'none' && state === 'loading' && <p className="mt-1 px-1 text-xs text-white/70">ব্যাকগ্রাউন্ড মডেল লোড হচ্ছে… প্রথমবার একটু সময় লাগে</p>}
      {value !== 'none' && state === 'failed' && <p className="mt-1 px-1 text-xs text-amber-300">এই ডিভাইস/ব্রাউজারে ব্যাকগ্রাউন্ড বদল চালু করা যায়নি</p>}
    </div>
  )
}

export const EMOJIS = ['❤️', '😂', '👍', '🎉', '😮', '🙏']
// রিঅ্যাকশন বাটন সারি
export function ReactBar({ onReact }) {
  return (
    <div className="relative z-20 mx-auto mb-2 flex w-fit gap-1 rounded-full bg-black/45 px-2 py-1 backdrop-blur">
      {EMOJIS.map((e) => <button key={e} onClick={() => onReact(e)} className="grid h-9 w-9 place-items-center rounded-full text-xl transition active:scale-125">{e}</button>)}
    </div>
  )
}
// ভেসে ওঠা ইমোজি
export function Floaters({ items }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {items.map((f) => <span key={f.id} className="floaty absolute bottom-40 text-4xl" style={{ left: `${f.x}%` }}>{f.e}</span>)}
    </div>
  )
}
export function useFloaters() {
  const [items, setItems] = useState([])
  const n = useRef(0)
  const add = (e) => {
    const id = ++n.current
    setItems((l) => [...l, { id, e, x: 15 + Math.random() * 65 }])
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 2600)
  }
  return [items, add]
}

// টেনে সরানো যায় এমন ফ্লোটিং ছোট উইন্ডো; ট্যাপ করলে onTap (বড়-ছোট বদল)
export function useDrag(initial = { right: 16, top: 96 }) {
  const [pos, setPos] = useState(null) // {x,y} px (left/top); null = ডিফল্ট
  const st = useRef(null)
  const bind = {
    onPointerDown: (e) => {
      const r = e.currentTarget.getBoundingClientRect()
      st.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false, w: r.width, h: r.height }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e) => {
      const s = st.current; if (!s) return
      if (Math.abs(e.clientX - s.sx) + Math.abs(e.clientY - s.sy) > 6) s.moved = true
      if (!s.moved) return
      const x = Math.min(window.innerWidth - s.w - 8, Math.max(8, e.clientX - s.dx))
      const y = Math.min(window.innerHeight - s.h - 8, Math.max(8, e.clientY - s.dy))
      setPos({ x, y })
    },
    onPointerUp: (e, onTap) => { const s = st.current; st.current = null; if (s && !s.moved) onTap?.() },
  }
  const style = pos ? { left: pos.x, top: pos.y } : { right: initial.right, top: initial.top }
  return [style, bind]
}
