import { useState } from 'react'
import { X, Sun, Moon, SunMoon, Check } from 'lucide-react'
import { getTheme, setTheme, getFont, setFont, FONT_SIZES } from '../lib/prefs'

const THEMES = [
  { id: 'light', label: 'লাইট', Icon: Sun },
  { id: 'dark', label: 'ডার্ক', Icon: Moon },
  { id: 'auto', label: 'ফোন অনুযায়ী', Icon: SunMoon },
]
const FONTS = [
  { id: 'sm', label: 'ছোট' },
  { id: 'md', label: 'স্বাভাবিক' },
  { id: 'lg', label: 'বড়' },
  { id: 'xl', label: 'অনেক বড়' },
]

// প্রোফাইল → "দেখার ধরন": থিম ও লেখার সাইজ বদলান (সাথে সাথে প্রয়োগ হয়)
export default function AppearanceSheet({ onClose }) {
  const [theme, setT] = useState(getTheme)
  const [font, setF] = useState(getFont)

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="দেখার ধরন"
        className="max-h-[90dvh] w-full max-w-md space-y-5 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">দেখার ধরন</h2>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>

        <section>
          <p className="mb-2 font-bold">থিম</p>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => { setTheme(id); setT(id) }} aria-pressed={theme === id}
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-sm font-semibold transition active:scale-95 ${theme === id ? 'bg-brand/15 text-brand ring-2 ring-brand' : 'bg-surface2 text-fg/80'}`}>
                <Icon size={22} />{label}
                {theme === id && <Check size={14} className="absolute right-1.5 top-1.5" />}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 font-bold">লেখার সাইজ</p>
          <div className="grid grid-cols-4 gap-2">
            {FONTS.map(({ id, label }) => (
              <button key={id} onClick={() => { setFont(id); setF(id) }} aria-pressed={font === id}
                className={`rounded-2xl px-1 py-3 text-xs font-semibold transition active:scale-95 ${font === id ? 'bg-brand/15 text-brand ring-2 ring-brand' : 'bg-surface2 text-fg/80'}`}>
                <span style={{ fontSize: FONT_SIZES[id] }} className="block leading-none">অ</span>
                <span className="mt-1.5 block">{label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-2xl bg-surface2 p-3">
            <p className="text-fg/65 text-xs">নমুনা</p>
            <p className="mt-1">পরিবারের সবার সাথে আপন ঠিকানায় — আজ কেমন আছেন সবাই?</p>
          </div>
          <p className="mt-2 text-xs text-fg/65">বড়দের জন্য "বড়" বা "অনেক বড়" বেছে নিলে সব লেখা সহজে পড়া যাবে।</p>
        </section>
      </div>
    </div>
  )
}
