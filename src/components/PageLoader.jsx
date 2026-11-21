// পেজ লোড হওয়ার সময় (React.lazy) নরম স্পিনার
export default function PageLoader() {
  return (
    <div className="grid place-items-center py-20" role="status" aria-label="লোড হচ্ছে">
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand/20 border-t-brand" />
    </div>
  )
}
