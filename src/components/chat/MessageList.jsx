import Bubble from './Bubble'

// মেসেজের তালিকা: ওপরে "আগের মেসেজ", প্রতিটি বাবল, ব্যর্থ মেসেজে "আবার পাঠান / মুছুন"
export default function MessageList({ scrollerRef, endRef, shown, myId, urls, votes, hl, lp, hasOlder, loadingOlder, onLoadOlder, onVote, onOpenImage, onRetry, onDiscard }) {
  return (
    <div ref={scrollerRef} className="flex-1 space-y-2 overflow-y-auto p-4">
      {hasOlder && (
        <div className="flex justify-center">
          <button onClick={onLoadOlder} disabled={loadingOlder} className="rounded-full bg-surface2 px-4 py-1.5 text-xs font-semibold text-brand disabled:opacity-60">
            {loadingOlder ? 'আনা হচ্ছে…' : '↑ আগের মেসেজ দেখুন'}
          </button>
        </div>
      )}
      {shown.map((m) => (
        <div key={m.id} id={`m-${m.id}`} {...lp(m)} className={`select-none rounded-2xl transition ${hl === m.id ? 'ring-2 ring-coral/60' : ''}`}>
          <Bubble m={m} mine={m.sender_id === myId} myId={myId} url={urls[m.media_path]} votes={votes[m.id]} onVote={onVote} onOpenImage={onOpenImage} />
          {m._st === 'failed' && (
            <div className="mt-1 flex items-center justify-end gap-3 pr-1 text-xs font-semibold">
              <span className="text-danger">পাঠানো যায়নি</span>
              <button onClick={() => onRetry(m)} className="text-brand">আবার পাঠান</button>
              <button onClick={() => onDiscard(m)} className="text-fg/65">মুছুন</button>
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
