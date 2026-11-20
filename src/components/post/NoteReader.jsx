import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from '../../lib/icons'
import Avatar from '../Avatar'
import { linkify } from '../../lib/linkify'
import { fmt } from '../../lib/constants'
import { readMins } from './NoteCard'

// পুরো নোট পড়ার ফুলস্ক্রিন রিডার
export default function NoteReader({ post, onClose }) {
  const who = post.page || post.profiles
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev }
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-forest">
      <div className="mx-auto min-h-full max-w-2xl pb-16">
        <div className="sticky top-0 z-10 flex justify-end bg-gradient-to-b from-forest to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-11 w-11 place-items-center rounded-full bg-surface shadow-soft"><X size={22} /></button>
        </div>
        {post.media_url && <img src={post.media_url} alt="" className="mb-5 max-h-[50vh] w-full object-cover sm:rounded-3xl" />}
        <article className="px-5">
          <h1 className="text-3xl font-extrabold leading-tight">{post.title}</h1>
          <div className="mt-4 flex items-center gap-3">
            <Avatar p={who} size={40} />
            <div className="text-sm leading-tight"><p className="font-bold">{who?.full_name}</p><p className="text-fg/50">{fmt(post.created_at)} • {readMins(post.content).toLocaleString('bn-BD')} মিনিটের পড়া</p></div>
          </div>
          <div className="mt-6 whitespace-pre-wrap break-words text-lg leading-[1.85]">{linkify(post.content || '')}</div>
        </article>
      </div>
    </div>,
    document.body
  )
}
