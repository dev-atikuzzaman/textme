import { useState } from 'react'
import { X, BookUser } from 'lucide-react'

export default function ContactSheet({ onClose, onSend }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const canPick = 'contacts' in navigator && 'ContactsManager' in window

  const pick = async () => {
    try {
      const [c] = await navigator.contacts.select(['name', 'tel'], { multiple: false })
      if (c) { setName(c.name?.[0] || ''); setPhone(c.tel?.[0] || '') }
    } catch { /* বাতিল করেছে */ }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-t-[32px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">কন্টাক্ট শেয়ার</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-mist"><X size={18} /></button>
        </div>
        {canPick && <button onClick={pick} className="btn-soft w-full !bg-mist"><BookUser size={18} />ফোনবুক থেকে বাছুন</button>}
        <input className="input" placeholder="নাম" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" type="tel" inputMode="tel" placeholder="ফোন নম্বর" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button disabled={!name.trim() || !phone.trim()} onClick={() => onSend({ name: name.trim(), phone: phone.trim() })} className="btn-primary w-full">পাঠান</button>
        {!canPick && <p className="text-center text-xs text-ink/50">সরাসরি ফোনবুক বাছাই শুধু Android Chrome-এ চলে। অন্য ডিভাইসে নাম ও নম্বর লিখে দিন।</p>}
      </div>
    </div>
  )
}
