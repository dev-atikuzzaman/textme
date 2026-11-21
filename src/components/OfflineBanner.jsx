import { useEffect, useRef, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { useOnline } from '../lib/useOnline'

// ইন্টারনেট চলে গেলে উপরে লাল পাতলা বার, ফিরে এলে ২ সেকেন্ডের জন্য সবুজ "আবার সংযুক্ত"
export default function OfflineBanner() {
  const on = useOnline()
  const [back, setBack] = useState(false)
  const was = useRef(on)

  useEffect(() => {
    let t
    if (!was.current && on) { setBack(true); t = setTimeout(() => setBack(false), 2200) }
    was.current = on
    return () => clearTimeout(t)
  }, [on])

  if (on && !back) return null
  return (
    <div role="status" aria-live="polite"
      className={`fixed inset-x-0 top-0 z-[190] flex items-center justify-center gap-2 px-4 pb-1.5 pt-[max(0.4rem,env(safe-area-inset-top))] text-center text-sm font-bold text-white ${on ? 'bg-success' : 'bg-danger'}`}>
      {on ? <Wifi size={16} /> : <WifiOff size={16} />}
      {on ? 'আবার সংযুক্ত হয়েছে' : 'ইন্টারনেট নেই — সংযোগ ফিরলে আবার কাজ করবে'}
    </div>
  )
}
