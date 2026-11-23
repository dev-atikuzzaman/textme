# পোলিশ আপডেট (ধাপ ১–৭) — পরিবর্তনের তালিকা

আপনার `textme-main_301061.zip`-এর ওপর বসানো। অন্য ফাইলে আপনার নিজের কাজ চললে শুধু নিচের ফাইলগুলো মিলিয়ে নিলেই চলবে।

## ডিপ্লয়ের আগে ৩টি কাজ (ধাপ ৫–৭ চালু করতে)
1. **Supabase → SQL Editor**-এ `supabase/update-22.sql` একবার Run করুন (একাধিকবার চালালেও সমস্যা নেই)।
2. **Edge Function `send-push`** আবার ডিপ্লয় করুন (`supabase/functions/send-push/index.ts`-এর নতুন কোড দিয়ে)। এতে নোটিফিকেশন সেটিংস সার্ভারে কাজ করবে।
3. অ্যাপ ডিপ্লয়ের পর পুরনো Service Worker আটকে থাকলে ব্রাউজারে Site settings থেকে Clear data করে আবার খুলুন।

## ধাপ অনুযায়ী
1. টোস্ট/কনফার্ম: `lib/ui.js`, `components/UIHost.jsx`। ৪৫টির বেশি `alert/confirm` বদলেছে।
2. ব্যর্থতা সামলানো: `ErrorBoundary`, `OfflineBanner`, চ্যাট ও গ্রুপ চ্যাটে "পাঠানো হচ্ছে / ব্যর্থ, আবার পাঠান", `sw.js`।
3. গতি: `React.lazy` পেজ, `compressImage` (media.js), `SmartImg` (ঝিলিমিলি + ফেড-ইন)।
4. থিম ও লেখার সাইজ: `lib/prefs.js`, `AppearanceSheet`, `index.css` (ডার্ক), `index.html`।
5. নোটিফিকেশন: `NotifSettingsSheet` (ক্যাটেগরি অন/অফ, চুপ থাকার সময়), `lib/notifPrefs.js`, অ্যাপ আইকন ব্যাজ (Layout.jsx), `send-push` সার্ভার ফিল্টার।
6. চ্যাট: মেসেজ খোঁজা, ওয়েভফর্মসহ ভয়েস প্লেয়ার (`VoicePlayer`), পিন করা মেসেজ, অদৃশ্য হওয়া মেসেজ (১-১ চ্যাট), মেসেজ চেপে ধরলে মেনু (কপি/পিন)। গ্রুপ চ্যাটে খোঁজা ও পিন।
7. গোপনীয়তা: রিপোর্ট (`ReportSheet`, পোস্ট ও ব্যবহারকারী), লগইন করা ডিভাইস ও "অন্য সব ডিভাইস থেকে লগ-আউট" (`DevicesSheet`), "আমার ডেটা ডাউনলোড" (`lib/exportData.js`)।

## আগের কোডের একটি বাগ ঠিক করা হয়েছে
`context/Call.jsx` ও `context/GroupCall.jsx`-এ কল শেষ হওয়ার সময় `setShowFx(false)` ডাকা হতো, অথচ এই state কোথাও ছিল না (ReferenceError)। লাইনটি সরানো হয়েছে।

## নতুন ফাইল (22)
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
- `src/lib/devices.js`
- `src/lib/exportData.js`
- `src/lib/notifPrefs.js`
- `src/lib/prefs.js`
- `src/lib/ui.js`
- `src/lib/useLongPress.js`
- `src/lib/useOnline.js`
- `supabase/update-22.sql`

## বদলানো ফাইল (37)
- `index.html`
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
- `src/pages/Chat.jsx`
- `src/pages/Deactivated.jsx`
- `src/pages/Group.jsx`
- `src/pages/Messages.jsx`
- `src/pages/Notifications.jsx`
- `src/pages/PageView.jsx`
- `src/pages/Profile.jsx`
- `supabase/functions/send-push/index.ts`
