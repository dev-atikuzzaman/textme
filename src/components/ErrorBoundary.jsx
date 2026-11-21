import { Component } from 'react'

// নতুন ভার্সন ডিপ্লয়ের পর পুরনো ট্যাবে চাঙ্ক ফাইল না পেলে একবার নিজে থেকে রিলোড করি
export const isChunkError = (e) => /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(String(e?.message || e))
const FLAG = 'apon-chunk-reload'
export const reloadOnceForChunk = () => {
  try {
    if (sessionStorage.getItem(FLAG)) return false
    sessionStorage.setItem(FLAG, '1'); location.reload(); return true
  } catch { return false }
}

// কোনো পেজে কোড ভেঙে গেলে পুরো অ্যাপ সাদা হয়ে যাওয়ার বদলে বন্ধুত্বপূর্ণ স্ক্রিন দেখায়।
// resetKey বদলালে (যেমন অন্য পেজে গেলে) নিজে থেকে ঠিক হয়ে যায়।
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) {
    console.error(error)
    if (isChunkError(error)) reloadOnceForChunk()
  }
  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }
  render() {
    if (!this.state.error) {
      try { sessionStorage.removeItem(FLAG) } catch { /* ignore */ }
      return this.props.children
    }
    const chunk = isChunkError(this.state.error)
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-surface2 text-4xl" aria-hidden="true">{chunk ? '🔄' : '😕'}</span>
        <h2 className="text-xl font-extrabold">{chunk ? 'নতুন সংস্করণ এসেছে' : 'কিছু একটা গোলমাল হয়েছে'}</h2>
        <p className="text-fg/65">{chunk ? 'পেজটি একবার রিফ্রেশ করলেই নতুনটা চালু হবে।' : 'চিন্তার কিছু নেই, আপনার তথ্য ঠিক আছে। পেজটি আবার লোড করে দেখুন।'}</p>
        <div className="flex w-full gap-3">
          <button onClick={() => location.reload()} className="btn-primary flex-1">আবার লোড করুন</button>
          <button onClick={() => { location.href = '/' }} className="btn-soft flex-1">হোমে যান</button>
        </div>
      </div>
    )
  }
}
