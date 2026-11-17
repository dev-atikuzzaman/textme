import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { LogOut, Camera, KeyRound, X, Pencil, PowerOff, Trash2, ShieldOff, Settings2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { SELECT_POST } from '../lib/constants'
import { resizeSquare, mediaPathFromUrl } from '../lib/media'
import Avatar from '../components/Avatar'
import PostCard from '../components/PostCard'
import PasswordSheet from '../components/PasswordSheet'
import AvatarViewer from '../components/AvatarViewer'
import ProfileEditSheet from '../components/ProfileEditSheet'
import PersonActions from '../components/PersonActions'
import { withContext } from '../lib/context'
import { useRelation } from '../lib/useRelation'
import { Lock } from 'lucide-react'

export default function Profile() {
  const { id } = useParams()
  const { user, profile: me, refreshProfile } = useAuth()
  const uid = id || user.id
  const own = uid === user.id
  const [p, setP] = useState(own ? me : null)
  const [posts, setPosts] = useState([])
  const [sheet, setSheet] = useState(null) // view | edit | password | account | blocked | delete
  const [blocked, setBlocked] = useState([])
  const [confirmTxt, setConfirmTxt] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef()
  const rel = useRelation(own ? null : uid)
  const canSee = own || rel.state === 'friends' // বন্ধু না হলে অন্যের তথ্য/পোস্ট/ভিডিও দেখা যায় না

  const load = useCallback(async () => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setP(prof)
    if (!own && !canSee) { setPosts([]); return }
    const { data } = await supabase.from('posts').select(SELECT_POST).eq('user_id', uid).order('pinned_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
    setPosts(await withContext(data))
  }, [uid, own, canSee]) // eslint-disable-line
  useEffect(() => { load() }, [load])

  const loadBlocked = async () => {
    const { data: b } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id)
    const ids = (b || []).map((x) => x.blocked_id)
    if (!ids.length) return setBlocked([])
    const { data } = await supabase.from('profiles').select('id,full_name,username,avatar_url').in('id', ids)
    setBlocked(data || [])
  }
  const unblock = async (bid) => { await supabase.rpc('unblock_user', { p_user: bid }); loadBlocked() }
  const deactivate = async () => {
    if (!confirm('একাউন্ট ডিঅ্যাক্টিভ করবেন? কেউ আপনাকে খুঁজে পাবে না, পোস্ট লুকানো থাকবে। আবার লগ-ইন করলে চালু করতে পারবেন।')) return
    setBusy(true)
    const { error } = await supabase.rpc('deactivate_my_account')
    setBusy(false)
    if (error) return alert(error.message)
    await refreshProfile()
  }
  const deleteAccount = async () => {
    setBusy(true)
    const old = mediaPathFromUrl(p.avatar_url)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) { setBusy(false); return alert(error.message) }
    if (old) supabase.storage.from('media').remove([old]).catch(() => {})
    await supabase.auth.signOut()
  }

  const changeAvatar = async (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const blob = await resizeSquare(f)
      const path = `${user.id}/avatar-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
      const old = mediaPathFromUrl(p.avatar_url)
      const { error: e2 } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
      if (e2) throw e2
      if (old) supabase.storage.from('media').remove([old])
      await refreshProfile(); await load(); setSheet(null)
    } catch (er) { alert(er.message) } finally { setBusy(false) }
  }

  const removeAvatar = async () => {
    if (!confirm('প্রোফাইল ছবি মুছে ফেলবেন?')) return
    setBusy(true)
    const old = mediaPathFromUrl(p.avatar_url)
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    if (error) alert(error.message)
    else { if (old) supabase.storage.from('media').remove([old]); await refreshProfile(); await load(); setSheet(null) }
    setBusy(false)
  }

  if (!p) return <p className="py-10 text-center text-fg/50">লোড হচ্ছে…</p>
  const Row = ({ onClick, Icon, children, danger }) => (
    <button onClick={onClick} disabled={busy} className={`flex w-full items-center gap-3 rounded-2xl bg-surface2 p-4 text-left font-semibold disabled:opacity-50 ${danger ? 'text-danger' : ''}`}><Icon size={20} />{children}</button>
  )
  const openAvatar = () => (p.avatar_url ? setSheet('view') : own && fileRef.current.click())

  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-[32px] bg-gradient-to-br from-brand to-coral p-6 text-center text-inverse shadow-soft">
        <div className="relative mx-auto w-fit">
          <button onClick={openAvatar} aria-label="ছবি দেখুন" className="block rounded-full ring-4 ring-white/40 transition active:scale-95"><Avatar p={p} size={104} /></button>
          {own && <button onClick={() => fileRef.current.click()} aria-label="ছবি বদলান" disabled={busy} className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-white text-brand shadow-soft"><Camera size={18} /></button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={changeAvatar} />
        <h2 className="mt-3 text-2xl font-extrabold">{p.full_name}</h2>
        <p className="text-inverse/80">@{p.username}</p>
        {canSee && p.bio && <p className="mt-2 text-inverse/90">{p.bio}</p>}
      </div>

      {own ? (
        <div className="space-y-3">
          <div className="flex gap-3">
            <button onClick={() => setSheet('edit')} className="btn-primary flex-1"><Pencil size={17} />প্রোফাইল এডিট</button>
            <button onClick={() => setSheet('password')} className="btn-soft flex-1 bg-surface shadow-soft"><KeyRound size={18} />পাসওয়ার্ড</button>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSheet('account')} className="btn-soft flex-1 bg-surface shadow-soft"><Settings2 size={18} />একাউন্ট সেটিংস</button>
            <button onClick={() => supabase.auth.signOut()} className="btn-soft flex-1 bg-surface shadow-soft !text-danger"><LogOut size={18} />লগ-আউট</button>
          </div>
        </div>
      ) : <div className="rounded-3xl bg-surface p-4 shadow-soft"><PersonActions p={p} size="lg" onChange={rel.reload} /></div>}

      {!canSee ? (
        <div className="rounded-3xl bg-surface p-8 text-center shadow-soft">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand"><Lock size={24} /></span>
          <p className="mt-3 font-bold">এই প্রোফাইল প্রাইভেট</p>
          <p className="mt-1 text-sm text-fg/60">{p.full_name}-এর তথ্য, পোস্ট ও ভিডিও দেখতে আগে বন্ধু হতে হবে।</p>
        </div>
      ) : (<>
      <h3 className="px-1 font-bold">পোস্ট ও ভিডিও</h3>
      {posts.length === 0 && <p className="py-6 text-center text-fg/60">দেখানোর মতো কিছু নেই।</p>}
      {posts.map((x) => <PostCard key={x.id} post={x} onChange={load} />)}
      </>)}

      {sheet === 'view' && p.avatar_url && <AvatarViewer p={p} own={own} busy={busy} onClose={() => setSheet(null)} onChange={() => fileRef.current.click()} onRemove={removeAvatar} />}
      {sheet === 'edit' && <ProfileEditSheet profile={p} onClose={() => setSheet(null)} onSaved={() => { refreshProfile(); load() }} />}
      {sheet === 'password' && <PasswordSheet onClose={() => setSheet(null)} />}

      {(sheet === 'account' || sheet === 'blocked' || sheet === 'delete') && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center" onClick={() => setSheet(null)}>
          <div className="max-h-[90dvh] w-full max-w-md space-y-2 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold">{sheet === 'blocked' ? 'ব্লক করা ব্যবহারকারী' : sheet === 'delete' ? 'একাউন্ট স্থায়ীভাবে ডিলিট' : 'একাউন্ট সেটিংস'}</h2>
              <button onClick={() => setSheet(null)} className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
            </div>
            {sheet === 'account' && (<>
              <Row Icon={ShieldOff} onClick={() => { loadBlocked(); setSheet('blocked') }}>ব্লক করা ব্যবহারকারী</Row>
              <Row Icon={PowerOff} onClick={deactivate}>একাউন্ট ডিঅ্যাক্টিভ করুন (সাময়িক)</Row>
              <Row Icon={Trash2} danger onClick={() => { setConfirmTxt(''); setSheet('delete') }}>একাউন্ট ডিলিট করুন (স্থায়ী)</Row>
              <p className="px-1 pt-1 text-xs text-fg/55">ডিঅ্যাক্টিভ: আবার লগ-ইন করলেই চালু হয়। ডিলিট: পোস্ট, মেসেজ, বন্ধুত্ব সব চিরতরে মুছে যায়, ফেরানো যায় না।</p>
            </>)}
            {sheet === 'blocked' && (<>
              {blocked.length === 0 && <p className="py-6 text-center text-fg/55">কাউকে ব্লক করা নেই।</p>}
              {blocked.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-surface2 p-3"><Avatar p={b} /><div className="min-w-0 flex-1"><p className="truncate font-bold">{b.full_name}</p><p className="truncate text-xs text-fg/50">@{b.username}</p></div>
                  <button onClick={() => unblock(b.id)} className="btn-soft bg-surface !px-3 !py-1.5 text-sm">আনব্লক</button></div>
              ))}
            </>)}
            {sheet === 'delete' && (<>
              <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">এটি ফেরানো যাবে না। আপনার প্রোফাইল, পোস্ট, মেসেজ, কমেন্ট, বন্ধুত্ব সব মুছে যাবে।</p>
              <p className="text-sm text-fg/70">নিশ্চিত করতে নিচে <b>DELETE</b> লিখুন:</p>
              <input className="input" value={confirmTxt} onChange={(e) => setConfirmTxt(e.target.value)} placeholder="DELETE" autoCapitalize="characters" />
              <button disabled={busy || confirmTxt.trim().toUpperCase() !== 'DELETE'} onClick={deleteAccount} className="btn-soft w-full bg-danger !text-white disabled:opacity-40"><Trash2 size={18} />{busy ? 'মুছছি…' : 'স্থায়ীভাবে ডিলিট করুন'}</button>
            </>)}
          </div>
        </div>
      )}
    </div>
  )
}
