import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function InstallBanner() {
  const [evt, setEvt] = useState(null)
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('apon-install-hide') === '1' } catch { return false } })

  useEffect(() => {
    const h = (e) => { e.preventDefault(); setEvt(e) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  const close = () => { setHidden(true); try { localStorage.setItem('apon-install-hide', '1') } catch {} }
  if (hidden || standalone()) return null
  if (!evt && !isIOS()) return null

  const install = async () => { evt.prompt(); await evt.userChoice; setEvt(null) }
  return (
    <div className="mb-4 flex items-center gap-3 rounded-[28px] bg-ink p-4 text-white shadow-soft">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-coral"><Download size={20} /></div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">ফোনে ইনস্টল করুন</p>
        <p className="text-white/70">{evt ? 'হোম স্ক্রিন থেকে সরাসরি খুলুন।' : 'Safari-তে Share বাটন চেপে "Add to Home Screen" বেছে নিন।'}</p>
      </div>
      {evt && <button onClick={install} className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-ink">ইনস্টল</button>}
      <button onClick={close} className="text-white/50"><X size={18} /></button>
    </div>
  )
}
