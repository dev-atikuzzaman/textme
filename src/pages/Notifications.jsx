import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, BellOff, Volume2, VolumeX } from '../lib/icons'
import { useNotifs, NOTIF_TEXT } from '../context/Notifications'
import { APP_NAME } from '../lib/brand'
import { fmt } from '../lib/constants'
import { pushState, enablePush, disablePush } from '../lib/push'
import { playDing, soundOn, setSoundOn } from '../lib/sound'
import Avatar from '../components/Avatar'

const target = (n) => (n.link ? n.link : n.post_id ? `/post/${n.post_id}` : n.type === 'friend_request' ? '/friends' : `/profile/${n.actor_id}`)
const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone

export default function Notifications() {
  const { items, markAllRead } = useNotifs()
  const [ps, setPs] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [snd, setSnd] = useState(soundOn)
  useEffect(() => () => { markAllRead() }, [markAllRead])
  useEffect(() => { pushState().then(setPs) }, [])

  const toggle = async () => {
    setBusy(true); setErr('')
    try { ps === 'on' ? await disablePush() : await enablePush() } catch (e) { setErr(e.message) }
    setPs(await pushState()); setBusy(false)
  }

  return (
    <div className="space-y-3 pt-2">
      <h2 className="text-2xl font-extrabold">নোটিফিকেশন</h2>

      <div className="flex gap-2">
        <button onClick={() => { const n = !snd; setSnd(n); setSoundOn(n); if (n) playDing() }}
          className={`flex flex-1 items-center gap-2 rounded-3xl p-3 text-left text-sm font-bold ${snd ? 'bg-surface text-fg' : 'bg-ink text-white'}`}>
          {snd ? <Volume2 size={20} /> : <VolumeX size={20} />}{snd ? 'অ্যাপের সাউন্ড চালু' : 'অ্যাপের সাউন্ড বন্ধ'}
        </button>
        <button onClick={() => { setSnd(true); setSoundOn(true); playDing() }} className="rounded-3xl bg-surface px-4 text-sm font-bold text-fg">🔊 সাউন্ড টেস্ট</button>
      </div>

      {ps === 'unsupported' && (
        <p className="rounded-3xl bg-surface p-4 text-sm text-fg/70">
          {iOS && !installed ? 'iPhone-এ অ্যালার্ট পেতে আগে Safari থেকে "Add to Home Screen" করে অ্যাপটি ইনস্টল করুন, তারপর হোম স্ক্রিনের আইকন থেকে খুলুন।' : 'এই ব্রাউজারে ব্যাকগ্রাউন্ড অ্যালার্ট সমর্থিত নয়।'}
        </p>
      )}
      {ps === 'nokey' && <p className="rounded-3xl bg-surface p-4 text-sm text-danger">VITE_VAPID_PUBLIC_KEY সেট করা হয়নি — ডিপ্লয়ের ধাপগুলো দেখুন।</p>}
      {ps === 'denied' && <p className="rounded-3xl bg-surface p-4 text-sm text-fg/70">নোটিফিকেশন ব্লক করা আছে। ব্রাউজার বা ফোনের সেটিংস থেকে অ্যাপের অনুমতি চালু করুন।</p>}
      {(ps === 'off' || ps === 'on') && (
        <button disabled={busy} onClick={toggle} className={`flex w-full items-center gap-3 rounded-3xl p-4 text-left ${ps === 'on' ? 'bg-surface text-fg' : 'bg-ink text-white'}`}>
          {ps === 'on' ? <BellOff size={22} /> : <Bell size={22} />}
          <span className="flex-1 text-sm">{ps === 'on' ? 'ব্যাকগ্রাউন্ড অ্যালার্ট চালু আছে (বন্ধ করতে চাপুন)' : 'অ্যাপ বন্ধ থাকলেও অ্যালার্ট পেতে চালু করুন'}</span>
          {ps === 'off' && <span className="rounded-2xl bg-surface px-3 py-1.5 text-sm font-bold text-fg">চালু</span>}
        </button>
      )}
      {ps === 'on' && (
        <button onClick={async () => {
          try { const r = await navigator.serviceWorker.ready; await r.showNotification(`${APP_NAME} — টেস্ট`, { body: 'সাউন্ড আসছে? না এলে ফোন/পিসির নোটিফিকেশন সেটিংসে সাউন্ড চালু করুন।', icon: '/icons/icon-192.png', tag: 'apon-test', renotify: true, silent: false, vibrate: [200, 100, 200] }) } catch (e) { setErr(e.message) }
        }} className="w-full rounded-3xl bg-surface p-3 text-sm font-bold text-fg">🔔 টেস্ট নোটিফিকেশন পাঠান</button>
      )}
      {err && <p className="text-sm text-danger">{err}</p>}

      {items.length === 0 && <p className="py-10 text-center text-fg/60">এখনও কোনো নোটিফিকেশন নেই।</p>}
      {items.map((n) => (
        <Link key={n.id} to={target(n)} className={`flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft ${n.read ? '' : 'ring-2 ring-brand/40'}`}>
          <Avatar p={n.actor} size={48} />
          <div className="min-w-0 flex-1">
            <p className="leading-snug"><b>{n.actor?.full_name}</b> {NOTIF_TEXT[n.type]}</p>
            <p className="text-xs text-fg/50">{fmt(n.created_at)}</p>
          </div>
          {!n.read && <span className="h-2.5 w-2.5 rounded-full bg-coral" />}
        </Link>
      ))}
    </div>
  )
}
