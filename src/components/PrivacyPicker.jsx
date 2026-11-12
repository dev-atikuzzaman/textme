import { PRIVACY } from '../lib/constants'
export default function PrivacyPicker({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {PRIVACY.map(({ id, label, Icon }) => (
        <button type="button" key={id} onClick={() => onChange(id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-semibold transition ${value === id ? 'bg-brand text-white' : 'bg-mist text-ink/70'}`}>
          <Icon size={16} />{label}
        </button>
      ))}
    </div>
  )
}
