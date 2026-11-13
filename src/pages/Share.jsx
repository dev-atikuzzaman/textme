import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { parseFacebook } from '../lib/youtube'

// ফোনের Share মেনু থেকে "আপন" বেছে নিলে এখানে আসে (Android-এ ইনস্টল করা অ্যাপে)
export default function Share() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [sp] = useSearchParams()
  const [msg, setMsg] = useState('সেভ হচ্ছে…')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      const link = parseFacebook(`${sp.get('url') || ''} ${sp.get('text') || ''} ${sp.get('title') || ''}`)
      if (!link) return setMsg('এটি ফেসবুকের লিংক মনে হচ্ছে না। ইউটিউব শর্টস নিজে থেকেই আসে।')
      const { error } = await supabase.from('external_videos')
        .insert({ source: 'facebook', external_id: link, url: link, feeds: ['shared'], added_by: user.id })
      if (error && error.code !== '23505') return setMsg(error.message)
      nav('/reels?tab=fb', { replace: true })
    })()
  }, [])

  return <p className="mt-20 text-center text-ink/70">{msg}</p>
}
