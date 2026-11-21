import { useState } from 'react'
import { PowerOff } from '../lib/icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { toast, errMsg } from '../lib/ui'

// ডিঅ্যাক্টিভ একাউন্টে লগ-ইন করলে এই স্ক্রিন আসে
export default function Deactivated() {
  const { refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const back = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('reactivate_my_account')
    if (error) { setBusy(false); return toast.error(errMsg(error)) }
    await refreshProfile(); setBusy(false)
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 text-center">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-surface2 text-fg/60"><PowerOff size={34} /></span>
      <h1 className="text-2xl font-extrabold">আপনার একাউন্ট ডিঅ্যাক্টিভ আছে</h1>
      <p className="text-fg/65">এখন কেউ আপনাকে খুঁজে পাচ্ছে না, আর আপনার পোস্ট লুকানো আছে। আবার চালু করলে সবকিছু আগের মতো ফিরে আসবে।</p>
      <button disabled={busy} onClick={back} className="btn-primary w-full">{busy ? 'অপেক্ষা করুন…' : 'একাউন্ট আবার চালু করুন'}</button>
      <button onClick={() => supabase.auth.signOut()} className="btn-soft w-full">লগ-আউট</button>
    </div>
  )
}
