import { useEffect, useRef } from 'react'

// স্ক্রিনে এলে নিঃশব্দে চলে, স্ক্রল করে সরে গেলে থেমে যায় (ফেসবুক/টিকটকের মতো)
export default function AutoVideo({ src }) {
  const ref = useRef()
  useEffect(() => {
    const v = ref.current
    const io = new IntersectionObserver(([e]) => {
      if (e.intersectionRatio >= 0.6) v.play().catch(() => {})
      else v.pause()
    }, { threshold: [0, 0.6] })
    io.observe(v)
    return () => io.disconnect()
  }, [])
  return <video ref={ref} src={src} controls muted playsInline preload="metadata" className="max-h-[480px] w-full rounded-2xl bg-black" />
}
