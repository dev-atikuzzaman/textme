import { useRef, useState } from 'react'
import { ThumbsUp } from 'lucide-react'
import { REACTIONS } from '../../lib/constants'

// ট্যাপ = লাইক/তুলে নেওয়া • চেপে ধরলে (বা মাউস রাখলে) ৬টি রিয়্যাকশন। compact = কমেন্টের ছোট টেক্সট বাটন
export default function ReactionBar({ mine, onReact, compact = false }) {
  const [pos, setPos] = useState(null)
  const timer = useRef()
  const fired = useRef(false)
  const btn = useRef()
  const cur = REACTIONS.find((r) => r.id === mine)

  const openPicker = () => {
    const r = btn.current.getBoundingClientRect()
    const w = 252
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top: r.top > 76 ? r.top - 62 : r.bottom + 8 })
  }
  const down = () => {
    fired.current = false
    timer.current = setTimeout(() => { fired.current = true; openPicker(); navigator.vibrate?.(12) }, 350)
  }
  const up = () => {
    clearTimeout(timer.current)
    if (!fired.current) onReact(mine ? null : 'like')
  }
  const hoverIn = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    timer.current = setTimeout(openPicker, 450)
  }
  const hoverOut = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPos(null), 350)
  }
  const pick = (id) => { setPos(null); onReact(id === mine ? null : id) }

  return (
    <div className={compact ? 'relative inline-block' : 'relative flex-1'} onPointerEnter={hoverIn} onPointerLeave={hoverOut}>
      {pos && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setPos(null)} />
          <div style={{ left: pos.left, top: pos.top }} onPointerEnter={() => clearTimeout(timer.current)}
            className="pop-in fixed z-[81] flex gap-0.5 rounded-full bg-surface p-1.5 shadow-2xl ring-1 ring-brand/30">
            {REACTIONS.map((r) => (
              <button key={r.id} onClick={() => pick(r.id)} title={r.label} aria-label={r.label}
                className="px-1 text-[30px] leading-none transition-transform duration-150 hover:-translate-y-2 hover:scale-125 active:scale-125">
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
      <button ref={btn}
        onPointerDown={down} onPointerUp={up} onPointerCancel={() => clearTimeout(timer.current)}
        onContextMenu={(e) => e.preventDefault()}
        className={compact
          ? `select-none text-xs font-bold transition active:scale-95 [-webkit-touch-callout:none] ${cur ? cur.color : 'text-fg/60'}`
          : `flex w-full select-none items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition active:scale-95 [-webkit-touch-callout:none] ${cur ? cur.color : 'text-fg/60'}`}>
        {!compact && (cur ? <span className="text-xl leading-none">{cur.emoji}</span> : <ThumbsUp size={20} />)}
        {cur ? cur.label : 'লাইক'}
      </button>
    </div>
  )
}
