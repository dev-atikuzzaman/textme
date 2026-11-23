// পরিবার: সম্পর্কের তালিকা, জন্মদিনের হিসাব, অনুষ্ঠানের ধরন ও আমন্ত্রণ-লিংকের হেল্পার।
export const PENDING_INVITE = 'apon-invite'
export const inviteUrl = (code) => `${window.location.origin}/join/${code}`

// gen = প্রজন্ম: +২ দাদা/নানা, +১ বাবা-মায়ের প্রজন্ম, ০ নিজের, −১ সন্তানের, −২ নাতি-নাতনির (null = বন্ধু/অন্যান্য)
export const RELATIONS = [
  { id: 'dada', label: 'দাদা', gen: 2 }, { id: 'dadi', label: 'দাদি', gen: 2 }, { id: 'nana', label: 'নানা', gen: 2 }, { id: 'nani', label: 'নানি', gen: 2 },
  { id: 'baba', label: 'বাবা', gen: 1 }, { id: 'ma', label: 'মা', gen: 1 },
  { id: 'chacha', label: 'চাচা', gen: 1 }, { id: 'chachi', label: 'চাচি', gen: 1 }, { id: 'mama', label: 'মামা', gen: 1 }, { id: 'mami', label: 'মামি', gen: 1 },
  { id: 'khala', label: 'খালা', gen: 1 }, { id: 'khalu', label: 'খালু', gen: 1 }, { id: 'fufu', label: 'ফুফু', gen: 1 }, { id: 'fufa', label: 'ফুফা', gen: 1 },
  { id: 'shoshur', label: 'শ্বশুর', gen: 1 }, { id: 'shashuri', label: 'শাশুড়ি', gen: 1 },
  { id: 'shami', label: 'স্বামী', gen: 0 }, { id: 'stri', label: 'স্ত্রী', gen: 0 },
  { id: 'bhai', label: 'ভাই', gen: 0 }, { id: 'bon', label: 'বোন', gen: 0 }, { id: 'bhabi', label: 'ভাবি', gen: 0 }, { id: 'dulabhai', label: 'দুলাভাই', gen: 0 },
  { id: 'cousin', label: 'কাজিন (চাচাতো/মামাতো/খালাতো/ফুফাতো)', short: 'কাজিন', gen: 0 },
  { id: 'chele', label: 'ছেলে', gen: -1 }, { id: 'meye', label: 'মেয়ে', gen: -1 }, { id: 'putrobodhu', label: 'ছেলের বউ', gen: -1 }, { id: 'jamai', label: 'জামাই', gen: -1 },
  { id: 'bhatija', label: 'ভাতিজা', gen: -1 }, { id: 'bhatiji', label: 'ভাতিজি', gen: -1 }, { id: 'bhagne', label: 'ভাগ্নে', gen: -1 }, { id: 'bhagni', label: 'ভাগ্নি', gen: -1 },
  { id: 'nati', label: 'নাতি', gen: -2 }, { id: 'natni', label: 'নাতনি', gen: -2 },
  { id: 'friend', label: 'বন্ধু', gen: null }, { id: 'other', label: 'অন্যান্য আত্মীয়', short: 'আত্মীয়', gen: null },
]
export const REL = Object.fromEntries(RELATIONS.map((r, i) => [r.id, { ...r, order: i }]))
export const relLabel = (id) => REL[id]?.short || REL[id]?.label || id
export const GENERATIONS = [
  { gen: 2, title: 'দাদা-দাদি, নানা-নানি' },
  { gen: 1, title: 'বাবা-মা ও গুরুজন' },
  { gen: 0, title: 'আপনি ও সমবয়সী' },
  { gen: -1, title: 'সন্তান ও পরের প্রজন্ম' },
  { gen: -2, title: 'নাতি-নাতনি' },
]

export const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
export const bn = (n) => Number(n).toLocaleString('bn-BD', { useGrouping: false })
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
export const daysIn = (month, year = 2024) => new Date(year, month, 0).getDate() // month = ১–১২; সাল না জানলে লিপ বছর ধরে

// পরের জন্মদিন কবে: { date, days (আজ থেকে কত দিন পর), turning (কত বছর হবে; সাল জানা থাকলে) }
export function nextBirthday(b, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const make = (y) => new Date(y, b.month - 1, b.month === 2 && b.day === 29 && !isLeap(y) ? 28 : b.day)
  let d = make(today.getFullYear())
  if (d < today) d = make(today.getFullYear() + 1)
  return { date: d, days: Math.round((d - today) / 86400000), turning: b.year ? d.getFullYear() - b.year : null }
}
export const dayWord = (days) => (days === 0 ? 'আজ' : days === 1 ? 'আগামীকাল' : `${bn(days)} দিন পর`)
export const fmtDate = (d) => new Date(d).toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long' })
export const fmtTime = (d) => new Date(d).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
// অনুষ্ঠান আজ থেকে কত দিন পর (ডিভাইসের সময় অনুযায়ী)
export const eventDays = (iso, now = new Date()) => {
  const a = new Date(iso), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()) - t0) / 86400000)
}

export const EVENT_KINDS = [
  { id: 'eid', label: 'ঈদ', emoji: '🌙', titles: ['ঈদ-উল-ফিতর', 'ঈদ-উল-আযহা', 'ঈদ পুনর্মিলনী'] },
  { id: 'wedding', label: 'বিয়ে', emoji: '💍', titles: ['বিয়ের অনুষ্ঠান', 'গায়ে হলুদ', 'বৌভাত'] },
  { id: 'milad', label: 'মিলাদ/দোয়া', emoji: '🤲', titles: ['মিলাদ ও দোয়া মাহফিল', 'কুলখানি'] },
  { id: 'gathering', label: 'পারিবারিক আড্ডা', emoji: '🏡', titles: ['পারিবারিক মিলনমেলা', 'বনভোজন'] },
  { id: 'birthday', label: 'জন্মদিন পার্টি', emoji: '🎂', titles: ['জন্মদিনের অনুষ্ঠান'] },
  { id: 'other', label: 'অন্যান্য', emoji: '📅', titles: [] },
]
export const KIND = Object.fromEntries(EVENT_KINDS.map((k) => [k.id, k]))
export const RSVP = [{ id: 'going', label: 'যাচ্ছি ✅' }, { id: 'maybe', label: 'হয়তো 🤔' }, { id: 'no', label: 'পারব না ❌' }]
export const tableMissing = (e) => /relation|schema cache|does not exist|could not find the function/i.test(e?.message || '')
