import { useEffect, useMemo, useRef, useState } from 'react'
import { Volume2, VolumeX, ExternalLink, Play, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { startYoutubeConnect, syncMyShorts, disconnectYoutube } from '../lib/youtube'

function ytSrc(id, muted) {
  const p = new URLSearchParams({
    autoplay: '1', mute: muted ? '1' : '0', playsinline: '1', controls: '0', loop: '1', playlist: id,
    rel: '0', modestbranding: '1', fs: '0', disablekb: '1', iv_load_policy: '3', enablejsapi: '1',
    origin: window.location.origin,
  })
  return `https://www.youtube.com/embed/${id}?${p}`
}

function ExtReel({ v, index, active, onActive, muted, setMuted }) {
  const sec = useRef(null)
  const frame = useRef(null)
  const thumb = v.thumbnail || `https://i.ytimg.com/vi/${v.external_id}/hqdefault.jpg`
  // শুধু সক্রিয় রিলে iframe বসে
  const src = useMemo(() => (active ? ytSrc(v.external_id, muted) : null), [active, v.id])

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && onActive(index), { threshold: 0.6 })
    io.observe(sec.current)
    return () => io.disconnect()
  }, [index, onActive])

  useEffect(() => {
    if (active) frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: muted ? 'mute' : 'unMute', args: [] }), '*')
  }, [muted])

  return (
    <section ref={sec} className="relative h-full snap-start snap-always overflow-hidden bg-black">
      <img src={thumb} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-md" />
      {src && (
        <iframe key={v.id} ref={frame} src={src} title={v.title || 'ভিডিও'} loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture" className="absolute inset-0 h-full w-full border-0" />
      )}
      {active && <div className="absolute inset-0" onClick={() => setMuted(!muted)} />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute bottom-28 right-4 z-10 flex flex-col items-center gap-4 text-white">
        <button onClick={() => setMuted(!muted)} className="grid h-11 w-11 place-items-center rounded-full bg-white/20 backdrop-blur">
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <a href={v.url} target="_blank" rel="noopener noreferrer" className="grid h-11 w-11 place-items-center rounded-full bg-white/20 backdrop-blur">
          <ExternalLink size={20} />
        </a>
      </div>
      <div className="pointer-events-none absolute bottom-28 left-4 right-20 z-10 text-white">
        <p className="text-sm font-bold">{v.channel_title || 'ইউটিউব'}</p>
        {v.title && <p className="mt-1 line-clamp-2 text-sm text-white/90">{v.title}</p>}
      </div>
    </section>
  )
}

export default function ExternalFeed({ note = '' }) {
  const { user } = useAuth()
  const [items, setItems] = useState(null)
  const [conn, setConn] = useState(undefined)
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [reload, setReload] = useState(0)
  const autoSynced = useRef(false)

  useEffect(() => {
    let off = false
    setItems(null); setActive(0); setMsg('')
    ;(async () => {
      const { data: c } = await supabase.from('yt_connections').select('*').eq('user_id', user.id).maybeSingle()
      if (off) return
      setConn(c || null)
      let rows = []
      if (c) {
        const { data, error } = await supabase.rpc('my_sub_shorts', { p_limit: 60 })
        if (error && !off) setMsg('ফিড লোড করা যায়নি: ' + error.message)
        rows = data || []
      }
      if (!off) setItems(rows)
    })()
    return () => { off = true }
  }, [reload, user.id])

  const sync = async () => {
    setBusy(true); setMsg('')
    const { error } = await syncMyShorts()
    setBusy(false)
    if (error) return setMsg('সিঙ্ক করা যায়নি, একটু পরে চেষ্টা করুন')
    setReload((n) => n + 1)
  }

  // কানেক্ট করা আছে অথচ তালিকা খালি: একবার নিজে থেকে সিঙ্ক
  useEffect(() => {
    if (conn && items && items.length === 0 && !autoSynced.current) { autoSynced.current = true; sync() }
  }, [conn, items])

  const connect = async () => {
    setBusy(true); setMsg('')
    try { await startYoutubeConnect() } catch (e) { setBusy(false); setMsg('কানেক্ট শুরু করা যায়নি: ' + e.message) }
  }
  const disconnect = async () => { await disconnectYoutube(); autoSynced.current = false; setReload((n) => n + 1) }

  const center = 'grid h-full place-items-center px-8 text-center text-white'

  if (conn === null && items !== null) {
    return (
      <div className={center}>
        <div>
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-brand to-coral"><Play size={30} /></div>
          <p className="font-bold">ইউটিউব কানেক্ট করুন</p>
          <p className="mt-2 text-sm text-white/70">আপনার সাবস্ক্রাইব করা চ্যানেলগুলোর শর্টস এখানে দেখতে পাবেন। শুধু পড়ার অনুমতি নেওয়া হয়, কিছু পোস্ট বা মোছা হয় না।</p>
          {note && <p className="mt-3 text-sm text-coral">{note}</p>}
          {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
          <button className="btn-primary mt-5" disabled={busy} onClick={connect}>{busy ? 'অপেক্ষা করুন…' : 'ইউটিউব কানেক্ট করুন'}</button>
        </div>
      </div>
    )
  }

  if (items === null) return <div className={center}>লোড হচ্ছে…</div>

  if (items.length === 0) {
    return (
      <div className={center}>
        <div>
          <p className="text-white/80">{busy ? 'আপনার চ্যানেলগুলোর শর্টস আনা হচ্ছে…' : 'এখনও কোনো শর্টস পাওয়া যায়নি।'}</p>
          {msg && <p className="mt-2 text-sm text-coral">{msg}</p>}
          {conn && !busy && (
            <div className="mt-4 flex justify-center gap-2">
              <button className="btn-soft" onClick={sync}><RefreshCw size={16} /> সিঙ্ক</button>
              <button className="btn bg-white/15 text-white" onClick={disconnect}>বিচ্ছিন্ন করুন</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll">
      {items.map((v, i) => (
        <ExtReel key={v.id} v={v} index={i} active={i === active} onActive={setActive} muted={muted} setMuted={setMuted} />
      ))}
      <section className="grid h-full snap-start place-items-center px-8 text-center text-white">
        <div>
          <p className="text-white/80">আর কিছু নেই</p>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-soft" disabled={busy} onClick={sync}><RefreshCw size={16} /> {busy ? 'সিঙ্ক হচ্ছে…' : 'সিঙ্ক'}</button>
            <button className="btn bg-white/15 text-white" onClick={disconnect}>বিচ্ছিন্ন করুন</button>
          </div>
          {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
        </div>
      </section>
    </div>
  )
}
