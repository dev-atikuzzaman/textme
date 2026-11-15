const c = (v) => `rgb(var(--${v}) / <alpha-value>)`

// Premium Forest থিম (PetroHub-এর মতো): গাঢ় সবুজ গ্রেডিয়েন্ট, টিল + সোনালি অ্যাকসেন্ট
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: c('ink'), fg: c('fg'), surface: c('surface'), surface2: c('surface2'), mist: c('surface2'),
        brand: c('brand'), coral: c('coral'), danger: c('danger'), success: c('success'), inverse: c('inverse'), bubble: c('bubble'),
      },
      fontFamily: { sans: ['"Hind Siliguri"', '"Plus Jakarta Sans"', 'sans-serif'] },
      boxShadow: { soft: '0 0 0 1px rgba(110,210,165,.14), 0 14px 34px -14px rgba(0,0,0,.6)' },
    },
  },
  plugins: [],
}
