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

// পাবলিক URL থেকে media বাকেটের ফাইল পাথ (Google ছবির URL হলে null)
export const mediaPathFromUrl = (url) => {
  const m = url?.split('/object/public/media/')[1]
  return m ? decodeURIComponent(m.split('?')[0]) : null
}
