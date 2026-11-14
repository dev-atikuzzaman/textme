export default function Avatar({ p, size = 44, online }) {
  const s = { width: size, height: size }
  const img = p?.avatar_url
    ? <img src={p.avatar_url} alt="" style={s} className="rounded-full object-cover shrink-0" />
    : (
      <div style={{ ...s, fontSize: size / 2.4 }} className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-coral font-bold text-inverse">
        {(p?.full_name || '?').trim().charAt(0)}
      </div>
    )
  if (!online) return img
  // সবুজ ডট = এখন অনলাইন (online={true} দিলে দেখায়)
  return (
    <span className="relative inline-block shrink-0 leading-none">
      {img}
      <span style={{ width: Math.max(10, size / 4.2), height: Math.max(10, size / 4.2) }} className="absolute bottom-0 right-0 rounded-full bg-success ring-2 ring-surface" />
    </span>
  )
}
