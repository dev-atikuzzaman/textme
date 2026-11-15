import { supabase } from './supabase'
import { resizeSquare, extOf } from './media'

// গ্রুপ/পেজের ছবি আপলোড (media বাকেট, নিজের ফোল্ডারে)
export async function uploadImage(userId, file, square = true) {
  const blob = square ? await resizeSquare(file) : file
  const path = `${userId}/${square ? 'av' : 'cv'}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.${square ? 'jpg' : extOf(file)}`
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: square ? 'image/jpeg' : file.type })
  if (error) throw error
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}
