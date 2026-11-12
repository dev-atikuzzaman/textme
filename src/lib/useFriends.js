import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../context/Auth'

export function useFriends() {
  const { user } = useAuth()
  const [rels, setRels] = useState([])
  const [people, setPeople] = useState({})
  const reload = useCallback(async () => {
    const me = user.id
    const { data: f } = await supabase.from('friendships').select('*')
      .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
    setRels(f || [])
    const ids = [...new Set((f || []).flatMap((r) => [r.requester_id, r.addressee_id]))].filter((i) => i !== me)
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('*').in('id', ids)
      setPeople(Object.fromEntries((p || []).map((x) => [x.id, x])))
    }
  }, [user.id])
  useEffect(() => { reload() }, [reload])
  const other = (r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id)
  return {
    rels, people, reload, other,
    friends: rels.filter((r) => r.status === 'accepted'),
    incoming: rels.filter((r) => r.status === 'pending' && r.addressee_id === user.id),
  }
}
