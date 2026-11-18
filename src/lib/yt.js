// ইউটিউব লিংক চেনা ও এমবেড URL
const RE = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i
export const ytId = (s = '') => { const m = String(s).trim().match(RE); if (m) return m[1]; return /^[\w-]{11}$/.test(String(s).trim()) ? String(s).trim() : null }
export const findYt = (text = '') => ytId(text.match(/\S+/g)?.find((w) => RE.test(w)) || '')
export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
export const ytEmbed = (id, auto = true) => `https://www.youtube-nocookie.com/embed/${id}?${auto ? 'autoplay=1&' : ''}rel=0&playsinline=1&modestbranding=1`
export const ytKey = import.meta.env.VITE_YT_API_KEY || ''
export async function ytMeta(id) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`)
    if (!r.ok) throw new Error()
    const j = await r.json(); return { id, title: j.title, channel: j.author_name }
  } catch { return { id, title: 'ইউটিউব ভিডিও', channel: '' } }
}
export async function ytSearch(q) {
  const u = q
    ? `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=24&safeSearch=moderate&q=${encodeURIComponent(q)}&key=${ytKey}`
    : `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=BD&maxResults=24&key=${ytKey}`
  const r = await fetch(u); const j = await r.json()
  if (j.error) throw new Error(j.error.message)
  return (j.items || []).map((i) => ({ id: i.id?.videoId || i.id, title: i.snippet.title, channel: i.snippet.channelTitle }))
}
