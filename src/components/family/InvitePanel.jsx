import { useEffect, useState } from 'react'
import { Link2, Share2, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { APP_NAME } from '../../lib/brand'
import { inviteUrl, tableMissing } from '../../lib/family'
import { toast, confirmDialog, errMsg } from '../../lib/ui'

// আমন্ত্রণ লিংক ও QR: যিনি লিংক/QR দিয়ে ঢুকবেন তিনি সরাসরি আপনার বন্ধু হয়ে যাবেন
export default function InvitePanel() {
  const [code, setCode] = useState(null)
  const [qr, setQr] = useState('')
  const [err, setErr] = useState('')
  const url = code ? inviteUrl(code) : ''
  const text = `${APP_NAME}-এ আমার পরিবারের সাথে যোগ দিন 🏡\n${url}`

  const load = async (fresh = false) => {
    setErr('')
    const { data, error } = await supabase.rpc('create_invite', { p_new: fresh })
    if (error) return setErr(tableMissing(error) ? 'আমন্ত্রণ চালু করতে Supabase-এ update-23.sql একবার চালাতে হবে।' : errMsg(error))
    setCode(data)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!url) return
    let off = false
    import('qrcode')
      .then((m) => (m.default || m).toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: 'M' }))
      .then((d) => { if (!off) setQr(d) })
      .catch(() => {}) // QR না হলেও লিংক দিয়ে চলবে
    return () => { off = true }
  }, [url])

  const copy = async () => { try { await navigator.clipboard.writeText(url); toast.success('লিংক কপি হয়েছে') } catch { toast.error('কপি করা যায়নি') } }
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: APP_NAME, text, url }); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener') }
    catch { /* বাতিল */ }
  }
  const renew = async () => {
    if (!(await confirmDialog('পুরনো লিংক আর কাজ করবে না। নতুন লিংক বানাবেন?', { title: 'নতুন লিংক', confirmText: 'নতুন বানান' }))) return
    await load(true); toast.success('নতুন লিংক তৈরি হয়েছে')
  }

  if (err) return <p className="rounded-3xl bg-danger/10 p-4 text-sm text-danger">{err}</p>
  return (
    <div className="space-y-4 rounded-3xl bg-surface p-5 shadow-soft">
      <div className="text-center">
        <h3 className="text-lg font-extrabold">আপনজনদের আমন্ত্রণ জানান</h3>
        <p className="mt-1 text-sm text-fg/60">লিংক বা QR পাঠান। যিনি ঢুকবেন তিনি এক ট্যাপে আপনার বন্ধু হয়ে যাবেন।</p>
      </div>
      <div className="mx-auto grid h-56 w-56 place-items-center rounded-3xl bg-white p-3 ring-1 ring-fg/10">
        {qr ? <img src={qr} alt="আমন্ত্রণের QR কোড" className="h-full w-full" /> : <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand/20 border-t-brand" aria-label="লোড হচ্ছে" />}
      </div>
      <p className="break-all rounded-2xl bg-surface2 px-3 py-2.5 text-center text-sm text-fg/75" dir="ltr">{url || '…'}</p>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={copy} disabled={!url} className="btn-soft"><Link2 size={18} />লিংক কপি</button>
        <button onClick={share} disabled={!url} className="btn-primary"><Share2 size={18} />শেয়ার করুন</button>
      </div>
      {qr && <a href={qr} download="apon-invite-qr.png" className="btn-soft w-full">QR ছবি সেভ করুন</a>}
      <p className="text-xs text-fg/55">লিংকটি ৩০ দিন চলবে এবং সর্বোচ্চ ২৫ জন ব্যবহার করতে পারবেন। শুধু বিশ্বস্ত আপনজনদের পাঠান। লিংক ভুল হাতে গেলে নতুন বানিয়ে নিন।</p>
      <button onClick={renew} className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-fg/60"><RefreshCw size={15} />নতুন লিংক বানান</button>
    </div>
  )
}
