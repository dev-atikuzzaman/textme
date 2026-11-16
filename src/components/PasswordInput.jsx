import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// পাসওয়ার্ড ঘর + ডানদিকে দেখান/লুকান টগল
export default function PasswordInput({ className = '', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`input !pr-12 ${className}`} />
      <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)} aria-label={show ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
        className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-fg/50 hover:bg-fg/5">
        {show ? <EyeOff size={19} /> : <Eye size={19} />}
      </button>
    </div>
  )
}
