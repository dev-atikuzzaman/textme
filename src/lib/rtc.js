import { supabase } from './supabase'

// ── ICE সার্ভার (STUN + TURN) ──
// ১) ডিফল্টে ফ্রি STUN। মোবাইল ডেটা/কড়া নেটওয়ার্কে কল ধরতে TURN লাগে।
// ২) Edge Function `turn-credentials` (Cloudflare TURN) থেকে সময়-সীমিত credential আনা হয় — কোনো পাসওয়ার্ড ব্রাউজারে থাকে না।
// ৩) ফাংশন ডিপ্লয় না থাকলে/ব্যর্থ হলে STUN (+ ঐচ্ছিক VITE_TURN_* স্ট্যাটিক TURN) দিয়েই চলে — কল আটকায় না।
const staticTurn = import.meta.env.VITE_TURN_URL
  ? [{ urls: import.meta.env.VITE_TURN_URL.split(','), username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL }]
  : []
const baseServers = () => [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }, ...staticTurn]

// পরিবর্তনযোগ্য অবজেক্ট: `new RTCPeerConnection(ICE)` কল করার মুহূর্তের মান পড়ে, তাই কল-সাইট বদলাতে হয়নি
export const ICE = { iceServers: baseServers() }

const FRESH_MS = 6 * 60 * 60 * 1000 // ৬ ঘণ্টা ক্যাশ (credential-এর মেয়াদ ১২ ঘণ্টা)
const RETRY_MS = 60 * 1000          // ব্যর্থ হলে ১ মিনিট আর চেষ্টা নয়
const WAIT_MS = 4000                // কল শুরু আটকে রাখার সর্বোচ্চ সময়
let fetchedAt = 0, failedAt = 0, inflight = null

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

// কল শুরুর আগে await করুন। ক্যাশ থাকলে সাথে সাথে ফেরে; কখনো throw করে না।
export function ensureIce() {
  const now = Date.now()
  if (now - fetchedAt < FRESH_MS || now - failedAt < RETRY_MS) return Promise.resolve(ICE)
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const { data, error } = await withTimeout(supabase.functions.invoke('turn-credentials'), WAIT_MS)
      const list = data?.iceServers
      if (error || !Array.isArray(list) || !list.length) throw new Error('no ice')
      ICE.iceServers = [...list, ...staticTurn]
      fetchedAt = Date.now()
    } catch {
      failedAt = Date.now()
    } finally {
      inflight = null
    }
    return ICE
  })()
  return inflight
}

// লগ-আউটে ক্যাশ মুছে ফেলুন (ঐচ্ছিক)
export const resetIce = () => { fetchedAt = 0; failedAt = 0; ICE.iceServers = baseServers() }
