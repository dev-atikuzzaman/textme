import { useState } from 'react'
import { Pin } from 'lucide-react'

// চ্যাটের ওপরে পিন করা মেসেজ। চাপলে ওই মেসেজে যায়; একাধিক হলে পরেরটা দেখায়
export default function PinnedBanner({ pinned, onJump }) {
  const [i, setI] = useState(0)
  if (!pinned.length) return null
  const idx = i % pinned.length
  const m = pinned[idx]
  const text = m.content || (m.type === 'image' ? '📷 ছবি' : m.type === 'voice' ? '🎤 ভয়েস মেসেজ' : '📎 মেসেজ')
  return (
    <button onClick={() => { onJump(m.id); setI(idx + 1) }} className="flex w-full items-center gap-2.5 border-b border-fg/5 bg-surface px-4 py-2 text-left">
      <Pin size={16} className="shrink-0 text-brand" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold text-brand">পিন করা মেসেজ{pinned.length > 1 ? ` • ${(idx + 1).toLocaleString('bn-BD')}/${pinned.length.toLocaleString('bn-BD')}` : ''}</span>
        <span className="block truncate text-sm">{text}</span>
      </span>
    </button>
  )
}
