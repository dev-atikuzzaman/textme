import { FileText, FileSpreadsheet, FileArchive, File as FileIcon, Presentation, Download } from '../lib/icons'
import { fmtSize } from '../lib/media'

const KINDS = {
  pdf: [FileText, 'bg-danger/15 text-danger'],
  doc: [FileText, 'bg-sky-400/15 text-sky-400'], docx: [FileText, 'bg-sky-400/15 text-sky-400'], txt: [FileText, 'bg-sky-400/15 text-sky-400'],
  xls: [FileSpreadsheet, 'bg-success/15 text-success'], xlsx: [FileSpreadsheet, 'bg-success/15 text-success'], csv: [FileSpreadsheet, 'bg-success/15 text-success'],
  ppt: [Presentation, 'bg-orange-400/15 text-orange-400'], pptx: [Presentation, 'bg-orange-400/15 text-orange-400'],
  zip: [FileArchive, 'bg-amber-400/15 text-amber-400'], rar: [FileArchive, 'bg-amber-400/15 text-amber-400'], '7z': [FileArchive, 'bg-amber-400/15 text-amber-400'],
}

export default function FileCard({ url, name, size, className = '' }) {
  const ext = (name || '').split('.').pop().toLowerCase()
  const [Icon, tone] = KINDS[ext] || [FileIcon, 'bg-brand/15 text-brand']
  const href = `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(name || 'file')}`
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`flex items-center gap-3 rounded-2xl bg-surface2 p-3 ring-1 ring-fg/10 transition active:scale-[.98] ${className}`}>
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={24} /></span>
      <span className="min-w-0 flex-1">
        <b className="block truncate">{name || 'ফাইল'}</b>
        <span className="text-xs text-fg/65">{ext ? ext.toUpperCase() : 'FILE'}{size ? ` • ${fmtSize(size)}` : ''}</span>
      </span>
      <Download size={20} className="shrink-0 text-brand" />
    </a>
  )
}
