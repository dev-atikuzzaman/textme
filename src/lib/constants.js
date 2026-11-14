import { Lock, Users, Globe } from 'lucide-react'
export const PRIVACY = [
  { id: 'only_me', label: 'শুধু আমি', Icon: Lock },
  { id: 'friends', label: 'বন্ধুরা', Icon: Users },
  { id: 'public', label: 'পাবলিক', Icon: Globe },
]
export const CATEGORIES = ['বিনোদন', 'ধর্ম', 'রান্না', 'ভ্রমণ', 'শিক্ষা', 'প্রযুক্তি', 'খেলা', 'পরিবার']
export const fmt = (d) => new Date(d).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })
export const SELECT_POST = '*, profiles!posts_user_id_fkey(id,username,full_name,avatar_url), likes(user_id,type), comments(count)'

export const REACTIONS = [
  { id: 'like', emoji: '👍', label: 'লাইক', color: 'text-blue-600' },
  { id: 'love', emoji: '❤️', label: 'ভালোবাসা', color: 'text-rose-500' },
  { id: 'haha', emoji: '😂', label: 'হাহা', color: 'text-amber-500' },
  { id: 'wow', emoji: '😮', label: 'ওয়াও', color: 'text-amber-500' },
  { id: 'sad', emoji: '😢', label: 'দুঃখ', color: 'text-amber-500' },
  { id: 'angry', emoji: '😡', label: 'রাগ', color: 'text-orange-600' },
]
