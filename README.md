# বন্ধু (আপন) — Family Social App
React + Vite + Tailwind + Supabase. Deploy: Vercel.

## চালু করা
1. `.env` (লোকাল) বা Vercel Environment Variables-এ দিন: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
2. `npm install && npm run dev`
3. ডেটাবেস: নিচের "ডেটাবেস migration" দেখুন

## ডেটাবেস migration
সব SQL এখন `supabase/migrations/` ফোল্ডারে, ক্রমিক নম্বরসহ (`0000_schema.sql` … `0022_update-24.sql`)। আগের `update-N.sql` ফাইলগুলোই এখানে `00NN_update-N.sql` নামে আছে, বিষয়বস্তু একই। (অ্যাপের মেসেজে "update-22.sql চালান" লেখা থাকলে মানে সেই migration।)

**নতুন প্রজেক্ট:** Supabase → SQL Editor-এ `supabase/all-in-one.sql` পুরোটা Run করুন।

**আগে থেকে হাতে সব চালানো থাকলে (আপনার বর্তমান ডেটাবেস):** একবার `supabase/migrations/_baseline.sql` Run করুন। এটি কিছু বদলায় না, শুধু `schema_migrations` টেবিলে "এগুলো প্রয়োগ হয়ে গেছে" লিখে রাখে।

**নতুন migration যোগ করলে:**
1. `supabase/migrations/0023_নাম.sql` নামে ফাইল বানান (আগের নম্বরের পরের নম্বর)
2. `npm run build:sql` চালান (all-in-one.sql নতুন করে তৈরি হয়)
3. `supabase/all-in-one.sql` Supabase-এ Run করুন — যেগুলো আগে প্রয়োগ হয়েছে সেগুলো বাদ যাবে, শুধু নতুনটা চলবে

`supabase/optional/` — একবারের মেরামত/পরিষ্কারের স্ক্রিপ্ট (`fix-push-url.sql` ইত্যাদি)। এগুলো স্বয়ংক্রিয় ক্রমে নেই; দরকার হলে হাতে চালান।

## টেস্ট ও কোড-মান
- `npm test` — SQL টেস্ট (PGlite, কোনো সার্ভার লাগে না): migration ক্রম/পুনরায়-চালানো, RLS ও কলাম-সুরক্ষা, গোপনীয়তা, গ্রুপের দৃশ্যমানতা
- `npm run build:test && npm run test:e2e` — ব্রাউজার টেস্ট (নকল Supabase): চ্যাট/প্রোফাইল পেজিনেশন, গ্রুপ ইনফো শিট, অ্যাক্সেসিবিলিটি (axe-core: বাটনের নাম, alt, কনট্রাস্ট; ডায়ালগে Esc/ফোকাস-ট্র্যাপ)। প্রথমবার `npx playwright install chromium`
- `npm run lint` — ESLint: undefined ভ্যারিয়েবল/কম্পোনেন্ট (যেমন ভুলে import না করা আইকন) ও হুকের নিয়ম ধরে

## অ্যাক্সেসিবিলিটি (কীভাবে কাজ করে)
`src/lib/a11yDialogs.js` সব মডাল/শিটকে (`fixed inset-0 z-[৬০+] bg-ink|black`) স্বয়ংক্রিয়ভাবে `role="dialog"` করে, Esc-তে বন্ধ করে, ফোকাস ভেতরে ধরে রাখে ও বন্ধ হলে ফেরত দেয়। নতুন শিট এই কাঠামো মানলে আলাদা কিছু লাগে না। নিজে Esc সামলালে ব্যাকড্রপে `data-own-esc` দিন।
লেখার রঙ: ধূসর লেখায় `text-fg/65` বা তার বেশি ব্যবহার করুন (এর কম হলে কনট্রাস্ট ফেল করে); ব্র্যান্ড-রঙের ছোট লেখায় `text-brandtext`।
