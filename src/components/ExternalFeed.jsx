import { useEffect, useMemo, useRef, useState } from 'react'
import { Volume2, VolumeX, ExternalLink, Play, RefreshCw, Bookmark, Share2 } from '../lib/icons'
import { APP_NAME } from '../lib/brand'
import { useSavedVideos } from '../context/SavedVideos'
import ShareSheet from './post/ShareSheet'
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

export function ExtReel({ v, index, active, onActive, muted, setMuted }) {
  const { ids, toggle } = useSavedVideos()
  const saved = ids.has(v.external_id)
  const [share, setShare] = useState(false)
  const [flash, setFlash] = useState('')
  const link = v.url || `https://www.youtube.com/shorts/${v.external_id}`
  const doSave = async () => {
    const r = await toggle({ id: v.external_id, title: v.title, channel: v.channel_title })
    setFlash(r.ok ? (r.saved ? 'সেভ করা হয়েছে' : 'সেভ থেকে সরানো হয়েছে') : 'সেভ করা যায়নি — update-21.sql চালান')
    setTimeout(() => setFlash(''), 1800)
  }
  const copy = async () => { try { await navigator.clipboard.writeText(link) } catch { /* ignore */ } setShare(false); setFlash('লিংক কপি হয়েছে'); setTimeout(() => setFlash(''), 1800) }
  const native = async () => { setShare(false); try { await navigator.share({ title: APP_NAME, text: v.title || '', url: link }) } catch { /* বাতিল */ } }
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
        <button onClick={doSave} aria-label="সেভ" className="grid h-11 w-11 place-items-center rounded-full bg-white/20 backdrop-blur">
          <Bookmark size={20} fill={saved ? '#F5B942' : 'none'} stroke={saved ? '#F5B942' : 'white'} />
        </button>
        <button onClick={() => setShare(true)} aria-label="শেয়ার" className="grid h-11 w-11 place-items-center rounded-full bg-white/20 backdrop-blur"><Share2 size={20} /></button>
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
      {flash && <div className="pointer-events-none absolute inset-x-0 bottom-44 z-20 mx-auto w-fit rounded-full bg-black/75 px-4 py-2 text-sm font-semibold text-white">{flash}</div>}
      {share && <ShareSheet url={link} text={v.title || ''} onClose={() => setShare(false)} onCopy={copy} onNative={native} />}
    </section>
  )
}

// সেভ করা ইউটিউব ভিডিওর রিল-ফিড
export function SavedFeed() {
  const { list, ready } = useSavedVideos()
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)
  const center = 'grid h-full place-items-center px-8 text-center text-white'
  if (!ready) return <div className={center}>লোড হচ্ছে…</div>
  if (list.length === 0) return <div className={center}><p className="text-white/80">কোনো ভিডিও সেভ করা নেই। রিলের 🔖 চেপে সেভ করুন।</p></div>
  return (
    <div className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll">
      {list.map((x, i) => (
        <ExtReel key={x.id} v={{ id: x.id, external_id: x.id, title: x.title, channel_title: x.channel }} index={i} active={i === active} onActive={setActive} muted={muted} setMuted={setMuted} />
      ))}
    </div>
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
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-brand to-coral text-inverse"><Play size={30} /></div>
          <p className="font-bold">ইউটিউব কানেক্ট করুন</p>
          <p className="mt-2 text-sm text-white/70">আপনার সাবস্ক্রাইব করা চ্যানেলগুলোর শর্টস এখানে দেখতে পাবেন। শুধু পড়ার অনুমতি নেওয়া হয়, কিছু পোস্ট বা মোছা হয় না।</p>
          {note && <p className="mt-3 text-sm text-danger">{note}</p>}
          {msg && <p className="mt-3 text-sm text-danger">{msg}</p>}
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
          {msg && <p className="mt-2 text-sm text-danger">{msg}</p>}
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
          {msg && <p className="mt-3 text-sm text-danger">{msg}</p>}
        </div>
      </section>
    </div>
  )
}
