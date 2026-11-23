import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../context/Auth'
import { toast, errMsg } from './ui'
import { tableMissing } from './family'

// আমি কাকে কী বলে ডাকি: { [otherId]: 'mama' }
export function useRelations() {
  const { user } = useAuth()
  const [map, setMap] = useState({})
  const [ready, setReady] = useState(false)
  const [missing, setMissing] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('family_relations').select('other_id, relation')
    if (error) setMissing(tableMissing(error))
    else setMap(Object.fromEntries((data || []).map((r) => [r.other_id, r.relation])))
    setReady(true)
  }, [])
  useEffect(() => {
    load()
    window.addEventListener('apon-relations', load)
    return () => window.removeEventListener('apon-relations', load)
  }, [load])

  // relation = null দিলে ট্যাগ সরে যায়
  const set = async (otherId, relation) => {
    const { error } = relation
      ? await supabase.from('family_relations').upsert({ user_id: user.id, other_id: otherId, relation })
      : await supabase.from('family_relations').delete().eq('user_id', user.id).eq('other_id', otherId)
    if (error) { toast.error(tableMissing(error) ? 'চালু হয়নি — update-23.sql চালানো হয়নি' : errMsg(error)); return false }
    window.dispatchEvent(new Event('apon-relations'))
    return true
  }
  return { map, ready, missing, set, reload: load }
}
