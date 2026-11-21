import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary'
import { applyPrefs, watchSystemTheme } from './lib/prefs'

applyPrefs(); watchSystemTheme() // থিম ও লেখার সাইজ ("অটো" থিমে ফোনের সেটিং বদলালে সাথে সাথে বদলায়)

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><BrowserRouter><App /></BrowserRouter></ErrorBoundary>
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
