import { Phone, Video, FileText, Download, PhoneMissed, UserRound, PhoneOff } from 'lucide-react'
import { fmtSize, mmss, downloadVcf } from '../../lib/media'

const time = (d) => new Date(d).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })

function callText(m, mine) {
  const s = m.meta?.status
  const kind = m.meta?.kind === 'video' ? 'ভিডিও কল' : 'অডিও কল'
  if (s === 'ended') return `${kind} • ${mmss(m.meta.duration)}`
  if (s === 'missed') return mine ? 'কলের উত্তর পাওয়া যায়নি' : `মিসড ${kind}`
  if (s === 'declined') return 'কল প্রত্যাখ্যাত'
  if (s === 'busy') return 'ব্যস্ত ছিলেন'
  return `${kind}…`
}

export default function Bubble({ m, mine, url, votes = [], myId, onVote, onOpenImage }) {
  const sub = mine ? 'text-white/70' : 'text-ink/45'
  const chip = mine ? 'bg-white/15' : 'bg-mist'
  const loading = <div className="h-40 w-52 animate-pulse rounded-2xl bg-black/10" />
  let body

  switch (m.type) {
    case 'image':
      body = url ? <img src={url} alt="" onClick={() => onOpenImage(url)} className="max-h-72 rounded-2xl object-cover" /> : loading
      break
    case 'video':
      body = url ? <video src={url} controls playsInline preload="metadata" className="max-h-72 rounded-2xl bg-black" /> : loading
      break
    case 'audio':
      body = (<div className="space-y-1"><p className="max-w-[14rem] truncate text-sm font-semibold">🎵 {m.file_name}</p>{url && <audio src={url} controls preload="none" className="h-10 w-56" />}</div>)
      break
    case 'voice':
      body = (<div className="space-y-1"><p className="text-sm font-semibold">🎤 ভয়েস মেসেজ • {mmss(m.meta?.duration)}</p>{url && <audio src={url} controls preload="metadata" className="h-10 w-56" />}</div>)
      break
    case 'file':
      body = (
        <a href={url} download={m.file_name} target="_blank" rel="noreferrer" className={`flex items-center gap-3 rounded-2xl p-3 ${chip}`}>
          <FileText size={30} />
          <span className="min-w-0 flex-1"><span className="block max-w-[11rem] truncate font-semibold">{m.file_name}</span><span className={`text-xs ${sub}`}>{fmtSize(m.file_size)}</span></span>
          <Download size={20} />
        </a>
      )
      break
    case 'contact':
      body = (
        <div className="w-56 space-y-2">
          <div className="flex items-center gap-3"><span className={`grid h-11 w-11 place-items-center rounded-full ${chip}`}><UserRound size={22} /></span>
            <span className="min-w-0"><b className="block truncate">{m.meta?.name}</b><span className={`text-sm ${sub}`}>{m.meta?.phone}</span></span></div>
          <div className="flex gap-2">
            <a href={`tel:${m.meta?.phone}`} className={`flex-1 rounded-xl py-1.5 text-center text-sm font-semibold ${chip}`}>কল</a>
            <button onClick={() => downloadVcf(m.meta)} className={`flex-1 rounded-xl py-1.5 text-sm font-semibold ${chip}`}>সেভ করুন</button>
          </div>
        </div>
      )
      break
    case 'poll': {
      const opts = m.meta?.options || []
      const mv = votes.find((v) => v.user_id === myId)?.option_idx
      body = (
        <div className="w-60">
          <p className="mb-2 font-bold">📊 {m.meta?.question}</p>
          {opts.map((o, i) => {
            const c = votes.filter((v) => v.option_idx === i).length
            const pct = votes.length ? Math.round((c * 100) / votes.length) : 0
            return (
              <button key={i} onClick={() => onVote(m, i)} className={`relative mb-1.5 block w-full overflow-hidden rounded-xl text-left ${chip}`}>
                <span className={`absolute inset-y-0 left-0 ${mine ? 'bg-white/30' : 'bg-brand/20'}`} style={{ width: `${pct}%` }} />
                <span className="relative flex justify-between gap-2 px-3 py-2 text-sm"><span>{mv === i ? '✓ ' : ''}{o}</span><b>{c}</b></span>
              </button>
            )
          })}
          <p className={`text-xs ${sub}`}>{votes.length} ভোট • ট্যাপ করে ভোট দিন</p>
        </div>
      )
      break
    }
    case 'call': {
      const bad = ['missed', 'declined', 'busy'].includes(m.meta?.status)
      const Icon = bad ? (m.meta?.status === 'missed' ? PhoneMissed : PhoneOff) : m.meta?.kind === 'video' ? Video : Phone
      body = <div className="flex items-center gap-2.5"><span className={`grid h-9 w-9 place-items-center rounded-full ${chip}`}><Icon size={18} /></span><span className="font-semibold">{callText(m, mine)}</span></div>
      break
    }
    default:
      body = <p className="whitespace-pre-wrap break-words">{m.content}</p>
  }

  return (
    <div className={`flex ${mine ? 'justify-end' : ''}`}>
      <div className={`max-w-[82%] rounded-3xl px-3.5 py-2.5 ${mine ? 'rounded-br-lg bg-gradient-to-br from-brand to-coral text-white' : 'rounded-bl-lg bg-white'}`}>
        {body}
        <p className={`mt-1 text-right text-[10px] ${sub}`}>{time(m.created_at)}</p>
      </div>
    </div>
  )
}
