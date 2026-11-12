import { Lock, Users, Globe } from 'lucide-react'
export const PRIVACY = [
  { id: 'only_me', label: 'শুধু আমি', Icon: Lock },
  { id: 'friends', label: 'বন্ধুরা', Icon: Users },
  { id: 'public', label: 'পাবলিক', Icon: Globe },
]
export const CATEGORIES = ['বিনোদন', 'ধর্ম', 'রান্না', 'ভ্রমণ', 'শিক্ষা', 'প্রযুক্তি', 'খেলা', 'পরিবার']
export const fmt = (d) => new Date(d).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })
export const SELECT_POST = '*, profiles(id,username,full_name,avatar_url), likes(user_id), comments(count)'
