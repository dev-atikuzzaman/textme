import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, X, Plus, Users, Trash2, ChevronLeft, ChevronRight, Images } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { useFriends } from '../lib/useFriends'
import { compressImage, extOf, mediaPathFromUrl } from '../lib/media'
import { uploadToStorage, MAX_UPLOAD } from '../lib/upload'
import { bn, fmtDate } from '../lib/family'
import { toast, confirmDialog, errMsg } from '../lib/ui'
import Avatar from '../components/Avatar'
import SmartImg from '../components/SmartImg'

// ছবি বড় করে দেখা: ডানে-বামে বাটন/কিবোর্ড/সোয়াইপ
function Viewer({ photos, index, setIndex, canDelete, onDelete, onClose }) {
  const ph = photos[index], x0 = useRef(null)
  const go = useCallback((d) => setIndex((i) => Math.min(photos.length - 1, Math.max(0, i + d))), [photos.length, setIndex])
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') go(1); if (e.key === 'ArrowRight') go(-1) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [go, onClose])
  if (!ph) return null
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white" data-own-esc role="dialog" aria-modal="true"
      onTouchStart={(e) => { x0.current = e.touches[0].clientX }}
      onTouchEnd={(e) => { if (x0.current == null) return; const dx = e.changedTouches[0].clientX - x0.current; x0.current = null; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1) }}>
      <div className="flex items-center gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Avatar p={ph.profiles} size={36} />
        <div className="min-w-0 flex-1"><b className="block truncate text-sm">{ph.profiles?.full_name}</b><span className="text-xs text-white/85">{fmtDate(ph.created_at)} • {bn(index + 1)}/{bn(photos.length)}</span></div>
        {canDelete(ph) && <button onClick={() => onDelete(ph)} aria-label="ছবি মুছুন" className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><Trash2 size={18} /></button>}
        <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><X size={20} /></button>
      </div>
      <div className="relative grid min-h-0 flex-1 place-items-center" onClick={onClose}>
        <img src={ph.media_url} alt={ph.caption || ''} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        {index < photos.length - 1 && <button onClick={(e) => { e.stopPropagation(); go(1) }} aria-label="আগের ছবি" className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-white/15"><ChevronLeft size={22} /></button>}
        {index > 0 && <button onClick={(e) => { e.stopPropagation(); go(-1) }} aria-label="পরের ছবি" className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-white/15"><ChevronRight size={22} /></button>}
      </div>
      {ph.caption && <p className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center text-sm">{ph.caption}</p>}
    </div>
  )
}

// সদস্য দেখা/যোগ/সরানো
function MembersSheet({ album, members, isOwner, onClose, onChanged }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const { friends, people, other } = useFriends()
  const ids = new Set(members.map((m) => m.user_id))
  const addable = friends.map((r) => people[other(r)]).filter((p) => p && !ids.has(p.id))

  const add = async (uid) => {
    const { error } = await supabase.from('album_members').insert({ album_id: album.id, user_id: uid })
    if (error) return toast.error(errMsg(error)); onChanged()
  }
  const remove = async (uid) => {
    const { error } = await supabase.from('album_members').delete().eq('album_id', album.id).eq('user_id', uid)
    if (error) return toast.error(errMsg(error)); onChanged()
  }
  const leave = async () => {
    if (!(await confirmDialog('অ্যালবাম ছেড়ে গেলে আর ছবি দেখতে পারবেন না।', { title: 'অ্যালবাম ছাড়বেন?', danger: true, confirmText: 'ছেড়ে যান' }))) return
    await remove(user.id); nav('/family?tab=albums', { replace: true })
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/55 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="অ্যালবামের সদস্য" onClick={(e) => e.stopPropagation()}
        className="pop-in max-h-[88dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">সদস্য ({bn(members.length)})</h2>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 rounded-2xl bg-surface2 p-2.5">
            <Avatar p={m.profiles} size={40} />
            <span className="min-w-0 flex-1 truncate font-semibold">{m.profiles?.full_name}{m.user_id === album.created_by && <span className="ml-2 rounded-full bg-coral/15 px-2 py-0.5 text-[11px] text-coral">মালিক</span>}</span>
            {isOwner && m.user_id !== album.created_by && <button onClick={() => remove(m.user_id)} className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-danger">সরান</button>}
          </div>
        ))}
        {isOwner && addable.length > 0 && (
          <>
            <p className="pt-1 font-bold">যোগ করুন</p>
            {addable.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-surface2 p-2.5">
                <Avatar p={p} size={40} /><span className="min-w-0 flex-1 truncate font-semibold">{p.full_name}</span>
                <button onClick={() => add(p.id)} className="btn-primary !px-3.5 !py-1.5 text-sm">যোগ</button>
              </div>
            ))}
          </>
        )}
        {!isOwner && <button onClick={leave} className="btn-soft w-full !text-danger">অ্যালবাম ছেড়ে যান</button>}
      </div>
    </div>
  )
}

