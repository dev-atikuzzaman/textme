import { useRef } from 'react'

// লং-প্রেস (মোবাইলে চেপে ধরা / কম্পিউটারে রাইট-ক্লিক)। ব্যবহার:  const lp = useLongPress(onLong);  <div {...lp(item)}>
export function useLongPress(onLong, ms = 450) {
  const t = useRef(), start = useRef()
  const clear = () => { clearTimeout(t.current); t.current = null }
  return (arg) => ({
    onPointerDown: (e) => { if (e.button > 0) return; start.current = [e.clientX, e.clientY]; clear(); t.current = setTimeout(() => { t.current = null; onLong(arg) }, ms) },
    onPointerMove: (e) => { if (t.current && start.current && Math.hypot(e.clientX - start.current[0], e.clientY - start.current[1]) > 10) clear() },
    onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear,
    onContextMenu: (e) => { e.preventDefault(); clear(); onLong(arg) },
  })
}
