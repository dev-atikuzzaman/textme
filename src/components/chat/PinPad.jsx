import { useState } from 'react'
import { Lock, X, Delete } from '../../lib/icons'

// ৪ সংখ্যার PIN প্যাড। mode: 'set' (নতুন, দুইবার) | 'verify'
export default function PinPad({ mode = 'verify', title, onSubmit, onClose }) {
  const [pin, setPin] = useState('')
  const [first, setFirst] = useState(null)
  const [msg, setMsg] = useState('')
  const [shake, setShake] = useState(false)

  const done = async (p) => {
    if (mode === 'set') {
      if (!first) { setFirst(p); setPin(''); return setMsg('আবার একই PIN দিন') }
      if (first !== p) { setFirst(null); setPin(''); setMsg('মিলেনি, আবার নতুন PIN দিন'); return }
      return onSubmit(p)
    }
    const ok = await onSubmit(p)
    if (ok === false) { setShake(true); setMsg('ভুল PIN'); setTimeout(() => { setShake(false); setPin('') }, 350) }
  }
  const press = (d) => {
    if (pin.length >= 4) return
    const p = pin + d; setPin(p); setMsg('')
    if (p.length === 4) setTimeout(() => done(p), 120)
  }
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/80 backdrop-blur-md" onClick={onClose}>
      <div className="w-[min(92vw,340px)] rounded-[32px] bg-surface p-6 text-center shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end">{onClose && <button onClick={onClose} aria-label="বন্ধ" className="grid h-8 w-8 place-items-center rounded-full bg-surface2"><X size={16} /></button>}</div>
        <Lock className="mx-auto text-brand" size={30} />
        <h3 className="mt-2 text-lg font-bold">{title || (mode === 'set' ? (first ? 'PIN নিশ্চিত করুন' : 'নতুন PIN সেট করুন') : 'PIN দিন')}</h3>
        <p className="h-5 text-sm text-fg/60">{msg}</p>
        <div className={`my-3 flex justify-center gap-3 ${shake ? 'animate-pulse' : ''}`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? 'bg-brand' : 'bg-fg/20'}`} />)}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => k === '' ? <span key={i} /> : (
            <button key={i} onClick={() => (k === '⌫' ? setPin((p) => p.slice(0, -1)) : press(k))}
              className="grid h-14 place-items-center rounded-2xl bg-surface2 text-xl font-bold transition active:scale-95">{k === '⌫' ? <Delete size={22} /> : k}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
