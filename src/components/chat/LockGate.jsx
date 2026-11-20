import { useNavigate, useParams } from 'react-router-dom'
import { Lock } from '../../lib/icons'
import { useChatPrefs } from '../../context/ChatPrefs'
import PinPad from './PinPad'

// লক করা চ্যাট (সরাসরি লিংকে গেলেও) PIN ছাড়া খুলবে না
export default function LockGate({ prefix, children }) {
  const { id } = useParams()
  const nav = useNavigate()
  const cp = useChatPrefs()
  const key = `${prefix}:${id}`
  if (!cp.isLocked(key) || cp.isOpen(key)) return children
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div><Lock className="mx-auto text-brand" size={36} /><p className="mt-2 font-bold">এই চ্যাটটি লক করা</p></div>
      <PinPad onClose={() => nav('/messages', { replace: true })} onSubmit={async (p) => { if (await cp.verify(p)) { cp.unlockSession(key); return true } return false }} />
    </div>
  )
}
