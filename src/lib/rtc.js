// STUN ফ্রি। মোবাইল ডেটা/কড়া নেটওয়ার্কে কল ধরতে TURN সার্ভার লাগে (ঐচ্ছিক env)
const turn = import.meta.env.VITE_TURN_URL
export const ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ...(turn ? [{ urls: turn.split(','), username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL }] : []),
  ],
}

