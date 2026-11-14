import { Link } from 'react-router-dom'

// পোস্টের লেখায় লিংক ক্লিকযোগ্য ও #হ্যাশট্যাগ সার্চে যায়
const RE = /(https?:\/\/[^\s]+|#[\p{L}\p{M}\p{N}_]+)/gu

export function linkify(text) {
  return text.split(RE).map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      const [, url, tail] = part.match(/^(.*?)([.,;:!?)]*)$/)
      return <span key={i}><a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline">{url}</a>{tail}</span>
    }
    if (part.startsWith('#')) {
      return <Link key={i} to={`/search?q=${encodeURIComponent(part)}`} className="font-semibold text-brand">{part}</Link>
    }
    return part
  })
}
