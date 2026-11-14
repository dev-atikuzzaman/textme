import { useState } from 'react'
import { Pin, PinOff, Pencil, Link2, Share2, Trash2, X } from 'lucide-react'

function Row({ Icon, title, sub, onClick, danger }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-2xl p-2.5 text-left transition active:bg-mist">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${danger ? 'bg-red-50 text-red-500' : 'bg-mist text-brand'}`}><Icon size={20} /></span>
      <span className="min-w-0"><b className={`block ${danger ? 'text-red-500' : ''}`}>{title}</b>{sub && <span className="text-sm text-ink/55">{sub}</span>}</span>
    </button>
  )
}

export default function PostMenu({ own, canPin, pinned, onClose, onPin, onEdit, onCopy, onShare, onDelete }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in w-full max-w-md rounded-t-[32px] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />
        {confirm ? (
          <div className="space-y-3 p-2 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-500"><Trash2 size={26} /></div>
            <h3 className="text-lg font-bold">পোস্টটি মুছে ফেলবেন?</h3>
            <p className="text-sm text-ink/60">এটি আর ফেরত আনা যাবে না। ছবি/ভিডিও থাকলে সেটিও মুছে যাবে।</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirm(false)} className="btn-soft flex-1 !bg-mist">না</button>
              <button onClick={onDelete} className="btn flex-1 bg-red-500 text-white">মুছে ফেলুন</button>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {own && canPin && (
              <Row Icon={pinned ? PinOff : Pin} title={pinned ? 'পিন সরান' : 'পোস্ট পিন করুন'} sub={pinned ? 'আর ওপরে দেখানো হবে না' : 'ফিড ও প্রোফাইলের সবার ওপরে থাকবে (একসাথে একটি)'} onClick={onPin} />
            )}
            {own && <Row Icon={Pencil} title="পোস্ট এডিট করুন" sub="লেখা ও গোপনীয়তা বদলান" onClick={onEdit} />}
            <Row Icon={Link2} title="লিংক কপি করুন" onClick={onCopy} />
            <Row Icon={Share2} title="শেয়ার করুন" onClick={onShare} />
            {own && <Row Icon={Trash2} danger title="পোস্ট মুছুন" onClick={() => setConfirm(true)} />}
            <button onClick={onClose} className="btn-soft mt-2 w-full !bg-mist"><X size={18} />বন্ধ করুন</button>
          </div>
        )}
      </div>
    </div>
  )
}
