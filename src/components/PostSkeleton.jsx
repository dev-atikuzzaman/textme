export default function PostSkeleton() {
  return (
    <div className="animate-pulse rounded-[28px] bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-surface2" />
        <div className="flex-1 space-y-2"><div className="h-3.5 w-1/2 rounded-full bg-surface2" /><div className="h-3 w-1/3 rounded-full bg-surface2" /></div>
      </div>
      <div className="mt-4 space-y-2"><div className="h-3.5 w-full rounded-full bg-surface2" /><div className="h-3.5 w-5/6 rounded-full bg-surface2" /></div>
      <div className="mt-4 h-40 rounded-2xl bg-surface2" />
    </div>
  )
}
