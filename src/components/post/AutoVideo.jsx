import { useEffect, useRef } from 'react'
import { playWithSound, useVideoMuted } from '../../lib/videoSound'

// স্ক্রিনে এলে সাউন্ডসহ চলে, স্ক্রল করে সরে গেলে থেমে যায় (ফেসবুক/টিকটকের মতো)
export default function AutoVideo({ src }) {
  const ref = useRef()
  const [muted] = useVideoMuted()
  useEffect(() => {
    const v = ref.current
    const io = new IntersectionObserver(([e]) => {
      if (e.intersectionRatio >= 0.6) playWithSound(v)
      else v.pause()
    }, { threshold: [0, 0.6] })
    io.observe(v)
    return () => io.disconnect()
  }, [])
  useEffect(() => { if (ref.current) ref.current.muted = muted }, [muted])
  return <video ref={ref} src={src} controls playsInline preload="metadata" className="max-h-[480px] w-full rounded-2xl bg-black" />
}
