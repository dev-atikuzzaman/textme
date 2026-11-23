import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { APP_NAME } from '../lib/brand'
import { PENDING_INVITE } from '../lib/family'
import { toast, errMsg } from '../lib/ui'
import Avatar from '../components/Avatar'
import BrandMark from '../components/BrandMark'

// আমন্ত্রণ লিংক (/join/কোড): লগ-ইন ছাড়াও খোলে। লগ-ইন করে "যোগ দিন" চাপলে সরাসরি বন্ধু হয়ে যায়।
export default function Join() {
  const { code } = useParams()
  const { user, loading } = useAuth()
  const nav = useNavigate()
  const [info, setInfo] = useState(undefined) // undefined = লোড হচ্ছে, null = অবৈধ/মেয়াদ শেষ
  const [busy, setBusy] = useState(false)
  const clear = () => { try { localStorage.removeItem(PENDING_INVITE) } catch { /* ignore */ } }

  useEffect(() => {
    supabase.rpc('peek_invite', { p_code: code }).then(({ data, error }) => {
      const row = !error && data?.[0]
      if (!row || !row.valid) clear()
      setInfo(row && row.valid ? row : null)
    })
  }, [code])

  const login = () => { try { localStorage.setItem(PENDING_INVITE, code) } catch { /* ignore */ } nav('/auth') }
  const accept = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('accept_invite', { p_code: code })
    setBusy(false)
    if (error) {
      const m = error.message || ''
      clear()
      if (/invite_self/.test(m)) { toast('এটি আপনার নিজেরই আমন্ত্রণ লিংক'); return nav('/family?tab=invite', { replace: true }) }
      return toast.error(/invite_invalid/.test(m) ? 'আমন্ত্রণের মেয়াদ শেষ বা লিংক বাতিল হয়েছে' : /not allowed/.test(m) ? 'এই আমন্ত্রণ গ্রহণ করা যাচ্ছে না' : errMsg(error))
    }
    clear(); toast.success(`${info.full_name}-এর সাথে এখন আপনারা বন্ধু 🎉`)
    nav(`/profile/${data}`, { replace: true })
  }
  const decline = () => { clear(); nav('/', { replace: true }) }

  return (
    <div className="grid min-h-[100dvh] place-items-center px-5 py-10">
      <div className="w-full max-w-sm space-y-5 rounded-[32px] bg-surface p-7 text-center shadow-soft">
        <div className="flex items-center justify-center gap-2.5 text-2xl font-extrabold text-brand"><BrandMark size={36} />{APP_NAME}</div>
        {info === undefined && <p className="py-8 text-fg/55">আমন্ত্রণ দেখা হচ্ছে…</p>}
        {info === null && (
          <div className="space-y-3 py-4"><p className="text-4xl">😕</p><p className="font-bold">লিংকটি কাজ করছে না</p><p className="text-sm text-fg/60">মেয়াদ শেষ হয়েছে বা বাতিল করা হয়েছে। যিনি পাঠিয়েছেন তাঁর কাছ থেকে নতুন লিংক চেয়ে নিন।</p><Link to="/" className="btn-primary inline-flex">হোমে যান</Link></div>
        )}
        {info && (
          <>
            <div className="flex justify-center"><Avatar p={info} size={88} /></div>
            <div>
              <p className="text-xl font-extrabold">{info.full_name}</p>
              <p className="mt-1 text-fg/65">আপনাকে {APP_NAME}-এ পরিবারের সাথে যোগ দিতে আমন্ত্রণ জানিয়েছেন 🏡</p>
            </div>
            {loading ? null : user ? (
              <div className="space-y-2">
                <button onClick={accept} disabled={busy} className="btn-primary w-full">{busy ? 'যোগ হচ্ছে…' : 'বন্ধু হয়ে যোগ দিন'}</button>
                <button onClick={decline} className="w-full text-sm font-semibold text-fg/55">এখন না</button>
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={login} className="btn-primary w-full">লগইন করুন / একাউন্ট খুলুন</button>
                <p className="text-xs text-fg/55">লগইনের পর আপনাকে আবার এখানে নিয়ে আসা হবে।</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
