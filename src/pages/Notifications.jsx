import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, BellOff, Volume2 } from 'lucide-react'
import { useNotifs, NOTIF_TEXT } from '../context/Notifications'
import { fmt } from '../lib/constants'
import { pushState, enablePush, disablePush } from '../lib/push'
import Avatar from '../components/Avatar'
import { playDing, unlockAudio } from '../lib/sound'

const target = (n) => (n.link ? n.link : n.post_id ? `/post/${n.post_id}` : n.type === 'friend_request' ? '/friends' : `/profile/${n.actor_id}`)
const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone

export default function Notifications() {
  const { items, markAllRead } = useNotifs()
  const [ps, setPs] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => () => { markAllRead() }, [markAllRead])
  useEffect(() => { pushState().then(setPs) }, [])

  const toggle = async () => {
    setBusy(true); setErr('')
    try { ps === 'on' ? await disablePush() : await enablePush() } catch (e) { setErr(e.message) }
    setPs(await pushState()); setBusy(false)
  }

  const testAlert = async () => {
    unlockAudio(); playDing()
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('আপন — টেস্ট নোটিফিকেশন', {
        body: 'এই নোটিফিকেশনে শব্দ ও কম্পন এলে সেটিং ঠিক আছে।',
        icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
        tag: `test-${Date.now()}`, renotify: true, silent: false, vibrate: [200, 100, 200],
      })
    } catch (e) { setErr('টেস্ট নোটিফিকেশন দেখানো যায়নি: ' + e.message) }
  }

  return (
    <div className="space-y-3 pt-2">
      <h2 className="text-2xl font-extrabold">নোটিফিকেশন</h2>

      {ps === 'unsupported' && (
        <p className="rounded-3xl bg-surface p-4 text-sm text-fg/70">
          {iOS && !installed ? 'iPhone-এ অ্যালার্ট পেতে আগে Safari থেকে "Add to Home Screen" করে অ্যাপটি ইনস্টল করুন, তারপর হোম স্ক্রিনের আইকন থেকে খুলুন।' : 'এই ব্রাউজারে ব্যাকগ্রাউন্ড অ্যালার্ট সমর্থিত নয়।'}
        </p>
      )}
      {ps === 'nokey' && <p className="rounded-3xl bg-surface p-4 text-sm text-danger">VITE_VAPID_PUBLIC_KEY সেট করা হয়নি — ডিপ্লয়ের ধাপগুলো দেখুন।</p>}
      {ps === 'denied' && <p className="rounded-3xl bg-surface p-4 text-sm text-fg/70">নোটিফিকেশন ব্লক করা আছে। ব্রাউজার বা ফোনের সেটিংস থেকে আপন অ্যাপের অনুমতি চালু করুন।</p>}
      {(ps === 'off' || ps === 'on') && (
        <button disabled={busy} onClick={toggle} className={`flex w-full items-center gap-3 rounded-3xl p-4 text-left ${ps === 'on' ? 'bg-surface text-fg' : 'bg-ink text-white'}`}>
          {ps === 'on' ? <BellOff size={22} /> : <Bell size={22} />}
          <span className="flex-1 text-sm">{ps === 'on' ? 'ব্যাকগ্রাউন্ড অ্যালার্ট চালু আছে (বন্ধ করতে চাপুন)' : 'অ্যাপ বন্ধ থাকলেও অ্যালার্ট পেতে চালু করুন'}</span>
          {ps === 'off' && <span className="rounded-2xl bg-surface px-3 py-1.5 text-sm font-bold text-fg">চালু</span>}
        </button>
      )}
      {err && <p className="text-sm text-danger">{err}</p>}

      {(ps === 'on' || ps === 'off') && (
        <div className="rounded-3xl bg-surface p-4 shadow-soft">
          <button onClick={testAlert} className="flex w-full items-center gap-3 text-left">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand/15 text-brand"><Volume2 size={20} /></span>
            <span className="flex-1"><b className="block">সাউন্ড টেস্ট করুন</b><span className="text-xs text-fg/55">অ্যাপ বন্ধ থাকলে শব্দ আসবে কিনা এখানে যাচাই করুন</span></span>
          </button>
          <details className="mt-3 text-sm text-fg/70">
            <summary className="cursor-pointer font-semibold text-brand">নোটিফিকেশনে শব্দ না এলে</summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>অ্যাপ বন্ধ থাকলে নোটিফিকেশনের শব্দ ফোন/কম্পিউটার নিজে বাজায়, অ্যাপ নয়। তাই সেটিং দেখতে হবে:</p>
              <p><b>Android:</b> আসা নোটিফিকেশনে চেপে ধরুন → সেটিংস → "সাউন্ড" চালু করে গুরুত্ব "High/Default" দিন। Xiaomi/Redmi-তে: Settings → Notifications → App notifications → Chrome (বা আপন) → "Sound" ও "Pop-up" চালু করুন, আর Battery saver → "No restrictions" দিন।</p>
              <p><b>iPhone:</b> Settings → Notifications → আপন → Sounds চালু। Silent Mode ও Focus বন্ধ রাখুন।</p>
              <p><b>Windows:</b> Settings → System → Notifications-এ Chrome চালু, "Allow notifications to play sounds" চালু করুন। Focus assist বন্ধ রাখুন।</p>
            </div>
          </details>
        </div>
      )}

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
