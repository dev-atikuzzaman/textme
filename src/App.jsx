import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { APP_NAME } from './lib/brand'
import { configured } from './lib/supabase'
import { playDing } from './lib/sound'
import { AuthProvider, useAuth } from './context/Auth'
import Layout from './components/Layout'
import Setup from './pages/Setup'
import Auth from './pages/Auth'
import Feed from './pages/Feed'
import LockGate from './components/chat/LockGate'
import Deactivated from './pages/Deactivated'
import UIHost from './components/UIHost'
import OfflineBanner from './components/OfflineBanner'
import PageLoader from './components/PageLoader'
import { isChunkError, reloadOnceForChunk } from './components/ErrorBoundary'

// পেজগুলো দরকার হলে তবেই লোড হয় (অ্যাপ প্রথমবার খুলতে অনেক দ্রুত)।
// নতুন ভার্সন ডিপ্লয়ের পর পুরনো ট্যাবে ফাইল না মিললে একবার নিজে থেকে রিফ্রেশ করে নেয়।
const lazyPage = (load) => lazy(() => load().catch((e) => {
  if (isChunkError(e) && reloadOnceForChunk()) return new Promise(() => {})
  throw e
}))
const Reels = lazyPage(() => import('./pages/Reels'))
const Videos = lazyPage(() => import('./pages/Videos'))
const YouTube = lazyPage(() => import('./pages/YouTube'))
const Friends = lazyPage(() => import('./pages/Friends'))
const Messages = lazyPage(() => import('./pages/Messages'))
const Chat = lazyPage(() => import('./pages/Chat'))
const Profile = lazyPage(() => import('./pages/Profile'))
const Notifications = lazyPage(() => import('./pages/Notifications'))
const Post = lazyPage(() => import('./pages/Post'))
const SearchPage = lazyPage(() => import('./pages/Search'))
const Groups = lazyPage(() => import('./pages/Groups'))
const Group = lazyPage(() => import('./pages/Group'))
const PageView = lazyPage(() => import('./pages/PageView'))
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'))

// অ্যাপ খোলা বা পেছনে থাকা অবস্থায় Service Worker থেকে মেসেজ এলে সাউন্ড বাজায়
function NotificationSound() {
  useEffect(() => {
    const onMsg = (e) => { if (e.data?.type === 'PLAY_SOUND') playDing() }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [])
  return null
}

function Guard({ children }) {
  const { user, loading, profile } = useAuth()
  if (loading) return <div className="grid h-screen place-items-center text-brand font-bold text-2xl">{APP_NAME}…</div>
  if (!user) return <Navigate to="/auth" replace />
  if (profile?.deactivated_at) return <Deactivated />
  return children
}

export default function App() {
  if (!configured) return <Setup />
  return (
    <AuthProvider>
      <NotificationSound />
      <OfflineBanner />
      <UIHost />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route element={<Guard><Layout /></Guard>}>
          <Route index element={<Feed />} />
          <Route path="reels" element={<Reels />} />
          <Route path="videos" element={<Videos />} />
          <Route path="youtube" element={<YouTube />} />
          <Route path="friends" element={<Friends />} />
          <Route path="messages" element={<Messages />} />
          <Route path="chat/:id" element={<LockGate prefix="u"><Chat /></LockGate>} />
          <Route path="profile/:id?" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="post/:id" element={<Post />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="groups" element={<Groups />} />
          <Route path="groups/:id" element={<LockGate prefix="g"><Group /></LockGate>} />
          <Route path="pages/:id" element={<PageView />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AuthProvider>
  )
}
