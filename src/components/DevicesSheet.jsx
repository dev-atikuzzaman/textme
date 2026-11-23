import { useEffect, useState } from 'react'
import { X, Smartphone, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { deviceId } from '../lib/devices'
import { fmt } from '../lib/constants'
import { toast, confirmDialog, errMsg } from '../lib/ui'

// প্রোফাইল → একাউন্ট সেটিংস → লগইন করা ডিভাইস
export default function DevicesSheet({ onClose }) {
  const [list, setList] = useState(null)
  const me = deviceId()

  useEffect(() => {
    supabase.from('login_devices').select('*').order('last_seen', { ascending: false })
      .then(({ data, error }) => setList(error ? [] : data || []))
  }, [])

  const others = async () => {
    if (!(await confirmDialog('এই ডিভাইস বাদে আপনার বাকি সব ডিভাইস থেকে লগ-আউট হয়ে যাবে। চালিয়ে যাবেন?', { title: 'অন্য ডিভাইস থেকে লগ-আউট', danger: true, confirmText: 'লগ-আউট করুন' }))) return
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    if (error) return toast.error(errMsg(error))
    await supabase.from('login_devices').delete().neq('device_id', me)
    setList((l) => (l || []).filter((d) => d.device_id === me))
    toast.success('অন্য সব ডিভাইস থেকে লগ-আউট করা হয়েছে')
  }
  const all = async () => {
    if (!(await confirmDialog('সব ডিভাইস থেকে (এটিসহ) লগ-আউট হবে। আবার লগ-ইন করতে হবে।', { title: 'সব ডিভাইস থেকে লগ-আউট', danger: true, confirmText: 'সব লগ-আউট' }))) return
    await supabase.from('login_devices').delete().neq('device_id', '')
    await supabase.auth.signOut({ scope: 'global' })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="লগইন করা ডিভাইস"
        className="max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">লগইন করা ডিভাইস</h2>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        {list === null && <p className="py-6 text-center text-fg/55">লোড হচ্ছে…</p>}
        {list?.length === 0 && <p className="rounded-2xl bg-surface2 p-4 text-sm text-fg/65">তালিকা এখনও খালি। (update-22.sql চালানো না থাকলে এটি কাজ করবে না; চালানোর পর অ্যাপ আবার খুললে ডিভাইস যোগ হবে।)</p>}
        {list?.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-2xl bg-surface2 p-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface text-brand"><Smartphone size={20} /></span>
            <div className="min-w-0 flex-1">
              <b className="block truncate">{d.label || 'ডিভাইস'}</b>
              <span className="text-xs text-fg/55">{d.device_id === me ? <span className="font-bold text-success">এই ডিভাইস • এখন</span> : `শেষ ব্যবহার: ${fmt(d.last_seen)}`}</span>
            </div>
          </div>
        ))}
        <button onClick={others} className="btn-soft w-full"><LogOut size={18} />অন্য সব ডিভাইস থেকে লগ-আউট</button>
        <button onClick={all} className="btn-soft w-full !text-danger">সব ডিভাইস থেকে লগ-আউট (এটিসহ)</button>
        <p className="px-1 text-xs text-fg/55">অপরিচিত ডিভাইস দেখলে "অন্য সব ডিভাইস থেকে লগ-আউট" চাপুন, তারপর পাসওয়ার্ড বদলে নিন।</p>
      </div>
    </div>
  )
}
