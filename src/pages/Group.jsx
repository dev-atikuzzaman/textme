import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Lock, Globe, Camera, UserPlus, LogOut, Crown, Pencil, Trash2, FileText, ImageIcon, X } from 'lucide-react'
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
import GroupChat from '../components/groups/GroupChat'
import AddMembersSheet from '../components/groups/AddMembersSheet'

const TABS = [['posts', 'পোস্ট'], ['chat', 'চ্যাট'], ['members', 'সদস্য']]

export default function Group() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const tab = TABS.some(([t]) => t === sp.get('tab')) ? sp.get('tab') : 'posts'
  const [g, setG] = useState(undefined)
  const [members, setMembers] = useState([])
  const [who, setWho] = useState({})
  const [posts, setPosts] = useState(null)
  const [sheet, setSheet] = useState(null) // upload | note | add | edit
  const [menu, setMenu] = useState(null)   // সদস্যের অ্যাকশন মেনু
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', about: '' })
  const fileRef = useRef()

  const me = members.find((m) => m.user_id === user.id)
  const isAdmin = me?.role === 'admin'

  const loadMeta = useCallback(async () => {
    const { data: grp } = await supabase.from('groups').select('*').eq('id', id).maybeSingle()
    setG(grp)
    if (!grp) return
    setForm({ name: grp.name, about: grp.about || '' })
    const { data: ms } = await supabase.from('group_members').select('user_id,role,joined_at').eq('group_id', id).order('joined_at')
    setMembers(ms || [])
    const ids = (ms || []).map((m) => m.user_id)
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('id,full_name,username,avatar_url').in('id', ids)
      setWho(Object.fromEntries((ps || []).map((p) => [p.id, p])))
    }
  }, [id])
  const loadPosts = useCallback(async () => {
    const { data } = await supabase.from('posts').select(SELECT_POST).eq('group_id', id).order('created_at', { ascending: false }).limit(40)
    setPosts(await withContext(data))
  }, [id])
  useEffect(() => { loadMeta() }, [loadMeta])
  useEffect(() => { if (me) loadPosts(); else if (g) setPosts([]) }, [me?.user_id, g?.id, loadPosts]) // eslint-disable-line

  const rpc = async (fn, args, after) => {
    setBusy(true)
    const { error } = await supabase.rpc(fn, args)
    setBusy(false)
    if (error) return alert(error.message)
    after ? after() : loadMeta()
  }
  const join = () => rpc('join_group', { p_group: id })
  const leave = () => confirm('গ্রুপ ছেড়ে চলে যাবেন?') && rpc('leave_group', { p_group: id }, () => nav('/groups'))
  const del = async () => {
    if (!confirm('গ্রুপটি স্থায়ীভাবে মুছে ফেলবেন? সব পোস্ট ও মেসেজ চলে যাবে।')) return
    const { error } = await supabase.from('groups').delete().eq('id', id)
    if (error) return alert(error.message)
    nav('/groups')
  }
  const saveInfo = async () => {
    const { error } = await supabase.from('groups').update({ name: form.name.trim() || g.name, about: form.about.trim() || null }).eq('id', id)
    if (error) return alert(error.message)
    setSheet(null); loadMeta()
  }
  const changeAvatar = async (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const url = await uploadImage(user.id, f)
      const { error } = await supabase.from('groups').update({ avatar_url: url }).eq('id', id)
      if (error) throw error
      loadMeta()
    } catch (er) { alert(er.message) } finally { setBusy(false) }
  }

  if (g === undefined) return <p className="py-10 text-center text-fg/50">লোড হচ্ছে…</p>
  if (g === null) return (
    <div className="space-y-4 pt-2"><button onClick={() => nav('/groups')} className="grid h-11 w-11 place-items-center rounded-2xl bg-surface"><ArrowLeft size={20} /></button>
      <p className="py-10 text-center text-fg/60">গ্রুপটি পাওয়া যায়নি, মুছে ফেলা হয়েছে, অথবা এটি প্রাইভেট।</p></div>
  )
  const gp = { id: g.id, full_name: g.name, avatar_url: g.avatar_url }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => nav('/groups')} aria-label="পেছনে" className="grid h-11 w-11 place-items-center rounded-2xl bg-surface"><ArrowLeft size={20} /></button>
        <h2 className="min-w-0 flex-1 truncate text-xl font-extrabold">{g.name}</h2>
      </div>

      <div className="rounded-[32px] bg-gradient-to-br from-brand to-coral p-5 text-inverse shadow-soft">
        <div className="flex items-center gap-4">
          <button disabled={!isAdmin || busy} onClick={() => fileRef.current.click()} className="relative shrink-0">
            <Avatar p={gp} size={72} />
            {isAdmin && <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-surface text-brand"><Camera size={15} /></span>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={changeAvatar} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-inverse/80">{g.privacy === 'public' ? <Globe size={14} /> : <Lock size={14} />}{g.privacy === 'public' ? 'পাবলিক গ্রুপ' : 'প্রাইভেট গ্রুপ'} • {members.length.toLocaleString('bn-BD')} জন সদস্য</p>
            {g.about && <p className="mt-1 line-clamp-3 text-inverse/90">{g.about}</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!me && g.privacy === 'public' && <button disabled={busy} onClick={join} className="btn-soft flex-1">গ্রুপে যোগ দিন</button>}
          {me && isAdmin && <button onClick={() => setSheet('add')} className="btn-soft flex-1 whitespace-nowrap !px-2 text-[13px]"><UserPlus size={16} />যোগ করুন</button>}
          {me && isAdmin && <button onClick={() => setSheet('edit')} className="btn-soft flex-1 whitespace-nowrap !px-2 text-[13px]"><Pencil size={15} />এডিট</button>}
          {me && <button onClick={leave} className="btn-soft flex-1 whitespace-nowrap !px-2 text-[13px] !text-danger"><LogOut size={15} />ছাড়ুন</button>}
        </div>
      </div>

      {!me ? (
        <p className="rounded-3xl bg-surface p-6 text-center text-fg/65">পোস্ট, চ্যাট ও সদস্যদের দেখতে গ্রুপে যোগ দিন।</p>
      ) : (<>
        <div className="flex gap-2">
          {TABS.map(([t, label]) => (
            <button key={t} onClick={() => setSp({ tab: t }, { replace: true })}
              className={`flex-1 rounded-full py-2.5 text-sm font-bold transition active:scale-95 ${tab === t ? 'bg-gradient-to-r from-brand to-coral text-inverse' : 'bg-surface text-fg/70 shadow-soft'}`}>{label}</button>
          ))}
        </div>

        {tab === 'posts' && (<>
          <div className="rounded-[28px] bg-surface p-4 shadow-soft">
            <button onClick={() => setSheet('upload')} className="flex w-full items-center gap-3 text-left"><Avatar p={who[user.id]} /><span className="flex-1 text-fg/50">গ্রুপে কিছু লিখুন…</span></button>
            <div className="mt-3 flex border-t border-fg/5 pt-2">
              <button onClick={() => setSheet('upload')} className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-2 text-sm font-bold text-fg/70"><ImageIcon size={19} className="text-brand" />ছবি/ভিডিও</button>
              <button onClick={() => setSheet('note')} className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-2 text-sm font-bold text-fg/70"><FileText size={19} className="text-violet-400" />নোট</button>
            </div>
          </div>
          {posts === null && <PostSkeleton />}
          {posts?.length === 0 && <p className="py-8 text-center text-fg/55">গ্রুপে এখনও কোনো পোস্ট নেই।</p>}
          {posts?.map((p) => <PostCard key={p.id} post={p} onChange={loadPosts} />)}
        </>)}

        {tab === 'chat' && <GroupChat groupId={id} who={who} />}

        {tab === 'members' && (
          <div className="space-y-2">
            {members.map((m) => {
              const p = who[m.user_id]
              return (
                <div key={m.user_id} className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft">
                  <Link to={`/profile/${m.user_id}`}><Avatar p={p} /></Link>
                  <div className="min-w-0 flex-1"><p className="truncate font-bold">{p?.full_name}{m.user_id === user.id && ' (আপনি)'}</p>
                    {m.role === 'admin' && <p className="flex items-center gap-1 text-xs font-semibold text-brand"><Crown size={12} />অ্যাডমিন</p>}</div>
                  {isAdmin && m.user_id !== user.id && <button onClick={() => setMenu(m)} className="rounded-full bg-surface2 px-3 py-1.5 text-xs font-bold">ম্যানেজ</button>}
                </div>
              )
            })}
            {isAdmin && <button onClick={del} className="btn-soft mt-3 w-full !text-danger"><Trash2 size={17} />গ্রুপটি মুছে ফেলুন</button>}
          </div>
        )}
      </>)}

      {sheet === 'upload' && <UploadSheet kind="post" groupId={id} onClose={() => setSheet(null)} onDone={loadPosts} />}
      {sheet === 'note' && <NoteSheet groupId={id} onClose={() => setSheet(null)} onDone={loadPosts} />}
      {sheet === 'add' && <AddMembersSheet groupId={id} memberIds={members.map((m) => m.user_id)} onClose={() => setSheet(null)} onDone={loadMeta} />}
      {sheet === 'edit' && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={() => setSheet(null)}>
          <div className="w-full max-w-md space-y-3 rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">গ্রুপ এডিট</h2><button onClick={() => setSheet(null)} className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button></div>
            <input className="input" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <textarea className="input min-h-[90px]" placeholder="গ্রুপ সম্পর্কে" value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
            <button onClick={saveInfo} className="btn-primary w-full">সেভ করুন</button>
          </div>
        </div>
      )}
      {menu && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={() => setMenu(null)}>
          <div className="w-full max-w-md space-y-2 rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-bold">{who[menu.user_id]?.full_name}</h2>
            <button onClick={() => { const m = menu; setMenu(null); rpc('set_group_admin', { p_group: id, p_user: m.user_id, p_admin: m.role !== 'admin' }) }} className="flex w-full items-center gap-3 rounded-2xl bg-surface2 p-4 font-semibold"><Crown size={20} />{menu.role === 'admin' ? 'অ্যাডমিন থেকে সরান' : 'অ্যাডমিন বানান'}</button>
            <button onClick={() => { const m = menu; setMenu(null); confirm('গ্রুপ থেকে বাদ দেবেন?') && rpc('remove_group_member', { p_group: id, p_user: m.user_id }) }} className="flex w-full items-center gap-3 rounded-2xl bg-surface2 p-4 font-semibold text-danger"><LogOut size={20} />গ্রুপ থেকে বাদ দিন</button>
          </div>
        </div>
      )}
    </div>
  )
}
