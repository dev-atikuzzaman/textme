import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { configured } from './lib/supabase'
import { playDing } from './lib/sound'
import { AuthProvider, useAuth } from './context/Auth'
import Layout from './components/Layout'
import Setup from './pages/Setup'
import Auth from './pages/Auth'
import Feed from './pages/Feed'
import Reels from './pages/Reels'
import Videos from './pages/Videos'
import Friends from './pages/Friends'
import Messages from './pages/Messages'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import Post from './pages/Post'
import SearchPage from './pages/Search'
import Groups from './pages/Groups'
import Group from './pages/Group'
import PageView from './pages/PageView'
import LockGate from './components/chat/LockGate'
import ResetPassword from './pages/ResetPassword'
import Deactivated from './pages/Deactivated'

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
  if (loading) return <div className="grid h-screen place-items-center text-brand font-bold text-2xl">আপন…</div>
  if (!user) return <Navigate to="/auth" replace />
  if (profile?.deactivated_at) return <Deactivated />
  return children
}

export default function App() {
  if (!configured) return <Setup />
  return (
    <AuthProvider>
      <NotificationSound />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route element={<Guard><Layout /></Guard>}>
          <Route index element={<Feed />} />
          <Route path="reels" element={<Reels />} />
          <Route path="videos" element={<Videos />} />
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
    </AuthProvider>
  )
}
