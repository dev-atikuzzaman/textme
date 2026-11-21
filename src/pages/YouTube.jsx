import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Search, Play, X, ExternalLink, Clock, Bookmark, Share2 } from '../lib/icons'
import { APP_NAME } from '../lib/brand'
import { useSavedVideos } from '../context/SavedVideos'
import ShareSheet from '../components/post/ShareSheet'
import { useNavigate } from 'react-router-dom'
import { ytId, ytEmbed, ytThumb, ytMeta, ytSearch, ytKey } from '../lib/yt'

const HKEY = 'yt-history'
const loadH = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '[]') } catch { return [] } }

// অ্যাপের ভেতরেই ইউটিউব: লিংক পেস্ট করে বা (API key থাকলে) সার্চ করে ভিডিও চালান
export default function YouTube() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [cur, setCur] = useState(null)       // {id,title,channel}
  const [list, setList] = useState([])
  const [hist, setHist] = useState(loadH)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const { ids, list: savedList, toggle } = useSavedVideos()
  const [share, setShare] = useState(false)
  const [flash, setFlash] = useState('')
  const say = (t) => { setFlash(t); setTimeout(() => setFlash(''), 1800) }
  const link = cur ? `https://www.youtube.com/watch?v=${cur.id}` : ''
  const doSave = async () => { const r = await toggle(cur); say(r.ok ? (r.saved ? 'সেভ করা হয়েছে' : 'সেভ থেকে সরানো হয়েছে') : 'সেভ করা যায়নি — update-21.sql চালান') }
  const copy = async () => { try { await navigator.clipboard.writeText(link) } catch { /* ignore */ } setShare(false); say('লিংক কপি হয়েছে') }
  const native = async () => { setShare(false); try { await navigator.share({ title: APP_NAME, text: cur.title || '', url: link }) } catch { /* বাতিল */ } }

  const play = useCallback(async (v) => {
    setCur(v); window.scrollTo({ top: 0, behavior: 'smooth' })
    const meta = v.title ? v : await ytMeta(v.id)
    setCur(meta)
    setHist((h) => { const n = [meta, ...h.filter((x) => x.id !== meta.id)].slice(0, 20); try { localStorage.setItem(HKEY, JSON.stringify(n)) } catch { /* ignore */ } return n })
  }, [])

  const run = useCallback(async (text) => {
    setErr('')
    const id = ytId(text)
    if (id) { setQ(''); return play({ id }) }
    if (!ytKey) return setErr('সার্চ চালু করতে ইউটিউব API key লাগে (নিচের নির্দেশ দেখুন)। এখন ইউটিউবের ভিডিও লিংক পেস্ট করে চালাতে পারবেন।')
    setBusy(true)
    try { setList(await ytSearch(text.trim())) } catch (e) { setErr('সার্চ হয়নি: ' + e.message) } finally { setBusy(false) }
  }, [play])

  useEffect(() => { if (ytKey) run('') }, [run])

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => nav(-1)} aria-label="পেছনে" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-soft"><ArrowLeft size={20} /></button>
        <h1 className="flex items-center gap-2 text-xl font-bold"><span className="grid h-7 w-9 place-items-center rounded-lg bg-red-600 text-white"><Play size={14} fill="currentColor" /></span>ইউটিউব</h1>
      </div>

      {cur && (
        <div className="sticky top-[4.2rem] z-20 space-y-2 rounded-3xl bg-surface p-2 shadow-soft">
          <div className="aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe key={cur.id} src={ytEmbed(cur.id)} title="YouTube" className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          </div>
          <div className="flex items-start gap-2 px-1.5 pb-1">
            <div className="min-w-0 flex-1"><p className="line-clamp-2 font-bold leading-snug">{cur.title || 'লোড হচ্ছে…'}</p>{cur.channel && <p className="text-sm text-fg/60">{cur.channel}</p>}</div>
            <button onClick={doSave} aria-label="সেভ" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2 ${ids.has(cur.id) ? 'text-coral' : ''}`}><Bookmark size={17} fill={ids.has(cur.id) ? 'currentColor' : 'none'} /></button>
            <button onClick={() => setShare(true)} aria-label="শেয়ার" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2"><Share2 size={17} /></button>
            <a href={`https://www.youtube.com/watch?v=${cur.id}`} target="_blank" rel="noreferrer" aria-label="ইউটিউবে খুলুন" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2"><ExternalLink size={17} /></a>
            <button onClick={() => setCur(null)} aria-label="বন্ধ" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2"><X size={18} /></button>
          </div>
        </div>
      )}

      {flash && <p className="rounded-2xl bg-ink p-2.5 text-center text-sm font-semibold text-white">{flash}</p>}
      {share && cur && <ShareSheet url={link} text={cur.title || ''} onClose={() => setShare(false)} onCopy={copy} onNative={native} />}

      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) run(q) }} className="relative">
        <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg/45" />
        <input className="input !pl-11" placeholder={ytKey ? 'ইউটিউবে খুঁজুন বা লিংক পেস্ট করুন' : 'ইউটিউব ভিডিওর লিংক পেস্ট করুন'} value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {err && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">{err}</p>}
      {busy && <p className="py-6 text-center text-fg/50">খোঁজা হচ্ছে…</p>}

      {list.length > 0 && (
        <div className="space-y-3">
          {list.map((v) => (
            <button key={v.id} onClick={() => play(v)} className="block w-full overflow-hidden rounded-3xl bg-surface text-left shadow-soft active:scale-[0.99]">
              <img src={ytThumb(v.id)} alt="" loading="lazy" className="aspect-video w-full object-cover" />
              <div className="p-3"><p className="line-clamp-2 font-bold leading-snug">{v.title}</p><p className="text-sm text-fg/60">{v.channel}</p></div>
            </button>
          ))}
        </div>
      )}

      {savedList.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 px-1 font-bold"><Bookmark size={16} />সেভ করা ভিডিও</h2>
          {savedList.map((v) => (
            <div key={v.id} className="flex items-center gap-2 rounded-2xl bg-surface p-2 shadow-soft">
              <button onClick={() => play(v)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <img src={ytThumb(v.id)} alt="" loading="lazy" className="h-14 w-24 shrink-0 rounded-xl object-cover" />
                <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm font-semibold leading-snug">{v.title || 'ইউটিউব ভিডিও'}</span><span className="block truncate text-xs text-fg/55">{v.channel}</span></span>
              </button>
              <button onClick={() => toggle(v)} aria-label="সেভ থেকে সরান" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2 text-fg/60"><X size={16} /></button>
            </div>
          ))}
        </section>
      )}

      {hist.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1"><h2 className="flex items-center gap-1.5 font-bold"><Clock size={16} />সাম্প্রতিক</h2><button onClick={() => { setHist([]); try { localStorage.removeItem(HKEY) } catch { /* ignore */ } }} className="text-xs text-fg/50">মুছুন</button></div>
          {hist.map((v) => (
            <button key={v.id} onClick={() => play(v)} className="flex w-full items-center gap-3 rounded-2xl bg-surface p-2 text-left shadow-soft">
              <img src={ytThumb(v.id)} alt="" loading="lazy" className="h-14 w-24 shrink-0 rounded-xl object-cover" />
              <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm font-semibold leading-snug">{v.title}</span><span className="block truncate text-xs text-fg/55">{v.channel}</span></span>
            </button>
          ))}
        </section>
      )}

      {!ytKey && (
        <p className="rounded-2xl bg-surface p-4 text-sm leading-relaxed text-fg/70 shadow-soft">
          💡 <b>সার্চ ও ট্রেন্ডিং চালু করতে:</b> Google Cloud-এ বিনামূল্যে "YouTube Data API v3" চালু করে একটি API key নিন, তারপর Vercel-এ <code>VITE_YT_API_KEY</code> নামে যোগ করে আবার ডিপ্লয় করুন। চাইলে পোস্ট বা মেসেজে ইউটিউব লিংক দিলেও ভিডিও অ্যাপের ভেতরেই চলবে।
        </p>
      )}
    </div>
  )
}
