import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ভেন্ডর লাইব্রেরি আলাদা chunk: অ্যাপ কোড বদলালে ব্রাউজার react/supabase আবার ডাউনলোড করে না (ক্যাশ থেকে আসে)
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
