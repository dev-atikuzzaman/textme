import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Clapperboard, Users, MessageCircle, User, PlaySquare, Bell, Search, UsersRound } from 'lucide-react'
import { NotifProvider, useNotifs } from '../context/Notifications'
import { CallProvider } from '../context/Call'
import { SavedProvider } from '../context/Saved'
import { PresenceProvider } from '../context/Presence'
import { InboxProvider, useInbox } from '../context/Inbox'
import { ChatPrefsProvider } from '../context/ChatPrefs'
import InstallBanner from './InstallBanner'
import PushBanner from './PushBanner'

const tabs = [
  { to: '/', Icon: Home, end: true, label: 'হোম' },
  { to: '/reels', Icon: Clapperboard, label: 'রিলস' },
  { to: '/friends', Icon: Users, label: 'বন্ধু' },
  { to: '/messages', Icon: MessageCircle, label: 'মেসেজ', badge: true },
  { to: '/profile', Icon: User, label: 'প্রোফাইল' },
]
const extra = [
  { to: '/groups', Icon: UsersRound, label: 'গ্রুপ ও পেজ' },
  { to: '/videos', Icon: PlaySquare, label: 'ভিডিও' },
  { to: '/search', Icon: Search, label: 'সার্চ' },
]

const Badge = ({ n, className = '' }) => n > 0 && (
  <span className={`absolute grid min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold leading-5 text-white ${className}`}>{n > 9 ? '৯+' : n.toLocaleString('bn-BD')}</span>
)

function Shell() {
  const { pathname } = useLocation()
  const { unread } = useNotifs()
  const { unread: unreadMsgs } = useInbox()
  const inChat = pathname.startsWith('/chat')
  const showHeader = !pathname.startsWith('/reels') && !inChat
  const homeTap = (to) => () => { if (to === '/' && pathname === '/') { window.scrollTo({ top: 0, behavior: 'smooth' }); window.dispatchEvent(new Event('apon-home')) } }
  const count = (t) => (t.badge ? unreadMsgs : 0)

  return (
    <div className="min-h-[100dvh] w-full lg:pl-64">
      {/* বড় স্ক্রিনে (ল্যাপটপ/ডেস্কটপ) বাঁ দিকের সাইডবার */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col gap-1 border-r border-fg/10 bg-ink/80 p-4 backdrop-blur-xl lg:flex">
        <h1 className="mb-4 bg-gradient-to-r from-brand to-coral bg-clip-text px-3 text-3xl font-extrabold text-transparent">আপন</h1>
        {[...tabs, ...extra].map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} onClick={homeTap(t.to)}
            className={({ isActive }) => `relative flex items-center gap-4 rounded-2xl px-4 py-3 text-lg font-bold transition ${isActive ? 'bg-gradient-to-r from-brand to-coral text-inverse' : 'text-fg/75 hover:bg-surface'}`}>
            <t.Icon size={24} />{t.label}
            <Badge n={count(t)} className="right-4 top-1/2 -translate-y-1/2" />
          </NavLink>
        ))}
        <NavLink to="/notifications" className={({ isActive }) => `relative flex items-center gap-4 rounded-2xl px-4 py-3 text-lg font-bold transition ${isActive ? 'bg-gradient-to-r from-brand to-coral text-inverse' : 'text-fg/75 hover:bg-surface'}`}>
          <Bell size={24} />নোটিফিকেশন<Badge n={unread} className="right-4 top-1/2 -translate-y-1/2" />
        </NavLink>
      </aside>

      <div className="mx-auto w-full max-w-md sm:max-w-xl lg:max-w-2xl">
        {showHeader && (
          <header className="sticky top-0 z-30 flex items-center justify-between bg-ink/70 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
            <h1 className="bg-gradient-to-r from-brand to-coral bg-clip-text text-3xl font-extrabold text-transparent lg:invisible">আপন</h1>
            <div className="flex gap-2">
              <Link to="/search" aria-label="সার্চ" className="grid h-11 w-11 place-items-center rounded-2xl bg-surface shadow-soft"><Search size={22} /></Link>
              <Link to="/notifications" aria-label="নোটিফিকেশন" className="relative grid h-11 w-11 place-items-center rounded-2xl bg-surface shadow-soft">
                <Bell size={22} />
                <Badge n={unread} className="-right-1 -top-1" />
              </Link>
              <Link to="/videos" aria-label="ভিডিও" className="grid h-11 w-11 place-items-center rounded-2xl bg-surface shadow-soft lg:hidden"><PlaySquare size={22} /></Link>
            </div>
          </header>
        )}
        <main className={inChat ? '' : 'px-4 pb-28 lg:pb-10'}>
          {pathname === '/' && <><PushBanner /><InstallBanner /></>}
          <Outlet />
        </main>
      </div>

      {!inChat && (
        <nav className="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-[22rem] justify-between rounded-[28px] bg-ink/90 p-2 shadow-2xl backdrop-blur-xl mb-[env(safe-area-inset-bottom)] sm:max-w-sm lg:hidden">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} aria-label={t.label} onClick={homeTap(t.to)}
              className={({ isActive }) => `relative grid h-12 w-14 place-items-center rounded-2xl transition ${isActive ? 'bg-gradient-to-br from-brand to-coral text-inverse' : 'text-white/60'}`}>
              <t.Icon size={22} />
              <Badge n={count(t)} className="-right-0.5 -top-0.5" />
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

export default function Layout() {
  return (
    <NotifProvider><CallProvider><PresenceProvider><InboxProvider><SavedProvider><ChatPrefsProvider><Shell /></ChatPrefsProvider></SavedProvider></InboxProvider></PresenceProvider></CallProvider></NotifProvider>
  )
}
