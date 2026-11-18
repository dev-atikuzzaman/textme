import { useState } from 'react'
import { Play } from 'lucide-react'
import { ytThumb, ytEmbed } from '../lib/yt'

// ক্লিক করলে অ্যাপের ভেতরেই ইউটিউব প্লেয়ার চালু হয় (পোস্ট/চ্যাটের লিংকে)
export default function YouTubeEmbed({ id, className = '' }) {
  const [on, setOn] = useState(false)
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-black ${className}`}>
      {on ? (
        <iframe src={ytEmbed(id)} title="YouTube" className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label="ইউটিউব ভিডিও চালান" className="group h-full w-full">
          <img src={ytThumb(id)} alt="" loading="lazy" className="h-full w-full object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-black/20"><span className="grid h-14 w-14 place-items-center rounded-full bg-red-600 text-white shadow-lg transition group-active:scale-90"><Play size={26} fill="currentColor" /></span></span>
        </button>
      )}
    </div>
  )
}
