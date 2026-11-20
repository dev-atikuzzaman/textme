import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from '../../lib/icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/Auth'
import { REACTIONS } from '../../lib/constants'
import Avatar from '../Avatar'
import FileCard from '../FileCard'
import ReactionBar from './ReactionBar'
import ReactionsSheet from './ReactionsSheet'

const bn = (n) => n.toLocaleString('bn-BD')
function ago(d) {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000))
  if (m < 1) return 'এইমাত্র'
  if (m < 60) return `${bn(m)} মিনিট`
  if (m < 1440) return `${bn(Math.round(m / 60))} ঘণ্টা`
  return `${bn(Math.round(m / 1440))} দিন`
}

export default function CommentItem({ c, isReply = false, postOwnerId, parentAuthorId, nameOf, active, canDelete, onDelete, onReply, onOpenImage }) {
  const { user } = useAuth()
  const [rx, setRx] = useState(c.comment_reactions || [])
  const [who, setWho] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { setRx(c.comment_reactions || []) }, [c.comment_reactions])
  const mine = rx.find((x) => x.user_id === user.id)?.type

  const react = async (type) => {
    const prev = rx
    let r
    if (!type) {
      setRx((l) => l.filter((x) => x.user_id !== user.id))
      r = await supabase.from('comment_reactions').delete().match({ comment_id: c.id, user_id: user.id })
    } else if (mine) {
      setRx((l) => l.map((x) => (x.user_id === user.id ? { ...x, type } : x)))
      r = await supabase.from('comment_reactions').update({ type }).match({ comment_id: c.id, user_id: user.id })
    } else {
      setRx((l) => [...l, { user_id: user.id, type }])
      r = await supabase.from('comment_reactions').insert({ comment_id: c.id, user_id: user.id, type })
    }
    if (r.error) { setRx(prev); setErr('রিয়্যাক্ট করা যায়নি — update-9.sql চালান'); setTimeout(() => setErr(''), 3000) }
  }

  const top = REACTIONS.map((r) => ({ ...r, n: rx.filter((x) => x.type === r.id).length })).filter((r) => r.n).sort((a, b) => b.n - a.n).slice(0, 3)
  const showMention = isReply && c.reply_to && c.reply_to !== parentAuthorId

  return (
    <div className="flex gap-2.5" data-cid={c.id}>
      <Link to={`/profile/${c.user_id}`}><Avatar p={c.profiles} size={isReply ? 30 : 36} /></Link>
      <div className="min-w-0 flex-1">
        <div className={`relative inline-block max-w-full rounded-3xl rounded-tl-lg bg-surface2 px-4 py-2.5 transition ${active ? 'ring-2 ring-brand/60' : ''}`}>
          <p className="flex items-center gap-2 text-sm font-bold">
            {c.profiles?.full_name}
            {c.user_id === postOwnerId && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">লেখক</span>}
          </p>
          {(c.content || showMention) && (
            <p className="whitespace-pre-wrap break-words">
              {showMention && <span className="mr-1 font-bold text-brand">@{nameOf(c.reply_to)}</span>}{c.content}
            </p>
          )}
          {c.media_url && c.media_type === 'image' && <img src={c.media_url} alt="" loading="lazy" onClick={() => onOpenImage(c.media_url)} className="mt-2 max-h-64 rounded-2xl object-cover" />}
          {c.media_url && c.media_type === 'video' && <video src={c.media_url} controls playsInline preload="metadata" className="mt-2 max-h-64 rounded-2xl bg-black" />}
          {c.media_url && c.media_type === 'file' && <FileCard url={c.media_url} name={c.media_name} size={c.media_size} className="mt-2 !bg-surface" />}
          {top.length > 0 && (
            <button onClick={() => setWho(true)} className="absolute -bottom-3 right-2 flex items-center gap-1 rounded-full bg-surface px-1.5 py-0.5 text-xs shadow-lg ring-1 ring-brand/25">
              {top.map((r) => <span key={r.id}>{r.emoji}</span>)}{rx.length > 1 && <b className="text-fg/70">{rx.length}</b>}
            </button>
          )}
        </div>
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-xs text-fg/55 ${top.length ? 'mt-4' : 'mt-1.5'}`}>
          <ReactionBar compact mine={mine} onReact={react} />
          <button onClick={onReply} className="font-bold text-fg/60 transition active:scale-95 active:text-brand">উত্তর দিন</button>
          <span>{ago(c.created_at)}</span>
          {canDelete && <button onClick={onDelete} className="flex items-center gap-1 font-bold text-danger/80"><Trash2 size={12} />মুছুন</button>}
        </div>
        {err && <p className="px-2 pt-1 text-xs text-danger">{err}</p>}
      </div>
      {who && <ReactionsSheet table="comment_reactions" col="comment_id" id={c.id} onClose={() => setWho(false)} />}
    </div>
  )
}
