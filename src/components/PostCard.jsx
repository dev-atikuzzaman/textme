import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal, MessageCircle, Share2, Pin, Bookmark, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { useSaved } from '../context/Saved'
import { linkify } from '../lib/linkify'
import { PRIVACY, REACTIONS, fmt } from '../lib/constants'
import { mediaPathFromUrl } from '../lib/media'
import Avatar from './Avatar'
import CommentsSheet from './CommentsSheet'
import ReactionBar from './post/ReactionBar'
import PostMenu from './post/PostMenu'
import EditPostSheet from './post/EditPostSheet'
import ReactionsSheet from './post/ReactionsSheet'
import FileCard from './FileCard'
import ShareSheet from './post/ShareSheet'
import Lightbox from './post/Lightbox'
import AutoVideo from './post/AutoVideo'
import NoteCard from './post/NoteCard'
import NoteReader from './post/NoteReader'

export default function PostCard({ post, onChange, onHide }) {
  const { user } = useAuth()
  const { ids: savedIds, toggle: toggleSave } = useSaved()
  const saved = savedIds.has(post.id)
  const clickT = useRef()
  const [likes, setLikes] = useState(post.likes || [])
  const [sheet, setSheet] = useState(null) // comments | menu | edit | who
  const [expanded, setExpanded] = useState(false)
  const [burst, setBurst] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => { setLikes(post.likes || []) }, [post.likes])

  const own = post.user_id === user.id
  const isNote = post.category === 'note'
  const pg = post.page
  const P = PRIVACY.find((p) => p.id === post.privacy)
  const mine = likes.find((l) => l.user_id === user.id)?.type
  const commentCount = post.comments?.[0]?.count || 0
  const text = post.content || ''
  const long = text.length > 220 || (text.match(/\n/g) || []).length > 5
  const url = `${window.location.origin}/post/${post.id}`

  const flash = (m) => { setNote(m); setTimeout(() => setNote(''), 2500) }

  const react = async (type) => {
    const prev = likes
    let r
    if (!type) {
      setLikes((l) => l.filter((x) => x.user_id !== user.id))
      r = await supabase.from('likes').delete().match({ post_id: post.id, user_id: user.id })
    } else if (mine) {
      setLikes((l) => l.map((x) => (x.user_id === user.id ? { ...x, type } : x)))
      r = await supabase.from('likes').update({ type }).match({ post_id: post.id, user_id: user.id })
    } else {
      setLikes((l) => [...l, { user_id: user.id, type }])
      r = await supabase.from('likes').insert({ post_id: post.id, user_id: user.id, type })
    }
    if (r.error) { setLikes(prev); flash('রিয়্যাক্ট করা যায়নি — update-8.sql চালিয়েছেন কিনা দেখুন') }
  }

  const doubleTap = () => {
    if (mine !== 'love') react('love')
    setBurst(true); setTimeout(() => setBurst(false), 700)
  }
  const doSave = async () => {
    setSheet(null)
    const r = await toggleSave(post.id)
    flash(r.ok ? (r.saved ? 'সেভ করা হয়েছে' : 'সেভ থেকে সরানো হয়েছে') : 'সেভ করা যায়নি — update-12.sql চালান')
  }
  const doHide = () => { setSheet(null); onHide?.(post.id) }
  const zoom = () => { clearTimeout(clickT.current); clickT.current = setTimeout(() => setSheet('zoom'), 250) }
  const dbl = () => { clearTimeout(clickT.current); doubleTap() }
  const copy = async () => {
    setSheet(null)
    try { await navigator.clipboard.writeText(url); flash('লিংক কপি হয়েছে') } catch { flash(url) }
  }
  const share = () => setSheet('share')
  const nativeShare = async () => {
    setSheet(null)
    try {
      if (navigator.share) await navigator.share({ title: 'আপন', text: text.slice(0, 80), url })
      else { await navigator.clipboard.writeText(url); flash('লিংক কপি হয়েছে') }
    } catch { /* বাতিল */ }
  }
  const pin = async () => {
    setSheet(null)
    const { error } = await supabase.rpc('set_pin', { p_post: post.id, p_pin: !post.pinned_at })
    if (error) return flash('পিন করা যায়নি — update-8.sql চালান')
    onChange()
  }
  const del = async () => {
    const path = mediaPathFromUrl(post.media_url)
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) { setSheet(null); return flash(error.message) }
    if (path) supabase.storage.from('media').remove([path])
    setSheet(null); onChange()
  }

  const counts = REACTIONS.map((r) => ({ ...r, n: likes.filter((l) => l.type === r.id).length })).filter((r) => r.n)
  const top = [...counts].sort((a, b) => b.n - a.n).slice(0, 3)

  return (
    <article className="relative rounded-[28px] bg-surface p-4 shadow-soft">
      {post.pinned_at && (
        <div className="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 rounded-t-[28px] bg-brand/10 px-4 py-2 text-xs font-bold text-brand"><Pin size={13} />পিন করা পোস্ট</div>
      )}

      <div className="flex items-center gap-3">
        <Link to={pg ? `/pages/${pg.id}` : `/profile/${post.user_id}`}><Avatar p={pg || post.profiles} /></Link>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-bold"><span className="truncate">{pg ? pg.name : post.profiles?.full_name}</span>{pg && <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">পেজ</span>}</p>
          <p className="flex flex-wrap items-center gap-x-1 text-xs text-fg/50">
            {post.group && <Link to={`/groups/${post.group.id}`} className="inline-flex items-center gap-1 font-semibold text-brand"><Users size={12} />{post.group.name}</Link>}
            {post.group && <span>•</span>}
            {!post.group && !pg && P && <P.Icon size={12} />}{fmt(post.created_at)}{post.edited_at && ' • সম্পাদিত'}
          </p>
        </div>
        <button onClick={() => setSheet('menu')} aria-label="অপশন" className="grid h-9 w-9 place-items-center rounded-full text-fg/50 transition active:bg-surface2"><MoreHorizontal size={22} /></button>
      </div>

      {isNote && <NoteCard post={post} onOpen={() => setSheet('note')} />}
      {!isNote && post.title && <h3 className="mt-3 font-bold">{post.title}</h3>}
      {!isNote && text && (
        <div className="mt-3">
          <p className={`whitespace-pre-wrap break-words leading-relaxed ${long && !expanded ? 'line-clamp-6' : ''}`}>{linkify(text)}</p>
          {long && !expanded && <button onClick={() => setExpanded(true)} className="mt-1 text-sm font-bold text-brand">আরও দেখুন</button>}
        </div>
      )}

      {!isNote && post.media_url && (
        <div className="relative mt-3" onDoubleClick={post.media_type === 'file' ? undefined : dbl} onClick={post.media_type === 'image' ? zoom : undefined}>
          {post.media_type === 'file'
            ? <FileCard url={post.media_url} name={post.media_name} size={post.media_size} />
            : post.media_type === 'video'
            ? <AutoVideo src={post.media_url} />
            : <img src={post.media_url} alt="" loading="lazy" className="w-full cursor-zoom-in rounded-2xl object-cover" />}
          {burst && <span className="heart-burst pointer-events-none absolute inset-0 grid place-items-center text-7xl">❤️</span>}
        </div>
      )}

      {(likes.length > 0 || commentCount > 0) && (
        <div className="mt-3 flex items-center justify-between text-sm text-fg/60">
          {likes.length > 0 ? (
            <button onClick={() => setSheet('who')} className="flex items-center gap-1.5">
              <span className="flex -space-x-1.5">{top.map((r) => <span key={r.id} className="grid h-6 w-6 place-items-center rounded-full bg-surface2 text-sm ring-2 ring-surface">{r.emoji}</span>)}</span>
              <b>{likes.length}</b>
            </button>
          ) : <span />}
          {commentCount > 0 && <button onClick={() => setSheet('comments')}>{commentCount} কমেন্ট</button>}
        </div>
      )}

      <div className="mt-2 flex border-t border-fg/5 pt-1.5">
        <ReactionBar mine={mine} onReact={react} />
        <button onClick={() => setSheet('comments')} className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-fg/60 transition active:scale-95"><MessageCircle size={20} />কমেন্ট</button>
        <button onClick={share} className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-fg/60 transition active:scale-95"><Share2 size={19} />শেয়ার</button>
        <button onClick={doSave} aria-label={saved ? 'সেভ থেকে সরান' : 'সেভ করুন'} className={`grid w-12 shrink-0 place-items-center rounded-2xl transition active:scale-90 ${saved ? 'text-coral' : 'text-fg/60'}`}><Bookmark size={20} fill={saved ? 'currentColor' : 'none'} /></button>
      </div>
      {note && <p className="mt-2 rounded-xl bg-surface2 p-2.5 text-center text-sm font-semibold text-fg/70">{note}</p>}

      {sheet === 'comments' && <CommentsSheet post={post} onClose={() => setSheet(null)} onChange={onChange} />}
      {sheet === 'share' && <ShareSheet url={url} text={text} onClose={() => setSheet(null)} onCopy={copy} onNative={nativeShare} />}
      {sheet === 'note' && <NoteReader post={post} onClose={() => setSheet(null)} />}
      {sheet === 'zoom' && <Lightbox src={post.media_url} onClose={() => setSheet(null)} />}
      {sheet === 'who' && <ReactionsSheet table="likes" col="post_id" id={post.id} onClose={() => setSheet(null)} />}
      {sheet === 'edit' && <EditPostSheet post={post} onClose={() => setSheet(null)} onSaved={onChange} />}
      {sheet === 'menu' && (
        <PostMenu own={own} canPin={post.kind === 'post'} pinned={!!post.pinned_at} saved={saved} onSave={doSave} onHide={onHide ? doHide : undefined}
          onClose={() => setSheet(null)} onPin={pin} onEdit={() => setSheet('edit')} onCopy={copy} onShare={share} onDelete={del} />
      )}
    </article>
  )
}
