import { supabase } from './supabase'
import { resizeSquare, extOf, compressImage } from './media'

// গ্রুপ/পেজের ছবি আপলোড (media বাকেট, নিজের ফোল্ডারে)
export async function uploadImage(userId, file, square = true) {
  const cv = square ? null : await compressImage(file)
  const blob = square ? await resizeSquare(file) : cv
  const path = `${userId}/${square ? 'av' : 'cv'}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.${square ? 'jpg' : extOf(cv)}`
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: square ? 'image/jpeg' : cv.type })
  if (error) throw error
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}
