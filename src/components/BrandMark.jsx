import { useId } from 'react'
// অ্যাপ আইকনের মার্ক (public/icons-এর সাথে মেলানো)
// প্রতিটি কপির আলাদা id: নইলে লুকানো (hidden সাইডবার) কপির গ্র্যাডিয়েন্ট ধরে লোগো সাদা/ফাঁকা দেখাত
export default function BrandMark({ size = 40, className = '' }) {
  const u = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`bm-bg${u}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#14b8a6" /><stop offset=".55" stopColor="#0f766e" /><stop offset="1" stopColor="#064e3b" /></linearGradient>
        <linearGradient id={`bm-gold${u}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
        <clipPath id={`bm-l${u}`}><circle cx="212" cy="256" r="112" /></clipPath>
      </defs>
      <rect width="512" height="512" rx="118" fill={`url(#bm-bg${u})`} />
      <circle cx="212" cy="256" r="112" fill="none" stroke="#fff" strokeWidth="22" strokeOpacity=".95" />
      <circle cx="300" cy="256" r="112" fill="none" stroke="#fff" strokeWidth="22" strokeOpacity=".95" />
      <circle cx="300" cy="256" r="112" fill={`url(#bm-gold${u})`} clipPath={`url(#bm-l${u})`} />
    </svg>
  )
}
