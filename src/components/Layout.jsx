import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Clapperboard, Users, MessageCircle, User, PlaySquare } from 'lucide-react'

const tabs = [
  { to: '/', Icon: Home, end: true },
  { to: '/reels', Icon: Clapperboard },
  { to: '/friends', Icon: Users },
  { to: '/messages', Icon: MessageCircle },
  { to: '/profile', Icon: User },
]

export default function Layout() {
  const { pathname } = useLocation()
  const inChat = pathname.startsWith('/chat')
  const showHeader = !pathname.startsWith('/reels') && !inChat
  return (
    <div className="mx-auto min-h-screen max-w-md">
      {showHeader && (
        <header className="sticky top-0 z-30 flex items-center justify-between bg-mist/80 px-5 py-4 backdrop-blur-xl">
          <h1 className="bg-gradient-to-r from-brand to-coral bg-clip-text text-3xl font-extrabold text-transparent">আপন</h1>
          <Link to="/videos" className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-soft"><PlaySquare size={22} /></Link>
        </header>
      )}
      <main className={inChat ? '' : 'px-4 pb-28'}><Outlet /></main>
      {!inChat && (
        <nav className="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-[22rem] justify-between rounded-[28px] bg-ink/90 p-2 shadow-2xl backdrop-blur-xl">
          {tabs.map(({ to, Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `grid h-12 w-14 place-items-center rounded-2xl transition ${isActive ? 'bg-gradient-to-br from-brand to-coral text-white' : 'text-white/60'}`}>
              <Icon size={22} />
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
