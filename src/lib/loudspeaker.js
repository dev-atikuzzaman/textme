import { useEffect, useRef } from 'react'

// লাউডস্পিকার মোড: অপর পক্ষের আওয়াজ Web Audio দিয়ে বাড়িয়ে (গেইন ×2.6 + লিমিটার) শোনায়।
// সম্ভব হলে ডিভাইসের "speaker" আউটপুটও বেছে নেয় (setSinkId সমর্থিত হলে)।
// on=true হলে রিমোট মিডিয়া এলিমেন্ট (data-remote-audio) মিউট থাকে, নইলে আওয়াজ দুবার আসত।
export function useLoudspeaker(on, streams) {
  const st = useRef({ ctx: null, nodes: new Map() })
  const key = streams.map((s) => s?.id).filter(Boolean).join(',')

  useEffect(() => {
    const S = st.current
    const els = () => document.querySelectorAll('[data-remote-audio]')
    if (!on) {
      S.nodes.forEach((n) => { try { n.src.disconnect() } catch {} }); S.nodes.clear()
      S.ctx?.close().catch(() => {}); S.ctx = null
      els().forEach((e) => { e.muted = false })
      return
    }
    try {
      if (!S.ctx) {
        S.ctx = new (window.AudioContext || window.webkitAudioContext)()
        S.gain = S.ctx.createGain(); S.gain.gain.value = 2.6
        S.lim = S.ctx.createDynamicsCompressor()
        S.lim.threshold.value = -8; S.lim.knee.value = 6; S.lim.ratio.value = 12
        S.gain.connect(S.lim); S.lim.connect(S.ctx.destination)
        // স্পিকার আউটপুট খোঁজা (সব ব্রাউজারে থাকে না)
        navigator.mediaDevices?.enumerateDevices?.().then(async (ds) => {
          const sp = ds.find((d) => d.kind === 'audiooutput' && /speaker/i.test(d.label))
          if (sp && S.ctx?.setSinkId) await S.ctx.setSinkId(sp.deviceId).catch(() => {})
        }).catch(() => {})
      }
      S.ctx.resume?.()
      const ids = new Set(streams.map((s) => s?.id))
      S.nodes.forEach((n, id) => { if (!ids.has(id)) { try { n.src.disconnect() } catch {} S.nodes.delete(id) } })
      streams.forEach((s) => {
        if (!s || S.nodes.has(s.id) || !s.getAudioTracks().length) return
        const src = S.ctx.createMediaStreamSource(s); src.connect(S.gain); S.nodes.set(s.id, { src })
      })
      els().forEach((e) => { e.muted = true })
    } catch (e) { console.warn('লাউডস্পিকার চালু হয়নি', e) }
  }, [on, key]) // eslint-disable-line
  useEffect(() => () => { const S = st.current; S.ctx?.close().catch(() => {}); S.ctx = null; document.querySelectorAll('[data-remote-audio]').forEach((e) => { e.muted = false }) }, [])
}
