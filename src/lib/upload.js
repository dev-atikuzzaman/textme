import * as tus from 'tus-js-client'
import { supabase } from './supabase'

export const MAX_UPLOAD = 50 * 1024 * 1024
const SMALL = 6 * 1024 * 1024

export function friendlyUploadError(e) {
  const m = String(e?.message || e)
  if (/bucket not found/i.test(m)) return 'স্টোরেজে "media" বাকেট নেই — fix-upload.sql চালান'
  if (/row-level security|violates|not allowed|unauthorized|\b40[13]\b/i.test(m)) return 'আপলোডের অনুমতি নেই — fix-upload.sql চালিয়ে লগ-আউট করে আবার লগ-ইন করুন। (' + m.slice(0, 120) + ')'
  if (/exceeded the maximum|too large|\b413\b/i.test(m)) return 'ফাইল অনেক বড় (সর্বোচ্চ ৫০MB)'
  if (/failed to fetch|network|timeout|offline/i.test(m)) return 'ইন্টারনেট সংযোগে সমস্যা — আবার চেষ্টা করুন'
  return m
}

// ছোট ফাইল সরাসরি, ৬MB-এর বড় ভিডিও টুকরো টুকরো (resumable) আপলোড — ধীর নেটওয়ার্কে বেশি নির্ভরযোগ্য
export async function uploadToStorage(bucket, path, file, onProgress) {
  const contentType = file.type || 'application/octet-stream'
  if (file.size <= SMALL) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType })
    if (error) throw error
    onProgress?.(100)
    return
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('লগ-ইনের মেয়াদ শেষ — আবার লগ-ইন করুন')
  await new Promise((resolve, reject) => {
    new tus.Upload(file, {
      endpoint: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: SMALL,
      metadata: { bucketName: bucket, objectName: path, contentType, cacheControl: '3600' },
      onError: reject,
      onProgress: (sent, total) => onProgress?.(Math.round((sent * 100) / total)),
      onSuccess: () => resolve(),
    }).start()
  })
}
