import { useEffect } from 'react'
import { X } from '../../lib/icons'

export default function Lightbox({ src, onClose }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/95" onClick={onClose}>
      <button aria-label="বন্ধ করুন" onClick={onClose} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white"><X size={22} /></button>
      <img src={src} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  )
}
