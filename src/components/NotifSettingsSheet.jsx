import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../context/Auth'
import { CATS, DEFAULTS, loadPrefs, savePrefs, minsToTime, timeToMins } from '../lib/notifPrefs'
import { toast, errMsg } from '../lib/ui'

function Switch({ on, onChange, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-brand' : 'bg-fg/20'}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[1.4rem]' : 'left-0.5'}`} />
    </button>
  )
}

// নোটিফিকেশন পেজ → ⚙ : কোন ধরনের অ্যালার্ট আসবে এবং রাতে চুপ থাকার সময়
export default function NotifSettingsSheet({ onClose }) {
  const { user } = useAuth()
  const [p, setP] = useState(DEFAULTS)
  const [ready, setReady] = useState(false)
  const [missing, setMissing] = useState(false)

  useEffect(() => { loadPrefs().then((x) => { setP(x); setMissing(!!x._missing); setReady(true) }) }, [])

  const change = async (patch) => {
    setP((v) => ({ ...v, ...patch }))
    const error = await savePrefs(user.id, patch)
    if (error) toast.error(/relation|schema cache|does not exist/i.test(error.message || '') ? 'সেভ হয়নি — update-22.sql চালানো হয়নি' : errMsg(error, 'সেভ করা যায়নি — আবার চেষ্টা করুন'))
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="নোটিফিকেশন সেটিংস"
        className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">নোটিফিকেশন সেটিংস</h2>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>

        {missing && <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">এই সুবিধা চালু করতে Supabase-এ update-22.sql একবার চালাতে হবে।</p>}

        <section className={`space-y-1 ${ready ? '' : 'opacity-50'}`}>
          <p className="font-bold">কোন অ্যালার্ট আসবে</p>
          {CATS.map((c) => (
            <div key={c.key} className="flex items-center gap-3 rounded-2xl bg-surface2 p-3">
              <div className="min-w-0 flex-1"><b className="block">{c.label}</b><span className="text-xs text-fg/55">{c.sub}</span></div>
              <Switch on={p[c.key] !== false} label={c.label} onChange={(v) => change({ [c.key]: v })} />
            </div>
          ))}
          <p className="px-1 pt-1 text-xs text-fg/55">বন্ধ করা ধরনের পুশ নোটিফিকেশন, অ্যাপের ব্যানার ও সাউন্ড আর আসবে না। ভেতরের নোটিফিকেশন তালিকায় সবই থাকবে।</p>
        </section>

        <section className={`space-y-2 ${ready ? '' : 'opacity-50'}`}>
          <div className="flex items-center gap-3 rounded-2xl bg-surface2 p-3">
            <div className="min-w-0 flex-1"><b className="block">চুপ থাকার সময়</b><span className="text-xs text-fg/55">এই সময়ে পুশ ও সাউন্ড বন্ধ (কল ছাড়া)</span></div>
            <Switch on={!!p.quiet_on} label="চুপ থাকার সময়" onChange={(v) => change({ quiet_on: v })} />
          </div>
          {p.quiet_on && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">শুরু
                <input type="time" className="input mt-1" value={minsToTime(p.quiet_from)} onChange={(e) => e.target.value && change({ quiet_from: timeToMins(e.target.value) })} />
              </label>
              <label className="block text-sm font-semibold">শেষ
                <input type="time" className="input mt-1" value={minsToTime(p.quiet_to)} onChange={(e) => e.target.value && change({ quiet_to: timeToMins(e.target.value) })} />
              </label>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
