import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import Avatar from '../components/Avatar'

export default function Chat() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [other, setOther] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const end = useRef()

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', id).single().then(({ data }) => setOther(data))
    supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`)
      .order('created_at').then(({ data }) => setMsgs(data || []))
    const ch = supabase.channel(`chat-${user.id}-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        (p) => { if (p.new.sender_id === id) setMsgs((m) => [...m, p.new]) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, user.id])

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const send = async (e) => {
    e.preventDefault()
    const t = text.trim(); if (!t) return
    setText(''); setErr('')
    const { data, error } = await supabase.from('messages').insert({ sender_id: user.id, receiver_id: id, content: t }).select().single()
    if (error) setErr('মেসেজ পাঠানো যায়নি — শুধু বন্ধুদের মেসেজ পাঠানো যায়।')
    else setMsgs((m) => [...m, data])
  }

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-mist">
      <header className="flex items-center gap-3 bg-white p-3 shadow-sm">
        <button onClick={() => nav(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-mist"><ArrowLeft size={20} /></button>
        <Avatar p={other} size={40} /><b>{other?.full_name}</b>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.map((m) => {
          const mine = m.sender_id === user.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : ''}`}>
              <p className={`max-w-[78%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 ${mine ? 'rounded-br-lg bg-gradient-to-br from-brand to-coral text-white' : 'rounded-bl-lg bg-white'}`}>{m.content}</p>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      {err && <p className="px-4 pb-1 text-sm text-coral">{err}</p>}
      <form onSubmit={send} className="flex gap-2 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input className="input" placeholder="মেসেজ লিখুন…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary !px-4"><Send size={20} /></button>
      </form>
    </div>
  )
}
