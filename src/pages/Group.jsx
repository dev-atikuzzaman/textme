import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Lock, Globe, Camera, UserPlus, LogOut, Crown, Pencil, Trash2, FileText, ImageIcon, X, Phone, Video, MoreVertical, Info, Users, Pin, PinOff, Archive, ArchiveRestore, LockOpen, ImagePlus } from 'lucide-react'
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
import AvatarViewer from '../components/AvatarViewer'
import CameraSheet from '../components/CameraSheet'
import UserCard from '../components/UserCard'
import PinPad from '../components/chat/PinPad'
import { useGroupCall, useGroupLive, MAX_GROUP_CALL } from '../context/GroupCall'
import { useChatPrefs } from '../context/ChatPrefs'

const PANELS = { posts: 'গ্রুপ পোস্ট', members: 'সদস্য' }

export default function Group() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const panel = PANELS[sp.get('tab')] ? sp.get('tab') : null // ডিফল্ট: সরাসরি চ্যাট; পোস্ট/সদস্য ⋮ মেনু থেকে
  const openPanel = (t) => setSp(t ? { tab: t } : {}, { replace: true })
  const [g, setG] = useState(undefined)
  const [members, setMembers] = useState([])
  const [who, setWho] = useState({})
  const [posts, setPosts] = useState(null)
  const [sheet, setSheet] = useState(null) // upload | note | add | edit
  const [menu, setMenu] = useState(null)   // সদস্যের অ্যাকশন মেনু
  const [camAv, setCamAv] = useState(false)
  const [coverView, setCoverView] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', about: '' })
  const fileRef = useRef(), coverRef = useRef()
  const [view, setView] = useState(false)   // গ্রুপ ছবি ফুল-স্ক্রিন
  const [card, setCard] = useState(null)    // ইউজার কার্ড (userId)
  const [pad, setPad] = useState(null)
  const gcall = useGroupCall()
  const cp = useChatPrefs()
  const live = useGroupLive(id)

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
  useEffect(() => { if (g) loadPosts() }, [me?.user_id, g?.id, loadPosts]) // eslint-disable-line  — সদস্য না হলেও, দেখার অনুমতি থাকলে (সদস্যের বন্ধু) ডাটাবেস পোস্ট দেয়

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
  const changeAvatar = (e) => { const f = e.target.files[0]; e.target.value = ''; doAvatar(f) }
  const doAvatar = async (f) => {
    if (!f) return
    setBusy(true)
    try {
      const url = await uploadImage(user.id, f)
      const { error } = await supabase.from('groups').update({ avatar_url: url }).eq('id', id)
      if (error) throw error
      loadMeta()
    } catch (er) { alert(er.message) } finally { setBusy(false) }
  }

  const removeAvatar = async () => {
    if (!confirm('গ্রুপের ছবি মুছবেন?')) return
    const { error } = await supabase.from('groups').update({ avatar_url: null }).eq('id', id)
    if (error) return alert(error.message)
    setView(false); loadMeta()
  }
  const changeCover = async (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/') || f.size > 8 * 1048576) return alert('৮MB-এর মধ্যে একটি ছবি দিন')
    setBusy(true)
    try {
      const url = await uploadImage(user.id, f, false)
      const { error } = await supabase.from('groups').update({ cover_url: url }).eq('id', id)
      if (error) throw error
      loadMeta()
    } catch (er) { alert(/cover_url/.test(er.message) ? 'update-17.sql চালানো হয়নি (cover_url কলাম নেই)' : er.message) } finally { setBusy(false) }
  }
  const removeCover = async () => { await supabase.from('groups').update({ cover_url: null }).eq('id', id); loadMeta() }

  if (g === undefined) return <p className="py-10 text-center text-fg/50">লোড হচ্ছে…</p>
  if (g === null) return (
    <div className="space-y-4 pt-2"><button onClick={() => nav('/groups')} className="grid h-11 w-11 place-items-center rounded-2xl bg-surface"><ArrowLeft size={20} /></button>
      <p className="py-10 text-center text-fg/60">গ্রুপটি পাওয়া যায়নি। এটি মুছে ফেলা হয়েছে, প্রাইভেট, অথবা এই গ্রুপের কোনো সদস্যের সাথে আপনার বন্ধুত্ব নেই — বন্ধু হলে গ্রুপের পোস্ট ও তথ্য দেখতে পাবেন।</p></div>
  )
  const gp = { id: g.id, full_name: g.name, avatar_url: g.avatar_url }
  const key = 'g:' + id
  const inCall = gcall?.inGroupCall === id
  const callGroup = { id: g.id, name: g.name, avatar_url: g.avatar_url }
  const startCall = (kind) => {
    if (live.length) gcall.joinGroupCall(callGroup, kind)   // চলমান কল থাকলে যোগ দেয়, নইলে নতুন কল শুরু
    else gcall.startGroupCall(callGroup, kind)
  }
  const doLock = () => {
    const go = () => { cp.lock(key); cp.unlockSession(key) }
    if (!cp.hasPin) setPad({ mode: 'set', then: go }); else go()
  }
  const MenuItem = ({ icon: I, label, onClick, danger }) => (
    <button onClick={() => { setSheet(null); onClick() }} className={`flex w-full items-center gap-4 rounded-2xl bg-surface2 p-4 font-semibold ${danger ? 'text-danger' : ''}`}><I size={20} />{label}</button>
  )
  const sub = live.length ? `🟢 ${live.length.toLocaleString('bn-BD')} জন কলে আছেন` : `${members.length.toLocaleString('bn-BD')} জন সদস্য`

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-forest sm:max-w-xl lg:left-64 lg:max-w-3xl">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={changeAvatar} />
      <input ref={coverRef} type="file" accept="image/*" hidden onChange={changeCover} />

      {/* হোয়াটসঅ্যাপের মতো উপরের বার: ← ছবি নাম | কল | ⋮ */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-fg/5 bg-surface px-1.5 pb-1 pt-[max(0.125rem,env(safe-area-inset-top))]">
        <button onClick={() => nav('/messages')} aria-label="পেছনে" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface2"><ArrowLeft size={20} /></button>
        <button onClick={() => setSheet('photo')} aria-label="গ্রুপের ছবি" className="shrink-0 rounded-full transition active:scale-95"><Avatar p={gp} size={36} /></button>
        <button onClick={() => setSheet('info')} className="min-w-0 flex-1 text-left leading-tight">
          <b className="flex items-center gap-1.5 truncate text-[0.95rem]">{cp.isLocked(key) && <Lock size={13} className="text-brand" />}<span className="truncate">{g.name}</span></b>
          <span className={`block truncate text-xs ${live.length ? 'font-semibold text-brand' : 'text-fg/55'}`}>{me ? sub : g.privacy === 'public' ? 'পাবলিক গ্রুপ' : 'প্রাইভেট গ্রুপ'}</span>
        </button>
        {me && (<>
          <button onClick={() => startCall('video')} disabled={inCall} aria-label="গ্রুপ ভিডিও কল" className="grid h-10 w-10 place-items-center rounded-full text-brand hover:bg-surface2 disabled:opacity-40"><Video size={21} /></button>
          <button onClick={() => startCall('audio')} disabled={inCall} aria-label="গ্রুপ অডিও কল" className="grid h-10 w-10 place-items-center rounded-full text-brand hover:bg-surface2 disabled:opacity-40"><Phone size={20} /></button>
        </>)}
        <button onClick={() => setSheet('menu')} aria-label="আরও অপশন" className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface2"><MoreVertical size={21} /></button>
      </div>

      <div className={`flex min-h-0 flex-1 flex-col gap-3 ${panel || !me ? 'overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'overflow-hidden'}`}>
      {me && live.length > 0 && !inCall && (
        <div className="flex w-full items-center gap-3 rounded-2xl bg-brand/10 p-3 text-brand">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-inverse"><Phone size={18} /></span>
          <span className="min-w-0 flex-1"><b className="block">চলমান গ্রুপ কল</b><span className="block truncate text-xs">{live.map((l) => l.name).slice(0, 3).join(', ')}{live.length > 3 ? ` +${live.length - 3}` : ''} কলে আছেন</span></span>
          <button onClick={() => startCall('audio')} className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-bold text-inverse">অডিও</button>
          <button onClick={() => startCall('video')} className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-bold text-inverse">ভিডিও</button>
        </div>
      )}

      {!me && (
        <div className="rounded-[28px] bg-surface p-6 text-center shadow-soft">
          {g.about && <p className="mb-3 text-sm text-fg/75">{g.about}</p>}
          {g.privacy === 'public' ? <button disabled={busy} onClick={join} className="btn-primary w-full">গ্রুপে যোগ দিন</button> : <p className="text-fg/65">এটি একটি প্রাইভেট গ্রুপ।</p>}
          <p className="mt-3 text-sm text-fg/55">{members.length.toLocaleString('bn-BD')} জন সদস্য • চ্যাটে অংশ নিতে গ্রুপে যোগ দিন।</p>
        </div>
      )}
      {!me && posts?.map((p) => <PostCard key={p.id} post={p} onChange={loadPosts} />)}

      {me && (<>
        {panel && (
          <div className="flex items-center gap-2">
            <button onClick={() => openPanel(null)} aria-label="চ্যাটে ফিরুন" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-soft"><ArrowLeft size={20} /></button>
            <h2 className="text-lg font-bold">{PANELS[panel]}</h2>
          </div>
        )}

        {!panel && <GroupChat groupId={id} who={who} onUser={setCard} />}

        {panel === 'posts' && (<>
          {g.cover_url && <img src={g.cover_url} alt="" className="h-36 w-full rounded-[28px] object-cover shadow-soft sm:h-48" />}
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

        {panel === 'members' && (
          <div className="space-y-2">
            {isAdmin && <button onClick={() => setSheet('add')} className="flex w-full items-center gap-3 rounded-3xl bg-surface p-3 text-left font-bold text-brand shadow-soft"><span className="grid h-11 w-11 place-items-center rounded-full bg-brand text-inverse"><UserPlus size={20} /></span>সদস্য যোগ করুন</button>}
            {members.map((m) => {
              const p = who[m.user_id]
              return (
                <div key={m.user_id} className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft">
                  <button onClick={() => setCard(m.user_id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><Avatar p={p} />
                    <span className="min-w-0 flex-1"><b className="block truncate">{p?.full_name}{m.user_id === user.id && ' (আপনি)'}</b>
                      {m.role === 'admin' && <span className="flex items-center gap-1 text-xs font-semibold text-brand"><Crown size={12} />অ্যাডমিন</span>}</span></button>
                  {isAdmin && m.user_id !== user.id && <button onClick={() => setMenu(m)} className="rounded-full bg-surface2 px-3 py-1.5 text-xs font-bold">ম্যানেজ</button>}
                </div>
              )
            })}
          </div>
        )}
      </>)}

      </div>

      {card && <UserCard userId={card} onClose={() => setCard(null)} />}
      {view && g.avatar_url && <AvatarViewer p={{ ...gp, username: 'group' }} own={isAdmin} busy={busy} onClose={() => setView(false)} onChange={() => fileRef.current.click()} onRemove={removeAvatar} />}
      {coverView && g.cover_url && <AvatarViewer p={{ avatar_url: g.cover_url, full_name: g.name, username: 'cover' }} title="কভার ফটো" own={isAdmin} busy={busy} onClose={() => setCoverView(false)} onChange={() => { setCoverView(false); coverRef.current.click() }} onRemove={() => { setCoverView(false); removeCover() }} />}
      {pad && <PinPad mode={pad.mode} onClose={() => setPad(null)} onSubmit={async (p) => { if (pad.mode === 'set') { await cp.setPin(p); const f = pad.then; setPad(null); f(); return true } if (!(await cp.verify(p))) return false; const f = pad.then; setPad(null); f(); return true }} />}

      {/* আইকনে চাপলে: হোয়াটসঅ্যাপের মতো ছবি দেখা / বদলানো */}
      {sheet === 'photo' && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={() => setSheet(null)}>
          <div className="w-full max-w-md space-y-3 rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { if (g.avatar_url) { setSheet(null); setView(true) } }} className="mx-auto block rounded-full"><Avatar p={gp} size={110} /></button>
            <h3 className="text-center text-lg font-bold">{g.name}</h3>
            {isAdmin ? (<>
              <button disabled={busy} onClick={() => { setSheet(null); fileRef.current.click() }} className="flex w-full items-center gap-3 rounded-2xl bg-surface2 p-4 font-semibold"><ImageIcon size={20} className="text-brand" />গ্যালারি থেকে ছবি বাছুন</button>
              <button disabled={busy} onClick={() => { setSheet(null); setCamAv(true) }} className="flex w-full items-center gap-3 rounded-2xl bg-surface2 p-4 font-semibold"><Camera size={20} className="text-brand" />ক্যামেরায় ছবি তুলুন</button>
              {g.avatar_url && <button disabled={busy} onClick={() => { setSheet(null); removeAvatar() }} className="flex w-full items-center gap-3 rounded-2xl bg-surface2 p-4 font-semibold text-danger"><Trash2 size={20} />ছবি মুছুন</button>}
            </>) : <p className="text-center text-sm text-fg/60">শুধু গ্রুপ অ্যাডমিন গ্রুপের ছবি বদলাতে পারেন।</p>}
            <button onClick={() => setSheet('info')} className="btn-soft w-full">গ্রুপ ইনফো</button>
          </div>
        </div>
      )}
      {camAv && <CameraSheet mode="photo" onClose={() => setCamAv(false)} onCapture={doAvatar} />}

      {/* ⋮ মেনু */}
      {sheet === 'menu' && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-start sm:justify-end sm:p-6" onClick={() => setSheet(null)}>
          <div className="max-h-[88dvh] w-full max-w-md space-y-1.5 overflow-y-auto rounded-t-[32px] bg-surface p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:w-80 sm:rounded-[28px] sm:shadow-soft" onClick={(e) => e.stopPropagation()}>
            <MenuItem icon={Info} label="গ্রুপ ইনফো" onClick={() => setSheet('info')} />
            {me && <MenuItem icon={ImageIcon} label="গ্রুপ পোস্ট" onClick={() => openPanel('posts')} />}
            {me && <MenuItem icon={Users} label="সদস্য দেখুন" onClick={() => openPanel('members')} />}
            {isAdmin && <MenuItem icon={UserPlus} label="সদস্য যোগ করুন" onClick={() => setSheet('add')} />}
            {isAdmin && <MenuItem icon={Pencil} label="নাম ও বিবরণ এডিট" onClick={() => setSheet('edit')} />}
            {isAdmin && <MenuItem icon={Camera} label="গ্রুপের ছবি বদলান" onClick={() => fileRef.current.click()} />}
            {isAdmin && <MenuItem icon={ImagePlus} label="কভার ফটো বদলান" onClick={() => coverRef.current.click()} />}
            {me && !cp.isLocked(key) && <MenuItem icon={cp.isPinned(key) ? PinOff : Pin} label={cp.isPinned(key) ? 'পিন সরান' : 'চ্যাট পিন করুন'} onClick={() => { if (!cp.isPinned(key) && cp.pinnedCount >= 3) return alert('সর্বোচ্চ ৩টি চ্যাট পিন করা যায়'); cp.setPref(key, { pinned: !cp.isPinned(key) }) }} />}
            {me && !cp.isLocked(key) && <MenuItem icon={cp.isArchived(key) ? ArchiveRestore : Archive} label={cp.isArchived(key) ? 'আর্কাইভ থেকে বের করুন' : 'চ্যাট আর্কাইভ করুন'} onClick={() => cp.setPref(key, { archived: !cp.isArchived(key) })} />}
            {me && <MenuItem icon={cp.isLocked(key) ? LockOpen : Lock} label={cp.isLocked(key) ? 'চ্যাট লক খুলুন' : 'চ্যাট লক করুন'} onClick={() => (cp.isLocked(key) ? cp.unlock(key) : doLock())} />}
            {me && <MenuItem icon={LogOut} label="গ্রুপ ছাড়ুন" onClick={leave} danger />}
            {isAdmin && <MenuItem icon={Trash2} label="গ্রুপ মুছে ফেলুন" onClick={del} danger />}
          </div>
        </div>
      )}

      {/* গ্রুপ ইনফো: কভার + ছবি + তথ্য */}
      {sheet === 'info' && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center" onClick={() => setSheet(null)}>
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-surface pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-36 bg-gradient-to-br from-brand to-coral" onClick={() => (g.cover_url ? (setSheet(null), setCoverView(true)) : isAdmin && coverRef.current.click())}>
              {g.cover_url && <img src={g.cover_url} alt="" className="h-full w-full cursor-pointer object-cover" />}
              <button onClick={(e) => { e.stopPropagation(); setSheet(null) }} aria-label="বন্ধ" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white"><X size={18} /></button>
              {isAdmin && (
                <div className="absolute bottom-2 right-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {g.cover_url && <button onClick={removeCover} className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold text-white">কভার মুছুন</button>}
                  <button onClick={() => coverRef.current.click()} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold text-white"><Camera size={14} />কভার ফটো</button>
                </div>
              )}
            </div>
            <div className="-mt-12 px-5 text-center">
              <button onClick={() => setSheet('photo')} className="relative mx-auto block rounded-full ring-4 ring-surface">
                <Avatar p={gp} size={96} />
                {isAdmin && <span onClick={(e) => { e.stopPropagation(); fileRef.current.click() }} className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-brand text-inverse"><Camera size={15} /></span>}
              </button>
              <h2 className="mt-2 text-2xl font-bold">{g.name}</h2>
              <p className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-fg/60">{g.privacy === 'public' ? <Globe size={14} /> : <Lock size={14} />}{g.privacy === 'public' ? 'পাবলিক গ্রুপ' : 'প্রাইভেট গ্রুপ'} • {members.length.toLocaleString('bn-BD')} জন সদস্য</p>
              {g.about && <p className="mx-auto mt-3 max-w-sm text-sm text-fg/80">{g.about}</p>}
              {me && (
                <div className="mt-4 grid grid-cols-4 items-start gap-1">
                  {[[Phone, 'অডিও কল', () => startCall('audio')], [Video, 'ভিডিও কল', () => startCall('video')], ...(isAdmin ? [[UserPlus, 'যোগ করুন', () => setSheet('add')], [Pencil, 'এডিট', () => setSheet('edit')]] : [])].map(([I, l, fn]) => (
                    <button key={l} onClick={() => { setSheet(null); fn() }} className="flex w-full flex-col items-center gap-1.5"><span className="grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand"><I size={21} /></span><span className="text-xs font-semibold">{l}</span></button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-fg/45">গ্রুপ কলে সর্বোচ্চ {MAX_GROUP_CALL} জন একসাথে থাকতে পারেন</p>
            </div>
            <div className="mt-4 space-y-1 px-4">
              <p className="px-1 text-sm font-bold text-fg/60">সদস্য ({members.length.toLocaleString('bn-BD')})</p>
              {members.slice(0, 8).map((m) => { const p = who[m.user_id]; return (
                <button key={m.user_id} onClick={() => { setSheet(null); setCard(m.user_id) }} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface2"><Avatar p={p} size={40} /><span className="flex-1 truncate font-semibold">{p?.full_name}{m.user_id === user.id && ' (আপনি)'}</span>{m.role === 'admin' && <span className="text-xs font-bold text-brand">অ্যাডমিন</span>}</button>
              ) })}
              {members.length > 8 && <button onClick={() => { setSheet(null); openPanel('members') }} className="w-full py-2 text-sm font-bold text-brand">সবাইকে দেখুন</button>}
              {me && <button onClick={() => { setSheet(null); leave() }} className="btn-soft mt-2 w-full !text-danger"><LogOut size={17} />গ্রুপ ছাড়ুন</button>}
              {isAdmin && <button onClick={() => { setSheet(null); del() }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3 font-bold text-white active:scale-95"><Trash2 size={17} />গ্রুপ মুছে ফেলুন</button>}
            </div>
          </div>
        </div>
      )}

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
