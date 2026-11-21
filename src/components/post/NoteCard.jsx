import { FileText } from '../../lib/icons'
import SmartImg from '../SmartImg'

export const readMins = (t = '') => Math.max(1, Math.round(t.trim().split(/\s+/).length / 150))

// ফিডে নোটের কার্ড: কভার ছবি, শিরোনাম, সারাংশ
export default function NoteCard({ post, onOpen }) {
  return (
    <button onClick={onOpen} className="mt-3 block w-full overflow-hidden rounded-2xl bg-surface2 text-left transition active:scale-[0.99]">
      {post.media_url && <SmartImg src={post.media_url} alt="" className="h-44 w-full object-cover" />}
      <div className="p-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand"><FileText size={13} />নোট • {readMins(post.content).toLocaleString('bn-BD')} মিনিটের পড়া</span>
        <h3 className="mt-2 text-xl font-extrabold leading-snug">{post.title}</h3>
        <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap break-words text-fg/70">{post.content}</p>
        <span className="mt-3 inline-block text-sm font-bold text-brand">সম্পূর্ণ নোট পড়ুন →</span>
      </div>
    </button>
  )
}
