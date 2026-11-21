# পোলিশ আপডেট — পরিবর্তনের তালিকা

আপনার `textme-main_301061.zip`-এর ওপর ধাপ ১–৪ বসানো হয়েছে। নতুন কোনো ফিচার যোগ হয়নি।
অন্য ফাইলে আপনার নিজের কাজ চলতে থাকলে শুধু নিচের ফাইলগুলো মিলিয়ে নিলেই চলবে।

## নতুন ফাইল (9)
- `src/components/AppearanceSheet.jsx`
- `src/components/ErrorBoundary.jsx`
- `src/components/OfflineBanner.jsx`
- `src/components/PageLoader.jsx`
- `src/components/SmartImg.jsx`
- `src/components/UIHost.jsx`
- `src/lib/prefs.js`
- `src/lib/ui.js`
- `src/lib/useOnline.js`

## বদলানো ফাইল (32)
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
- `src/context/Call.jsx`
- `src/context/ChatPrefs.jsx`
- `src/context/GroupCall.jsx`
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
- `src/pages/PageView.jsx`
- `src/pages/Profile.jsx`

## ধাপ অনুযায়ী
1. টোস্ট/কনফার্ম: `lib/ui.js`, `components/UIHost.jsx`। ৪৫টির বেশি `alert/confirm` বদলেছে।
2. ব্যর্থতা সামলানো: `ErrorBoundary`, `OfflineBanner`, চ্যাট/গ্রুপ চ্যাটে "পাঠানো হচ্ছে / ব্যর্থ, আবার পাঠান", `sw.js` (v11)।
3. গতি: `React.lazy` পেজ, `compressImage` (media.js), `SmartImg` (ঝিলিমিলি + ফেড-ইন)।
4. থিম ও লেখার সাইজ: `lib/prefs.js`, `AppearanceSheet`, `index.css` (ডার্ক ভ্যারিয়েবল), `index.html` (ঝলকানি এড়ানো স্ক্রিপ্ট)।

## আগের কোডের একটি বাগ ঠিক করা হয়েছে
`context/Call.jsx` ও `context/GroupCall.jsx`-এ কল শেষ হওয়ার সময় `setShowFx(false)` ডাকা হতো, অথচ এই state কোথাও ছিল না (ReferenceError)। লাইনটি সরানো হয়েছে।

## ডিপ্লয়ের পরে
পুরনো Service Worker আটকে থাকলে ব্রাউজারে Site settings থেকে Clear data করে আবার খুলুন।
