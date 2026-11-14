import { supabase } from './supabase'

export async function startYoutubeConnect() {
  const { data, error } = await supabase.functions.invoke('yt-connect')
  if (error) {
    let detail = error.message
    if (error.name === 'FunctionsFetchError') {
      throw new Error('yt-connect ফাংশনে পৌঁছানো যায়নি — ফাংশনটি ডিপ্লয় করা আছে কিনা, নাম ঠিক আছে কিনা এবং ইন্টারনেট দেখুন')
    }
    try {
      const b = await error.context.json()
      detail = `${error.context.status} ${b.error || b.message || JSON.stringify(b)}`
    } catch { /* রেসপন্স পড়া গেল না */ }
    throw new Error(detail)
  }
  if (!data?.url) throw new Error('লিংক পাওয়া যায়নি')
  window.location.href = data.url
}

export const syncMyShorts = () => supabase.functions.invoke('sync-shorts', { body: { parts: ['mine'] } })
export const disconnectYoutube = () => supabase.rpc('yt_disconnect')
