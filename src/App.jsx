import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { configured } from './lib/supabase'
import { AuthProvider, useAuth } from './context/Auth'
import Layout from './components/Layout'
import Setup from './pages/Setup'
import Auth from './pages/Auth'
import Feed from './pages/Feed'
import Reels from './pages/Reels'
import Share from './pages/Share'
import Videos from './pages/Videos'
import Friends from './pages/Friends'
import Messages from './pages/Messages'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import Post from './pages/Post'

// ছোট "ডিং" সাউন্ড, কোনো ফাইল লাগে না
function playDing(ctx) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12)
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.5)
}

// অ্যাপ খোলা অবস্থায় Service Worker থেকে মেসেজ এলে সাউন্ড বাজায়
function NotificationSound() {
  useEffect(() => {
    let ctx

    // ব্রাউজার প্রথম টাচ/ক্লিকের আগে অডিও চালাতে দেয় না, তাই আনলক করে নিচ্ছি
    const unlock = () => {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
      if (ctx.state === 'suspended') ctx.resume()
      window.removeEventListener('pointerdown', unlock)
    }
    window.addEventListener('pointerdown', unlock)

    const onMsg = (e) => {
      if (e.data?.type === 'PLAY_SOUND' && ctx) playDing(ctx)
    }
    navigator.serviceWorker?.addEventListener('message', onMsg)

    return () => {
      window.removeEventListener('pointerdown', unlock)
      navigator.serviceWorker?.removeEventListener('message', onMsg)
    }
  }, [])

  return null
}

function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid h-screen place-items-center text-brand font-bold text-2xl">আপন…</div>
  return user ? children : <Navigate to="/auth" replace />
}

export default function App() {
  if (!configured) return <Setup />
  return (
    <AuthProvider>
      <NotificationSound />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route element={<Guard><Layout /></Guard>}>
          <Route index element={<Feed />} />
          <Route path="reels" element={<Reels />} />
          <Route path="share" element={<Share />} />
          <Route path="videos" element={<Videos />} />
          <Route path="friends" element={<Friends />} />
          <Route path="messages" element={<Messages />} />
          <Route path="chat/:id" element={<Chat />} />
          <Route path="profile/:id?" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="post/:id" element={<Post />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
