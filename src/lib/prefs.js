// দেখার ধরন: থিম (লাইট/ডার্ক/অটো) ও লেখার সাইজ। এই ডিভাইসে সেভ থাকে।
// index.html-এর ছোট স্ক্রিপ্ট পেজ আঁকার আগেই এগুলো বসিয়ে দেয়, তাই চোখে ঝলকানি লাগে না।
const TK = 'apon-theme', FK = 'apon-font'
export const FONT_SIZES = { sm: 16, md: 18, lg: 20, xl: 22 } // px; ডিফল্ট md = আগের ১৮px
export const THEME_COLOR = { light: '#f8fbf9', dark: '#0d1512' }

const get = (k, d) => { try { return localStorage.getItem(k) || d } catch { return d } }
const put = (k, v) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

export const getTheme = () => { const t = get(TK, 'light'); return ['light', 'dark', 'auto'].includes(t) ? t : 'light' }
export const getFont = () => { const f = get(FK, 'md'); return FONT_SIZES[f] ? f : 'md' }
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches

export function applyPrefs() {
  const t = getTheme(), dark = t === 'dark' || (t === 'auto' && systemDark())
  const root = document.documentElement
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.fontSize = FONT_SIZES[getFont()] + 'px'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light)
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', dark ? 'dark' : 'light')
}
export const setTheme = (t) => { put(TK, t); applyPrefs() }
export const setFont = (f) => { put(FK, f); applyPrefs() }

// "অটো" থাকলে ফোনের ডার্ক/লাইট বদলালে সাথে সাথে বদলে যায়
export function watchSystemTheme() {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  if (!mq) return () => {}
  const f = () => { if (getTheme() === 'auto') applyPrefs() }
  mq.addEventListener?.('change', f)
  return () => mq.removeEventListener?.('change', f)
}
