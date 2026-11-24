import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Network, CalendarDays, Images, QrCode } from 'lucide-react'
import FamilyTree from '../components/family/FamilyTree'
import Events from '../components/family/Events'
import Albums from '../components/family/Albums'
import InvitePanel from '../components/family/InvitePanel'

const TABS = [
  { id: 'tree', label: 'ট্রি', Icon: Network },
  { id: 'events', label: 'অনুষ্ঠান', Icon: CalendarDays },
  { id: 'albums', label: 'অ্যালবাম', Icon: Images },
  { id: 'invite', label: 'আমন্ত্রণ', Icon: QrCode },
]

// পরিবার: ফ্যামিলি ট্রি • জন্মদিন ও অনুষ্ঠান • শেয়ার্ড অ্যালবাম • আমন্ত্রণ লিংক/QR
export default function Family() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'tree'
  useEffect(() => { try { localStorage.setItem('apon-family-seen', '1') } catch { /* ignore */ } }, [])

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-2xl font-extrabold">পরিবার</h2>
      <div role="tablist" className="grid grid-cols-4 gap-2 rounded-3xl bg-surface p-1.5 shadow-soft">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setParams({ tab: id }, { replace: true })}
            className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-bold transition ${tab === id ? 'bg-gradient-to-br from-brand to-coral text-inverse' : 'text-fg/65'}`}>
            <Icon size={20} />{label}
          </button>
        ))}
      </div>
      {tab === 'tree' && <FamilyTree onInvite={() => setParams({ tab: 'invite' }, { replace: true })} />}
      {tab === 'events' && <Events />}
      {tab === 'albums' && <Albums />}
      {tab === 'invite' && <InvitePanel />}
    </div>
  )
}
