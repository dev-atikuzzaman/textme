import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, Share2, ZoomIn, ZoomOut, ImagePlus, Trash2, Link2, Check } from '../lib/icons'

// ফেসবুকের মতো প্রোফাইল ছবি ফুল-স্ক্রিন ভিউ: জুম, ডাউনলোড, শেয়ার/লিংক কপি, (নিজের হলে) বদলান/মুছুন
export default function AvatarViewer({ p, own, busy, title = 'প্রোফাইল ছবি', onClose, onChange, onRemove }) {
  const [z, setZ] = useState(1)
  const [copied, setCopied] = useState(false)
  const drag = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const clamp = (v) => Math.min(4, Math.max(1, v))

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); if (e.key === '+') setZ((v) => clamp(v + 0.5)); if (e.key === '-') setZ((v) => clamp(v - 0.5)) }
    window.addEventListener('keydown', h)
    // ফোনের ব্যাক বাটনেও ভিউয়ার বন্ধ হয়
    let popped = false
    history.pushState({ viewer: 1 }, '')
    const pop = () => { popped = true; onClose() }
    window.addEventListener('popstate', pop)
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); window.removeEventListener('popstate', pop); document.body.style.overflow = o; if (!popped && history.state?.viewer) history.back() }
  }, [onClose])
  useEffect(() => { if (z === 1) setPos({ x: 0, y: 0 }) }, [z])

  const download = async () => {
    try {
      const b = await (await fetch(p.avatar_url)).blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${p.username || 'profile'}.jpg`; a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch { window.open(p.avatar_url, '_blank') }
  }
  const share = async () => {
    const url = p.avatar_url
    if (navigator.share) { try { await navigator.share({ title: p.full_name, url }); return } catch { /* বাতিল */ } }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { window.open(url, '_blank') }
  }

  const Btn = ({ icon: I, label, onClick, danger, disabled }) => (
    <button onClick={onClick} disabled={disabled} className={`flex min-w-16 flex-col items-center gap-1.5 disabled:opacity-40 ${danger ? 'text-red-300' : 'text-white'}`}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/12 transition active:scale-90"><I size={21} /></span>
      <span className="text-xs">{label}</span>
    </button>
  )

  return (
    <div data-own-esc className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white">
      <div className="flex items-center gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <button onClick={onClose} aria-label="পেছনে" className="flex h-11 items-center gap-1.5 rounded-full bg-white/15 pl-3 pr-4 text-sm font-semibold active:scale-95"><ArrowLeft size={20} />পেছনে</button>
        <div className="min-w-0 flex-1 leading-tight"><p className="truncate font-bold">{p.full_name}</p><p className="text-xs text-white/85">{title}{z > 1 ? ` • ${Math.round(z * 100)}%` : ''}</p></div>
        <button onClick={() => setZ((v) => clamp(v - 0.5))} aria-label="ছোট করুন" disabled={z <= 1} className="grid h-10 w-10 place-items-center rounded-full bg-white/12 disabled:opacity-30"><ZoomOut size={19} /></button>
        <button onClick={() => setZ((v) => clamp(v + 0.5))} aria-label="বড় করুন" disabled={z >= 4} className="grid h-10 w-10 place-items-center rounded-full bg-white/12 disabled:opacity-30"><ZoomIn size={19} /></button>
      </div>

      <div className="relative grid flex-1 place-items-center overflow-hidden" onClick={(e) => e.target === e.currentTarget && onClose()}
        onWheel={(e) => setZ((v) => clamp(v + (e.deltaY < 0 ? 0.25 : -0.25)))}>
        <img src={p.avatar_url} alt={p.full_name} draggable={false}
          onDoubleClick={() => setZ((v) => (v > 1 ? 1 : 2.5))}
          onPointerDown={(e) => { if (z > 1) { drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; e.currentTarget.setPointerCapture(e.pointerId) } }}
          onPointerMove={(e) => drag.current && setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })}
          onPointerUp={() => { drag.current = null }}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${z})`, touchAction: 'none' }}
          className={`max-h-full max-w-full select-none object-contain transition-transform duration-150 ${z > 1 ? 'cursor-grab' : 'cursor-zoom-in'}`} />
      </div>

      <div className="flex items-start justify-center gap-5 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <Btn icon={Download} label="ডাউনলোড" onClick={download} />
        <Btn icon={copied ? Check : navigator.share ? Share2 : Link2} label={copied ? 'কপি হয়েছে' : navigator.share ? 'শেয়ার' : 'লিংক কপি'} onClick={share} />
        {own && <Btn icon={ImagePlus} label="নতুন ছবি" onClick={onChange} disabled={busy} />}
        {own && <Btn icon={Trash2} label="মুছুন" onClick={onRemove} danger disabled={busy} />}
      </div>
    </div>
  )
}
