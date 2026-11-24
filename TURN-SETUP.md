# Cloudflare TURN সেটআপ (ফ্রি — প্রতি মাসে ১,০০০ GB)

## বদলানো/নতুন ফাইল (প্রজেক্টে একই পাথে বসান)
- `supabase/functions/turn-credentials/index.ts` — নতুন
- `src/lib/rtc.js` — বদলেছে (`ensureIce()` যোগ)
- `src/context/Call.jsx` — ৪টি ছোট লাইন
- `src/context/GroupCall.jsx` — ২টি ছোট লাইন

## ১. Cloudflare-এ TURN key বানান
Dashboard → Realtime (Calls) → TURN Server → **Create**। পাবেন `TURN Key ID` আর `API Token`।

## ২. Supabase-এ secret দিন
```
supabase secrets set CF_TURN_KEY_ID=xxxxxxxx CF_TURN_API_TOKEN=yyyyyyyy
```
(অথবা Dashboard → Edge Functions → Secrets)

## ৩. ফাংশন ডিপ্লয় (JWT যাচাই চালু রাখুন — --no-verify-jwt দেবেন না)
```
supabase functions deploy turn-credentials
```

## ৪. অ্যাপ ডিপ্লয়
`VITE_TURN_*` env আর লাগবে না (থাকলেও ফলব্যাক হিসেবে চলবে)। Vercel-এ push করুন।

## ৫. টেস্ট
- ব্রাউজার DevTools → Network-এ লগ-ইনের পরে `turn-credentials` রিকোয়েস্টে `200` ও `iceServers` দেখুন।
- এক ফোন মোবাইল ডেটায়, আরেকটি Wi-Fi-তে রেখে কল দিন।
- সমস্যা হলে: ফাংশন লগে `503` = secret সেট হয়নি, `502` = key/token ভুল। ফাংশন ব্যর্থ হলেও কল STUN দিয়ে চলে, শুধু কড়া নেটওয়ার্কে ধরবে না।
