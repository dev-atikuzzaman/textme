import { useRef, useState } from 'react'
import { ThumbsUp } from 'lucide-react'
import { REACTIONS } from '../../lib/constants'

// ট্যাপ = লাইক/তুলে নেওয়া • চেপে ধরলে (বা মাউস রাখলে) ৬টি রিয়্যাকশন
export default function ReactionBar({ mine, onReact }) {
  const [open, setOpen] = useState(false)
  const timer = useRef()
  const fired = useRef(false)
  const cur = REACTIONS.find((r) => r.id === mine)

  const down = () => {
    fired.current = false
    timer.current = setTimeout(() => { fired.current = true; setOpen(true); navigator.vibrate?.(12) }, 350)
  }
  const up = () => {
    clearTimeout(timer.current)
    if (!fired.current) onReact(mine ? null : 'like')
  }
  const hoverIn = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), 450)
  }
  const hoverOut = (e) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), 300)
  }
  const pick = (id) => { setOpen(false); onReact(id === mine ? null : id) }

  return (
    <div className="relative flex-1" onPointerEnter={hoverIn} onPointerLeave={hoverOut}>
      {open && (
        <>
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)} />
          <div className="pop-in absolute bottom-full left-0 z-50 mb-2 flex gap-0.5 rounded-full bg-white p-1.5 shadow-2xl ring-1 ring-ink/10">
            {REACTIONS.map((r) => (
              <button key={r.id} onClick={() => pick(r.id)} title={r.label} aria-label={r.label}
                className="px-1 text-[30px] leading-none transition-transform duration-150 hover:-translate-y-2 hover:scale-125 active:scale-125">
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        onPointerDown={down} onPointerUp={up} onPointerCancel={() => clearTimeout(timer.current)}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex w-full select-none items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition active:scale-95 [-webkit-touch-callout:none] ${cur ? cur.color : 'text-ink/60'}`}>
        {cur ? <span className="text-xl leading-none">{cur.emoji}</span> : <ThumbsUp size={20} />}
        {cur ? cur.label : 'লাইক'}
      </button>
    </div>
  )
}
