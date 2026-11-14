// লেখা-স্টোরির ব্যাকগ্রাউন্ড গ্রেডিয়েন্ট
export const STORY_BG = [
  'linear-gradient(160deg,#0e7c5f,#2bd9ac)',
  'linear-gradient(160deg,#7c2d12,#f5b942)',
  'linear-gradient(160deg,#312e81,#7c3aed)',
  'linear-gradient(160deg,#9f1239,#fb7185)',
  'linear-gradient(160deg,#0c4a6e,#38bdf8)',
  'linear-gradient(160deg,#1f2937,#4b5563)',
]

export function ago(d) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'এইমাত্র'
  if (m < 60) return `${m.toLocaleString('bn-BD')} মিনিট আগে`
  return `${Math.floor(m / 60).toLocaleString('bn-BD')} ঘণ্টা আগে`
}
