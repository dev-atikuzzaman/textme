import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { subscribe } from '../lib/ui'

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info }
const TONE = { success: 'text-success', error: 'text-danger', info: 'text-brand' }

// টোস্ট (উপরে, নিজে মিলিয়ে যায়) + কনফার্ম ডায়ালগ (নিচ থেকে ওঠে)। App-এ একবারই বসান।
export default function UIHost() {
  const [toasts, setToasts] = useState([])
  const [dialogs, setDialogs] = useState([])
  const timers = useRef({})

  const dismiss = (id) => {
    clearTimeout(timers.current[id]); delete timers.current[id]
    setToasts((l) => l.filter((t) => t.id !== id))
  }

  useEffect(() => {
    const off = subscribe((e) => {
      if (e.k === 'toast') {
        setToasts((l) => [...l.filter((t) => t.message !== e.message), e].slice(-3)) // একই মেসেজ বারবার জমবে না
        timers.current[e.id] = setTimeout(() => dismiss(e.id), e.ms || 3500)
      } else setDialogs((l) => [...l, e])
    })
    return () => { off(); Object.values(timers.current).forEach(clearTimeout) }
  }, [])

  const d = dialogs[0]
  const answer = (v) => { d.resolve(v); setDialogs((l) => l.slice(1)) }
  useEffect(() => {
    if (!d) return
    const f = (e) => { if (e.key === 'Escape') { d.resolve(false); setDialogs((l) => l.slice(1)) } }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [d])

  return (
    <>
      <div role="status" aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {toasts.map((t) => {
          const I = ICON[t.type] || Info
          return (
            <div key={t.id} className="pop-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-3xl bg-surface p-3.5 pr-3 text-fg shadow-2xl ring-1 ring-fg/10">
              <I size={22} className={`mt-0.5 shrink-0 ${TONE[t.type] || TONE.info}`} />
              <p className="min-w-0 flex-1 whitespace-pre-line break-words text-[15px] leading-snug">{t.message}</p>
              <button onClick={() => dismiss(t.id)} aria-label="বন্ধ করুন" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg/50 hover:bg-fg/10"><X size={16} /></button>
            </div>
          )
        })}
      </div>

      {d && (
        <div className="fixed inset-0 z-[210] grid place-items-end bg-black/60 p-3 sm:place-items-center" onClick={() => answer(false)}>
          <div role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
            className="pop-in mb-[env(safe-area-inset-bottom)] w-full max-w-sm rounded-[28px] bg-surface p-5 shadow-2xl ring-1 ring-fg/10">
            {d.title && <h3 className="text-lg font-extrabold">{d.title}</h3>}
            <p className="mt-1 whitespace-pre-line text-fg/75">{d.message}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button autoFocus={!!d.danger} onClick={() => answer(false)} className="btn-soft">{d.cancelText || 'না'}</button>
              <button autoFocus={!d.danger} onClick={() => answer(true)} className={d.danger ? 'btn bg-danger text-inverse' : 'btn-primary'}>{d.confirmText || 'হ্যাঁ'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
