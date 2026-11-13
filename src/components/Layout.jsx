import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Clapperboard, Users, MessageCircle, User, PlaySquare, Bell } from 'lucide-react'
import { NotifProvider, useNotifs } from '../context/Notifications'
import { CallProvider } from '../context/Call'
import InstallBanner from './InstallBanner'

const tabs = [
  { to: '/', Icon: Home, end: true },
  { to: '/reels', Icon: Clapperboard },
  { to: '/friends', Icon: Users },
  { to: '/messages', Icon: MessageCircle },
  { to: '/profile', Icon: User },
]

function Shell() {
  const { pathname } = useLocation()
  const { unread } = useNotifs()
  const inChat = pathname.startsWith('/chat')
  const showHeader = !pathname.startsWith('/reels') && !inChat
  return (
    <div className="mx-auto min-h-screen max-w-md">
      {showHeader && (
        <header className="sticky top-0 z-30 flex items-center justify-between bg-mist/80 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
          <h1 className="bg-gradient-to-r from-brand to-coral bg-clip-text text-3xl font-extrabold text-transparent">আপন</h1>
          <div className="flex gap-2">
            <Link to="/notifications" className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-soft">
              <Bell size={22} />
              {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold leading-5 text-white">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <Link to="/videos" className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-soft"><PlaySquare size={22} /></Link>
          </div>
        </header>
      )}
      <main className={inChat ? '' : 'px-4 pb-28'}>
        {pathname === '/' && <InstallBanner />}
        <Outlet />
      </main>
      {!inChat && (
        <nav className="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-[22rem] justify-between rounded-[28px] bg-ink/90 p-2 shadow-2xl backdrop-blur-xl mb-[env(safe-area-inset-bottom)]">
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

export default function Layout() {
  return <NotifProvider><CallProvider><Shell /></CallProvider></NotifProvider>
}
