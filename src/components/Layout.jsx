import { Suspense } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import PageLoader from './PageLoader'
import { Home, Clapperboard, Users, MessageCircle, User, PlaySquare, Youtube, Bell, Search, UsersRound } from '../lib/icons'
import { NotifProvider, useNotifs } from '../context/Notifications'
import { APP_NAME } from '../lib/brand'
import BrandMark from './BrandMark'
import { CallProvider } from '../context/Call'
import { GroupCallProvider } from '../context/GroupCall'
import { SavedProvider } from '../context/Saved'
import { SavedVideosProvider } from '../context/SavedVideos'
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
  { to: '/youtube', Icon: Youtube, label: 'ইউটিউব' },
  { to: '/search', Icon: Search, label: 'সার্চ' },
]

const Badge = ({ n, className = '' }) => n > 0 && (
  <span className={`absolute grid min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold leading-5 text-white ${className}`}>{n > 9 ? '৯+' : n.toLocaleString('bn-BD')}</span>
)

function Shell() {
  const { pathname } = useLocation()
  const { unread } = useNotifs()
  const { unread: unreadMsgs } = useInbox()
  const inGroup = /^\/groups\/[^/]+/.test(pathname)          // গ্রুপ খুললে ওপর-নিচের বার থাকে না
  const inPage = /^\/pages\/[^/]+/.test(pathname)
  const inChat = pathname.startsWith('/chat') || inGroup
  const showHeader = !pathname.startsWith('/reels') && !inChat && !inPage
  const showNav = !inChat && !inPage
  const homeTap = (to) => () => { if (to === '/' && pathname === '/') { window.scrollTo({ top: 0, behavior: 'smooth' }); window.dispatchEvent(new Event('apon-home')) } }
  const count = (t) => (t.badge ? unreadMsgs : 0)

  return (
    <div className="min-h-[100dvh] w-full lg:pl-64">
      {/* বড় স্ক্রিনে (ল্যাপটপ/ডেস্কটপ) বাঁ দিকের সাইডবার */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col gap-1 border-r border-fg/10 bg-surface/90 p-4 backdrop-blur-xl lg:flex">
        <h1 className="mb-4 flex items-center gap-2.5 px-3 text-2xl font-extrabold text-brand"><BrandMark size={36} />{APP_NAME}</h1>
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
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-brand/10 bg-surface px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[0_2px_14px_rgba(15,118,96,0.07)]">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-brand lg:invisible"><BrandMark size={32} />{APP_NAME}</h1>
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
        <main className={inChat ? '' : inPage ? 'px-4 pb-10 pt-3' : 'px-4 pb-24 lg:pb-10'}>
          {pathname === '/' && <><PushBanner /><InstallBanner /></>}
          <ErrorBoundary resetKey={pathname}><Suspense fallback={<PageLoader />}><Outlet /></Suspense></ErrorBoundary>
        </main>
      </div>

      {showNav && (
        <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md items-center justify-around rounded-t-[26px] border-t border-fg/10 bg-surface/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:max-w-xl lg:hidden">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} aria-label={t.label} onClick={homeTap(t.to)}
              className={({ isActive }) => `relative grid h-12 w-14 place-items-center rounded-2xl transition ${isActive ? 'bg-gradient-to-br from-brand to-coral text-inverse' : 'text-fg/50'}`}>
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
    <NotifProvider><CallProvider><GroupCallProvider><PresenceProvider><InboxProvider><SavedProvider><SavedVideosProvider><ChatPrefsProvider><Shell /></ChatPrefsProvider></SavedVideosProvider></SavedProvider></InboxProvider></PresenceProvider></GroupCallProvider></CallProvider></NotifProvider>
  )
}
