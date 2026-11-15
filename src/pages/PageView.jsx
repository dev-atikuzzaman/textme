import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, ImagePlus, FileText, ImageIcon, Pencil, Trash2, BellRing, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { SELECT_POST } from '../lib/constants'
import { withContext } from '../lib/context'
import { uploadImage } from '../lib/uploadImage'
import Avatar from '../components/Avatar'
import PostCard from '../components/PostCard'
import PostSkeleton from '../components/PostSkeleton'
import UploadSheet from '../components/UploadSheet'
import NoteSheet from '../components/NoteSheet'
import PageSheet from '../components/groups/PageSheet'

export default function PageView() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [pg, setPg] = useState(undefined)
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(false)
  const [posts, setPosts] = useState(null)
  const [sheet, setSheet] = useState(null) // upload | note | edit
  const [busy, setBusy] = useState(false)
  const av = useRef(), cv = useRef()
  const own = pg?.owner_id === user.id

  const load = useCallback(async () => {
    const { data } = await supabase.from('pages').select('*').eq('id', id).maybeSingle()
    setPg(data)
    if (!data) return
    const [{ count }, { data: f }] = await Promise.all([
      supabase.from('page_follows').select('user_id', { count: 'exact', head: true }).eq('page_id', id),
      supabase.from('page_follows').select('user_id').eq('page_id', id).eq('user_id', user.id),
    ])
    setFollowers(count || 0); setFollowing(!!f?.length)
  }, [id, user.id])
  const loadPosts = useCallback(async () => {
    const { data } = await supabase.from('posts').select(SELECT_POST).eq('page_id', id).order('created_at', { ascending: false }).limit(40)
    setPosts(await withContext(data))
  }, [id])
  useEffect(() => { load(); loadPosts() }, [load, loadPosts])

  const follow = async () => {
    setBusy(true)
    const r = following
      ? await supabase.from('page_follows').delete().match({ page_id: id, user_id: user.id })
      : await supabase.from('page_follows').insert({ page_id: id, user_id: user.id })
    setBusy(false)
    if (r.error) return alert(r.error.message)
    load()
  }
  const upload = (field, square) => async (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const url = await uploadImage(user.id, f, square)
      const { error } = await supabase.from('pages').update({ [field]: url }).eq('id', id)
      if (error) throw error
      load()
    } catch (er) { alert(er.message) } finally { setBusy(false) }
  }
  const del = async () => {
    if (!confirm('পেজটি স্থায়ীভাবে মুছে ফেলবেন? পেজের সব পোস্ট চলে যাবে।')) return
    const { error } = await supabase.from('pages').delete().eq('id', id)
    if (error) return alert(error.message)
    nav('/groups?tab=pages')
  }

  if (pg === undefined) return <p className="py-10 text-center text-fg/50">লোড হচ্ছে…</p>
  if (pg === null) return (
    <div className="space-y-4 pt-2"><button onClick={() => nav(-1)} className="grid h-11 w-11 place-items-center rounded-2xl bg-surface"><ArrowLeft size={20} /></button>
      <p className="py-10 text-center text-fg/60">পেজটি পাওয়া যায়নি বা মুছে ফেলা হয়েছে।</p></div>
  )
  const pp = { full_name: pg.name, avatar_url: pg.avatar_url }

  return (
    <div className="space-y-4 pt-2">
      <button onClick={() => nav(-1)} aria-label="পেছনে" className="grid h-11 w-11 place-items-center rounded-2xl bg-surface"><ArrowLeft size={20} /></button>

      <div className="overflow-hidden rounded-[32px] bg-surface shadow-soft">
        <div className="relative h-36 bg-gradient-to-br from-brand to-coral sm:h-44">
          {pg.cover_url && <img src={pg.cover_url} alt="" className="h-full w-full object-cover" />}
          {own && <button disabled={busy} onClick={() => cv.current.click()} className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white"><ImagePlus size={14} />কভার</button>}
          <input ref={cv} type="file" accept="image/*" hidden onChange={upload('cover_url', false)} />
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end gap-3">
            <button disabled={!own || busy} onClick={() => av.current.click()} className="relative shrink-0 rounded-full ring-4 ring-surface">
              <Avatar p={pp} size={84} />
              {own && <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-surface2 text-brand"><Camera size={14} /></span>}
            </button>
            <input ref={av} type="file" accept="image/*" hidden onChange={upload('avatar_url', true)} />
          </div>
          <h2 className="mt-3 text-2xl font-extrabold">{pg.name}</h2>
          <p className="text-sm text-fg/60">{pg.category} • {followers.toLocaleString('bn-BD')} জন ফলোয়ার</p>
          {pg.about && <p className="mt-2 whitespace-pre-wrap text-fg/80">{pg.about}</p>}
          <div className="mt-4 flex gap-2">
            {!own && (
              <button disabled={busy} onClick={follow} className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 font-bold transition active:scale-95 ${following ? 'bg-surface2' : 'bg-gradient-to-r from-brand to-coral text-inverse'}`}>
                {following ? <><Check size={18} />ফলো করছেন</> : <><BellRing size={18} />ফলো করুন</>}
              </button>
            )}
            {own && <button onClick={() => setSheet('edit')} className="btn-soft flex-1"><Pencil size={17} />এডিট</button>}
            {own && <button onClick={del} aria-label="পেজ মুছুন" className="btn-soft !px-4 !text-danger"><Trash2 size={18} /></button>}
          </div>
        </div>
      </div>

      {own && (
        <div className="rounded-[28px] bg-surface p-4 shadow-soft">
          <p className="mb-2 text-sm font-bold text-fg/60">পেজ হিসেবে পোস্ট করুন</p>
          <div className="flex">
            <button onClick={() => setSheet('upload')} className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-2 text-sm font-bold text-fg/70"><ImageIcon size={19} className="text-brand" />পোস্ট/ছবি/ভিডিও</button>
            <button onClick={() => setSheet('note')} className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-2 text-sm font-bold text-fg/70"><FileText size={19} className="text-violet-400" />নোট</button>
          </div>
        </div>
      )}

      {posts === null && <PostSkeleton />}
      {posts?.length === 0 && <p className="py-8 text-center text-fg/55">পেজে এখনও কোনো পোস্ট নেই।</p>}
      {posts?.map((p) => <PostCard key={p.id} post={p} onChange={loadPosts} />)}

      {sheet === 'upload' && <UploadSheet kind="post" pageId={id} onClose={() => setSheet(null)} onDone={loadPosts} />}
      {sheet === 'note' && <NoteSheet pageId={id} onClose={() => setSheet(null)} onDone={loadPosts} />}
      {sheet === 'edit' && <PageSheet page={pg} onClose={() => setSheet(null)} onDone={load} />}
    </div>
  )
}
