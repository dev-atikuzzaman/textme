# পোলিশ + পরিবার আপডেট (ধাপ ১–৭ ও ফ্যামিলি ফিচার) — পরিবর্তনের তালিকা

আপনার `textme-main_301061.zip`-এর ওপর বসানো। অন্য ফাইলে আপনার নিজের কাজ চললে শুধু নিচের ফাইলগুলো মিলিয়ে নিলেই চলবে।

## ডিপ্লয়ের আগে ৫টি কাজ
1. প্রজেক্ট ফোল্ডারে `npm install` চালান (নতুন প্যাকেজ `qrcode` — আমন্ত্রণ QR বানানোর জন্য)।
2. **Supabase → SQL Editor**-এ `supabase/update-22.sql` (ধাপ ৫–৭), তারপর `supabase/update-23.sql` (পরিবার) একবার করে Run করুন। দুটোই একাধিকবার চালালেও সমস্যা নেই।
3. **Edge Function `send-push`** আবার ডিপ্লয় করুন (`supabase/functions/send-push/index.ts`-এর নতুন কোড)।
4. জন্মদিন/অনুষ্ঠানের পুশ রিমাইন্ডারের জন্য Supabase → Database → Extensions-এ **pg_cron** চালু করুন, তারপর `update-23.sql` আবার Run করুন (প্রতিদিন সকাল ৮টায় (বাংলাদেশ সময়) চলবে)। pg_cron না থাকলে অ্যাপের ভেতরের কার্ড কাজ করবে, শুধু পুশ যাবে না।
5. অ্যাপ ডিপ্লয়ের পর পুরনো Service Worker আটকে থাকলে ব্রাউজারে Site settings থেকে Clear data করে আবার খুলুন।

## ধাপ অনুযায়ী
1. টোস্ট/কনফার্ম: `lib/ui.js`, `components/UIHost.jsx`। ৪৫টির বেশি `alert/confirm` বদলেছে।
2. ব্যর্থতা সামলানো: `ErrorBoundary`, `OfflineBanner`, চ্যাট ও গ্রুপ চ্যাটে "পাঠানো হচ্ছে / ব্যর্থ, আবার পাঠান", `sw.js`।
3. গতি: `React.lazy` পেজ, `compressImage` (media.js), `SmartImg` (ঝিলিমিলি + ফেড-ইন)।
4. থিম ও লেখার সাইজ: `lib/prefs.js`, `AppearanceSheet`, `index.css` (ডার্ক), `index.html`।
5. নোটিফিকেশন: `NotifSettingsSheet` (ক্যাটেগরি অন/অফ, চুপ থাকার সময়), `lib/notifPrefs.js`, অ্যাপ আইকন ব্যাজ (Layout.jsx), `send-push` সার্ভার ফিল্টার।
6. চ্যাট: মেসেজ খোঁজা, ওয়েভফর্মসহ ভয়েস প্লেয়ার (`VoicePlayer`), পিন করা মেসেজ, অদৃশ্য হওয়া মেসেজ (১-১ চ্যাট), মেসেজ চেপে ধরলে মেনু (কপি/পিন)। গ্রুপ চ্যাটে খোঁজা ও পিন।
7. গোপনীয়তা: রিপোর্ট (`ReportSheet`, পোস্ট ও ব্যবহারকারী), লগইন করা ডিভাইস ও "অন্য সব ডিভাইস থেকে লগ-আউট" (`DevicesSheet`), "আমার ডেটা ডাউনলোড" (`lib/exportData.js`)।

