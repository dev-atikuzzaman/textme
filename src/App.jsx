import { Routes, Route, Navigate } from 'react-router-dom'
import { configured } from './lib/supabase'
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

function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid h-screen place-items-center text-brand font-bold text-2xl">আপন…</div>
  return user ? children : <Navigate to="/auth" replace />
}

export default function App() {
  if (!configured) return <Setup />
  return (
    <AuthProvider>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route element={<Guard><Layout /></Guard>}>
          <Route index element={<Feed />} />
          <Route path="reels" element={<Reels />} />
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
