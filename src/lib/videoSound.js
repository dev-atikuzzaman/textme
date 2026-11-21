import { useEffect, useState } from 'react'

// সব ভিডিওর (ফিড, রিলস, ইউটিউব রিলস) সাউন্ড-সেটিং এক জায়গায়। ডিফল্ট = সাউন্ড চালু।
// ইউজার একবার মিউট করলে সেটা মনে রাখা হয় (সব ভিডিওতে), আবার আনমিউট করলে চালু।
const KEY = 'apon-video-muted'
let muted = (() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })()
const subs = new Set()

export const getVideoMuted = () => muted
export const setVideoMuted = (m) => {
  muted = !!m
  try { localStorage.setItem(KEY, muted ? '1' : '0') } catch { /* ignore */ }
  subs.forEach((f) => f(muted))
}

export function useVideoMuted() {
  const [m, set] = useState(muted)
  useEffect(() => { subs.add(set); set(muted); return () => { subs.delete(set) } }, [])
  return [m, setVideoMuted]
}

const GEST = ['pointerdown', 'touchstart', 'keydown']

// সাউন্ডসহ চালায়। ব্রাউজার (বিশেষ করে iPhone/প্রথম লোডে) ব্লক করলে নিঃশব্দে চালু করে,
// ইউজারের পরের যেকোনো ট্যাপেই সাউন্ড চালু করে দেয়।
export function playWithSound(v) {
  if (!v) return
  v.muted = muted
  const p = v.play()
  if (p && p.catch) {
    p.catch(() => {
      v.muted = true
      v.play().catch(() => {})
      if (muted) return
      const un = () => {
        GEST.forEach((e) => window.removeEventListener(e, un))
        if (!muted && v.isConnected) { v.muted = false; v.play().catch(() => {}) }
      }
      GEST.forEach((e) => window.addEventListener(e, un, { passive: true }))
    })
  }
}