export default function AlbumView() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const [album, setAlbum] = useState(undefined)
  const [photos, setPhotos] = useState([])
  const [members, setMembers] = useState([])
  const [viewer, setViewer] = useState(null)
  const [sheet, setSheet] = useState(false)
  const [up, setUp] = useState(null)
  const fileRef = useRef()
  const isOwner = album?.created_by === user.id

  const load = useCallback(async () => {
    const [a, p, m] = await Promise.all([
      supabase.from('albums').select('*').eq('id', id).maybeSingle(),
      supabase.from('album_photos').select('*, profiles(id, full_name, avatar_url)').eq('album_id', id).order('created_at', { ascending: false }),
      supabase.from('album_members').select('user_id, profiles(id, full_name, avatar_url)').eq('album_id', id),
    ])
    setAlbum(a.data || null); setPhotos(p.data || []); setMembers(m.data || [])
  }, [id])
  useEffect(() => { load() }, [load])

  const upload = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/')).slice(0, 20)
    if (!list.length) return toast('ছবি বেছে নিন')
    let ok = 0
    for (let i = 0; i < list.length; i++) {
      setUp({ i: i + 1, n: list.length, pct: 0 })
      try {
        if (list[i].size > MAX_UPLOAD) { toast.error(`"${list[i].name}" অনেক বড় — বাদ দেওয়া হলো`); continue }
        const f = await compressImage(list[i])
        const path = `${user.id}/album-${id.slice(0, 8)}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.${extOf(f)}`
        await uploadToStorage('media', path, f, (pct) => setUp({ i: i + 1, n: list.length, pct }))
        const { error } = await supabase.from('album_photos').insert({ album_id: id, media_url: supabase.storage.from('media').getPublicUrl(path).data.publicUrl })
        if (error) throw error
        ok++
      } catch (e) { toast.error(errMsg(e, 'একটি ছবি আপলোড করা যায়নি')) }
    }
    setUp(null)
    if (ok) { toast.success(`${bn(ok)}টি ছবি যোগ হয়েছে`); load() }
  }
  const canDelete = (ph) => ph.user_id === user.id || isOwner
  const delPhoto = async (ph) => {
    if (!(await confirmDialog('ছবিটি অ্যালবাম থেকে মুছে যাবে।', { title: 'ছবি মুছবেন?', danger: true, confirmText: 'মুছুন' }))) return
    const { error } = await supabase.from('album_photos').delete().eq('id', ph.id)
    if (error) return toast.error(errMsg(error))
    const path = ph.user_id === user.id ? mediaPathFromUrl(ph.media_url) : null
    if (path) supabase.storage.from('media').remove([path]).catch(() => {}) // ফাইলও মুছে ফেলার চেষ্টা (না হলেও ক্ষতি নেই)
    setViewer(null); load()
  }
  const delAlbum = async () => {
    if (!(await confirmDialog('অ্যালবাম ও এর সব ছবি মুছে যাবে।', { title: 'অ্যালবাম মুছবেন?', danger: true, confirmText: 'মুছে ফেলুন' }))) return
    const { error } = await supabase.from('albums').delete().eq('id', id)
    if (error) return toast.error(errMsg(error))
    toast.success('অ্যালবাম মুছে ফেলা হয়েছে'); nav('/family?tab=albums', { replace: true })
  }

  if (album === undefined) return <p className="py-16 text-center text-fg/65">লোড হচ্ছে…</p>
  if (album === null) return (
    <div className="space-y-3 py-16 text-center"><p className="text-4xl">🔒</p><p className="font-bold">অ্যালবামটি পাওয়া যায়নি বা আপনি এর সদস্য নন</p><Link to="/family?tab=albums" className="btn-primary inline-flex">অ্যালবামে ফিরুন</Link></div>
  )
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => nav('/family?tab=albums')} aria-label="পেছনে যান" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface shadow-soft"><ArrowLeft size={20} /></button>
        <div className="min-w-0 flex-1"><h2 className="truncate text-xl font-extrabold">{album.title}</h2>{album.description && <p className="truncate text-sm text-fg/65">{album.description}</p>}</div>
        <button onClick={() => setSheet(true)} aria-label="সদস্য" className="flex h-10 items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-bold shadow-soft"><Users size={17} />{bn(members.length)}</button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
      <button onClick={() => fileRef.current.click()} disabled={!!up} className="btn-primary w-full">
        <Plus size={18} />{up ? `আপলোড হচ্ছে ${bn(up.i)}/${bn(up.n)}${up.pct ? ` (${bn(Math.round(up.pct))}%)` : ''}` : 'ছবি যোগ করুন'}
      </button>

      {photos.length === 0 ? (
        <div className="space-y-2 rounded-3xl bg-surface p-8 text-center shadow-soft"><Images size={36} className="mx-auto text-brand" /><p className="font-bold">এখনও কোনো ছবি নেই</p><p className="text-sm text-fg/65">প্রথম ছবিটি আপনিই যোগ করুন।</p></div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((ph, i) => (
            <button key={ph.id} onClick={() => setViewer(i)} aria-label={`ছবি ${bn(i + 1)}`} className="aspect-square overflow-hidden rounded-xl bg-surface2 active:scale-95">
              <SmartImg src={ph.media_url} alt={ph.caption || 'অ্যালবামের ছবি'} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-fg/65">অ্যালবামের সব সদস্য ছবি যোগ করতে পারে। নিজের ছবি নিজে মুছতে পারবেন।</p>
      {isOwner && <button onClick={delAlbum} className="btn-soft w-full !text-danger">অ্যালবাম মুছে ফেলুন</button>}

      {viewer !== null && <Viewer photos={photos} index={viewer} setIndex={setViewer} canDelete={canDelete} onDelete={delPhoto} onClose={() => setViewer(null)} />}
      {sheet && <MembersSheet album={album} members={members} isOwner={isOwner} onClose={() => setSheet(false)} onChanged={load} />}
    </div>
  )
}
