export const safeName = (n) => n.replace(/[^\w.\-]/g, '_').slice(-80)
export const fmtSize = (b = 0) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
export const mmss = (s = 0) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function downloadVcf({ name, phone }) {
  const v = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${phone}\nEND:VCARD`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([v], { type: 'text/vcard' }))
  a.download = `${safeName(name)}.vcf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// প্রোফাইল ছবি: মাঝখান থেকে স্কয়ার ক্রপ করে ছোট করে (ডেটা কম লাগে)
export async function resizeSquare(file, size = 512) {
  const bmp = await createImageBitmap(file)
  const s = Math.min(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = c.height = size
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size)
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88))
}

// আপলোডের আগে ছবি ছোট করা: সর্বোচ্চ ১৬০০px, WebP (না পারলে JPEG)। ধীর নেটে আপলোড/লোড অনেক দ্রুত হয়।
// GIF/SVG/ছোট ফাইল (২৫০KB-র কম) বা ছোট না হলে আসল ফাইলই ফেরত দেয়; কোনো সমস্যা হলেও আসল ফাইলই যায়।
export async function compressImage(file, { max = 1600, quality = 0.82 } = {}) {
  try {
    if (!file || !/^image\/(jpeg|png|webp|bmp|heic|heif)$/i.test(file.type)) return file
    if (file.size < 250 * 1024) return file
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d').drawImage(bmp, 0, 0, w, h); bmp.close?.()
    const toBlob = (t, q) => new Promise((r) => c.toBlob(r, t, q))
    let blob = await toBlob('image/webp', quality), ext = 'webp'
    if (!blob || blob.type !== 'image/webp') { // কিছু ব্রাউজার (iPhone) WebP বানাতে পারে না
      if (file.type === 'image/png') return file // স্বচ্ছতা নষ্ট না করার জন্য
      blob = await toBlob('image/jpeg', quality); ext = 'jpg'
    }
    if (!blob || blob.size >= file.size * 0.95) return file
    return new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type })
  } catch { return file }
}

// পাবলিক URL থেকে media বাকেটের ফাইল পাথ (Google ছবির URL হলে null)
export const mediaPathFromUrl = (url) => {
  const m = url?.split('/object/public/media/')[1]
  return m ? decodeURIComponent(m.split('?')[0]) : null
}

export const extOf = (f) => {
  const e = (f.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
  return e || (f.type.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '').slice(0, 5)
}
