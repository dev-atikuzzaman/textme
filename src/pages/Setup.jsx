export default function Setup() {
  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-3xl font-extrabold">Supabase কানেক্ট করুন</h1>
      <p className="text-ink/70">অ্যাপটি চালাতে দুটি Environment Variable লাগবে:</p>
      <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-sm text-white">{`VITE_SUPABASE_URL\nVITE_SUPABASE_ANON_KEY`}</pre>
      <ol className="list-decimal space-y-2 pl-5 text-ink/80">
        <li>Supabase → Project Settings → API থেকে URL ও anon key কপি করুন</li>
        <li>Vercel → Project → Settings → Environment Variables-এ দুটো যোগ করুন</li>
        <li>Deployments → Redeploy দিন</li>
      </ol>
      <p className="text-sm text-ink/60">লোকালে চালাতে প্রজেক্টের রুটে .env ফাইলে একই দুটি লাইন দিন।</p>
    </div>
  )
}
