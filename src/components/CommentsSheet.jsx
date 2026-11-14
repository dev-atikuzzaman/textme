import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Send, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import Avatar from './Avatar'

export default function CommentsSheet({ post, onClose, onChange }) {
  const { user } = useAuth()
  const [items, setItems] = useState(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const end = useRef()

  const load = useCallback(async () => {
    const { data } = await supabase.from('comments').select('*, profiles!comments_user_id_fkey(id,full_name,avatar_url)')
      .eq('post_id', post.id).order('created_at')
    setItems(data || [])
  }, [post.id])
  useEffect(() => { load() }, [load])
  useEffect(() => { end.current?.scrollIntoView() }, [items])

  const send = async (e) => {
    e.preventDefault()
    const t = text.trim(); if (!t) return
    setText(''); setErr('')
    const { error } = await supabase.from('comments').insert({ post_id: post.id, user_id: user.id, content: t })
    if (error) setErr(error.message)
    await load(); onChange?.()
  }
  const del = async (id) => { await supabase.from('comments').delete().eq('id', id); await load(); onChange?.() }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-[32px] bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-2">
          <h2 className="text-lg font-bold">কমেন্ট</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-mist"><X size={18} /></button>
        </div>
        <div className="min-h-[120px] flex-1 space-y-3 overflow-y-auto px-5 py-2">
          {items === null && <p className="text-center text-ink/50">লোড হচ্ছে…</p>}
          {items?.length === 0 && <p className="py-6 text-center text-ink/60">এখনও কোনো কমেন্ট নেই। প্রথম কমেন্টটি আপনি করুন।</p>}
          {items?.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar p={c.profiles} size={36} />
              <div className="min-w-0 flex-1 rounded-3xl rounded-tl-lg bg-mist px-4 py-2.5">
                <p className="text-sm font-bold">{c.profiles?.full_name}</p>
                <p className="whitespace-pre-wrap break-words">{c.content}</p>
              </div>
              {(c.user_id === user.id || post.user_id === user.id) && (
                <button onClick={() => del(c.id)} className="self-center text-ink/30"><Trash2 size={16} /></button>
              )}
            </div>
          ))}
          <div ref={end} />
        </div>
        {err && <p className="px-5 text-sm text-coral">{err}</p>}
        <form onSubmit={send} className="flex gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <input className="input" placeholder="কমেন্ট লিখুন…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-primary !px-4"><Send size={20} /></button>
        </form>
      </div>
    </div>
  )
}
