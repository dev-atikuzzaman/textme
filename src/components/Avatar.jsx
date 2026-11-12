export default function Avatar({ p, size = 44 }) {
  const s = { width: size, height: size }
  if (p?.avatar_url) return <img src={p.avatar_url} alt="" style={s} className="rounded-full object-cover shrink-0" />
  return (
    <div style={{ ...s, fontSize: size / 2.4 }} className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-coral font-bold text-white">
      {(p?.full_name || '?').trim().charAt(0)}
    </div>
  )
}
