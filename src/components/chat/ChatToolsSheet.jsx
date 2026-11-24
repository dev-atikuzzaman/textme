import { Search, Timer, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast, errMsg } from '../../lib/ui'

export const TTL_OPTIONS = [
  { s: 0, l: 'বন্ধ' },
  { s: 86400, l: '২৪ ঘণ্টা' },
  { s: 604800, l: '৭ দিন' },
  { s: 7776000, l: '৯০ দিন' },
]
export const ttlLabel = (s) => TTL_OPTIONS.find((o) => o.s === s)?.l || `${s} সেকেন্ড`

// ১-১ চ্যাটের টুলস: মেসেজ খোঁজা + অদৃশ্য হওয়া মেসেজ (দুজনের জন্য একই সেটিং)
export default function ChatToolsSheet({ otherId, ttl, onTtl, onSearch, onClose }) {
  const setTtl = async (s) => {
    const { error } = await supabase.rpc('set_chat_ttl', { p_other: otherId, p_secs: s })
    if (error) {
      const m = error.message || ''
      return toast.error(/could not find the function|schema cache/i.test(m) ? 'চালু হয়নি — update-22.sql চালানো হয়নি'
        : /not allowed/i.test(m) ? 'শুধু বন্ধুদের চ্যাটে এটি বদলানো যায়' : errMsg(error))
    }
    onTtl(s)
    toast.success(s ? `এখন থেকে নতুন মেসেজ ${ttlLabel(s)} পর মুছে যাবে` : 'অদৃশ্য হওয়া মেসেজ বন্ধ করা হয়েছে')
  }
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="চ্যাট টুলস" className="pop-in w-full max-w-md space-y-3 rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">চ্যাট টুলস</h2>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        <button onClick={() => { onClose(); onSearch() }} className="flex w-full items-center gap-4 rounded-2xl bg-surface2 p-4 font-semibold"><Search size={20} />মেসেজ খুঁজুন</button>
        <div className="rounded-2xl bg-surface2 p-4">
          <p className="mb-2 flex items-center gap-2 font-semibold"><Timer size={20} />অদৃশ্য হওয়া মেসেজ</p>
          <div className="grid grid-cols-4 gap-2">
            {TTL_OPTIONS.map((o) => (
              <button key={o.s} onClick={() => setTtl(o.s)} aria-pressed={ttl === o.s}
                className={`rounded-xl px-1 py-2.5 text-sm font-semibold ${ttl === o.s ? 'bg-brand text-inverse' : 'bg-surface'}`}>{o.l}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-fg/65">চালু করলে এরপর পাঠানো নতুন মেসেজগুলো নির্দিষ্ট সময় পর দুজনের চ্যাট থেকেই মুছে যাবে। আগের মেসেজ যেমন আছে তেমনই থাকবে।</p>
        </div>
      </div>
    </div>
  )
}