## পরিবার (নিজস্ব পরিচয়) — নতুন
- রুট: `/family` (ট্যাব: ট্রি • অনুষ্ঠান • অ্যালবাম • আমন্ত্রণ), `/albums/:id`, `/join/:code` (লগ-ইন ছাড়াও খোলে)। হেডারে ও সাইডবারে "পরিবার" বাটন, হোম ফিডের ওপরে `FamilyCard`।
- আমন্ত্রণ: `components/family/InvitePanel.jsx`, `pages/Join.jsx`, SQL ফাংশন `create_invite / peek_invite / accept_invite`। লিংক ৩০ দিন, সর্বোচ্চ ২৫ জন।
- সম্পর্কের ট্যাগ ও ট্রি: `lib/family.js`, `lib/useRelations.js`, `RelationPicker`, `FamilyTree` (প্রোফাইলে "আপনার মামা" চিপ, বন্ধুর মেনুতে "সম্পর্ক ঠিক করুন")।
- জন্মদিন ও অনুষ্ঠান: `components/family/Events.jsx` (জন্মদিন, ঈদ/বিয়ে/মিলাদ ইত্যাদি, RSVP), SQL `run_family_reminders()` (pg_cron)।
- অ্যালবাম: `components/family/Albums.jsx`, `pages/AlbumView.jsx` (সদস্যরা ছবি যোগ করে, মালিক সদস্য ও অ্যালবাম নিয়ন্ত্রণ করে)।
- নোটিফিকেশন: নতুন ধরন (`invite_joined, birthday, event_new, event_reminder, album_add`) ও সেটিংসে "পরিবার" ক্যাটেগরি।
- `notify_friend()` ট্রিগার এমনভাবে বদলেছে যেন আমন্ত্রণে সরাসরি-accepted বন্ধুত্বে ভুয়া "ফ্রেন্ড রিকুয়েস্ট" নোটিফিকেশন না যায়।

## আগের কোডের একটি বাগ ঠিক করা হয়েছে
`context/Call.jsx` ও `context/GroupCall.jsx`-এ কল শেষ হওয়ার সময় `setShowFx(false)` ডাকা হতো, অথচ এই state কোথাও ছিল না (ReferenceError)। লাইনটি সরানো হয়েছে।

## নতুন ফাইল (29)
- `src/components/AppearanceSheet.jsx`
- `src/components/DevicesSheet.jsx`
- `src/components/ErrorBoundary.jsx`
- `src/components/NotifSettingsSheet.jsx`
- `src/components/OfflineBanner.jsx`
- `src/components/PageLoader.jsx`
- `src/components/ReportSheet.jsx`
- `src/components/SmartImg.jsx`
- `src/components/UIHost.jsx`
- `src/components/chat/ChatSearchBar.jsx`
- `src/components/chat/ChatToolsSheet.jsx`
- `src/components/chat/MessageMenu.jsx`
- `src/components/chat/PinnedBanner.jsx`
- `src/components/chat/VoicePlayer.jsx`
- `src/components/family`
- `src/lib/devices.js`
- `src/lib/exportData.js`
- `src/lib/family.js`
- `src/lib/notifPrefs.js`
- `src/lib/prefs.js`
- `src/lib/ui.js`
- `src/lib/useLongPress.js`
- `src/lib/useOnline.js`
- `src/lib/useRelations.js`
- `src/pages/AlbumView.jsx`
- `src/pages/Family.jsx`
- `src/pages/Join.jsx`
- `supabase/update-22.sql`
- `supabase/update-23.sql`

## বদলানো ফাইল (40)
- `index.html`
- `package.json`
- `public/sw.js`
- `src/App.jsx`
- `src/components/Avatar.jsx`
- `src/components/CommentsSheet.jsx`
- `src/components/Layout.jsx`
- `src/components/PersonActions.jsx`
- `src/components/PostCard.jsx`
- `src/components/UploadSheet.jsx`
- `src/components/call/CallParts.jsx`
- `src/components/chat/Bubble.jsx`
- `src/components/groups/GroupChat.jsx`
- `src/components/home/StoryComposer.jsx`
- `src/components/home/StoryViewer.jsx`
- `src/components/post/CommentItem.jsx`
- `src/components/post/EditPostSheet.jsx`
- `src/components/post/NoteCard.jsx`
- `src/components/post/PostMenu.jsx`
- `src/context/Call.jsx`
- `src/context/ChatPrefs.jsx`
- `src/context/GroupCall.jsx`
- `src/context/Inbox.jsx`
- `src/context/Notifications.jsx`
- `src/index.css`
- `src/lib/media.js`
- `src/lib/uploadImage.js`
- `src/lib/useLocalMedia.js`
- `src/lib/useRelation.js`
- `src/main.jsx`
- `src/pages/Auth.jsx`
- `src/pages/Chat.jsx`
- `src/pages/Deactivated.jsx`
- `src/pages/Feed.jsx`
- `src/pages/Group.jsx`
- `src/pages/Messages.jsx`
- `src/pages/Notifications.jsx`
- `src/pages/PageView.jsx`
- `src/pages/Profile.jsx`
- `supabase/functions/send-push/index.ts`
