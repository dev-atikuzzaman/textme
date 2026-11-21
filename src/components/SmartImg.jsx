import { useEffect, useRef, useState } from 'react'

// ছবি লোডের সময় ঝিলিমিলি (shimmer) প্লেসহোল্ডার, লোড হলে নরমভাবে ফুটে ওঠে।
// reserve = লোডের আগে জায়গা ধরে রাখার ক্লাস (যেমন "min-h-[14rem]"), যাতে স্ক্রল লাফিয়ে না ওঠে।
export default function SmartImg({ className = '', reserve = '', onLoad, onError, loading = 'lazy', alt = '', ...p }) {
  const [st, setSt] = useState('load') // load | ok | err
  const ref = useRef()
  useEffect(() => { setSt('load') }, [p.src])
  useEffect(() => { const i = ref.current; if (i?.complete && i.naturalWidth) setSt('ok') }, [p.src]) // ক্যাশ থেকে এলে সাথে সাথে
  return (
    <img ref={ref} alt={alt} loading={loading} decoding="async" {...p}
      onLoad={(e) => { setSt('ok'); onLoad?.(e) }}
      onError={(e) => { setSt('err'); onError?.(e) }}
      className={`${className} ${st === 'load' ? `skeleton ${reserve}` : st === 'err' ? `bg-surface2 ${reserve}` : 'img-in'}`} />
  )
}
