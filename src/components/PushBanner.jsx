import { useEffect, useState } from 'react'
import { BellRing, X } from '../lib/icons'
import { pushState, enablePush } from '../lib/push'

// অ্যাপ বন্ধ থাকলেও কল/মেসেজ/পোস্টের পপ-আপ ও সাউন্ড পেতে ১ ট্যাপে চালু করার বাটন
export default function PushBanner() {
  const [st, setSt] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('apon-push-hide') === '1' } catch { return false } })
  useEffect(() => { pushState().then(setSt) }, [])
  if (hidden || st !== 'off') return null

  const on = async () => {
    setBusy(true); setErr('')
    try { await enablePush() } catch (e) { setErr(e.message) }
    setSt(await pushState()); setBusy(false)
  }
  const close = () => { setHidden(true); try { localStorage.setItem('apon-push-hide', '1') } catch { /* ignore */ } }
  return (
    <div className="mb-4 rounded-[28px] bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-coral text-inverse"><BellRing size={20} /></div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">অ্যালার্ট চালু করুন</p>
          <p className="text-fg/65">অ্যাপ বন্ধ থাকলেও কল, মেসেজ ও নতুন পোস্টের সাউন্ড-সহ পপ-আপ পাবেন।</p>
        </div>
        <button disabled={busy} onClick={on} className="rounded-2xl bg-gradient-to-r from-brand to-coral px-4 py-2 text-sm font-bold text-inverse disabled:opacity-60">চালু</button>
        <button onClick={close} aria-label="বন্ধ করুন" className="text-fg/65"><X size={18} /></button>
      </div>
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
    </div>
  )
}
