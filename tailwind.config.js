const c = (v) => `rgb(var(--${v}) / <alpha-value>)`

// হালকা (সাদা) মার্জিত থিম: সাদা সারফেস, গভীর এমারেল্ড অ্যাকসেন্ট
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: c('ink'), fg: c('fg'), surface: c('surface'), surface2: c('surface2'), mist: c('surface2'),
        brand: c('brand'), brandtext: c('brand-text'), coral: c('coral'), danger: c('danger'), success: c('success'), inverse: c('inverse'), bubble: c('bubble'),
      },
      fontFamily: { sans: ['Kalpurush', '"Hind Siliguri"', 'sans-serif'] },
      boxShadow: { soft: '0 1px 2px rgba(20,40,32,.05), 0 8px 24px -12px rgba(20,40,32,.18)' },
    },
  },
  plugins: [],
}
