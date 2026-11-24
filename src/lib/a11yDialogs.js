// সব মডাল/শিটের জন্য একই জায়গা থেকে কীবোর্ড-অ্যাক্সেসিবিলিটি:
//  • role="dialog" + aria-modal + নাম (শিটের শিরোনাম থেকে)
//  • Esc চাপলে সবচেয়ে ওপরের ডায়ালগ বন্ধ (ব্যাকড্রপে ক্লিকের মতোই, তাই "busy হলে বন্ধ হয় না" নিয়মও মানা হয়)
//  • খোলার সময় ফোকাস ভেতরে যায়, Tab ভেতরেই ঘোরে, বন্ধ হলে আগের জায়গায় ফোকাস ফেরে
// নিজে Esc সামলায় এমন কম্পোনেন্টে data-own-esc দিন — সেখানে এটি Esc ছোঁবে না।
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
const Z = /z-\[(\d+)\]/
let uid = 0

// ব্যাকড্রপ চেনা: fixed inset-0, z ≥ 60, গাঢ় ব্যাকগ্রাউন্ড (পূর্ণ-পর্দার পেজ/কল নয়)
export function isDialogBackdrop(el) {
  if (el.nodeType !== 1 || typeof el.className !== 'string') return false
  const c = el.className
  if (!c.includes('fixed') || !c.includes('inset-0') || !/bg-(ink|black)/.test(c)) return false
  const z = Z.exec(c)
  return !!z && Number(z[1]) >= 60
}

const stack = [] // { el, prev }
const visible = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length)

function register(el) {
  if (el.dataset.a11y) return
  el.dataset.a11y = '1'
  // ভেতরে আগেই role="dialog" থাকলে সেটাই আসল ডায়ালগ; না থাকলে ব্যাকড্রপকেই বানানো হয় (দুটো নেস্টেড ডায়ালগ নয়)
  const d = el.querySelector('[role=dialog]') || el
  if (!d.getAttribute('role')) d.setAttribute('role', 'dialog')
  d.setAttribute('aria-modal', 'true')
  if (!d.getAttribute('aria-labelledby') && !d.getAttribute('aria-label')) {
    const h = d.querySelector('h1,h2,h3,b,[class*="font-bold"]')
    if (h && h.textContent.trim()) { if (!h.id) h.id = 'dlg-h-' + ++uid; d.setAttribute('aria-labelledby', h.id) }
    else d.setAttribute('aria-label', 'ডায়ালগ')
  }
  const prev = document.activeElement
  stack.push({ el, prev })
  // ফোকাস ভেতরে: আগে থেকেই ভেতরে (autoFocus) থাকলে ছোঁয়া হয় না
  if (!el.contains(document.activeElement)) {
    const first = [...el.querySelectorAll(FOCUSABLE)].find(visible)
    if (first) first.focus({ preventScroll: true })
    else { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }) }
  }
}

function unregister(el) {
  const i = stack.findIndex((s) => s.el === el)
  if (i < 0) return
  const [{ prev }] = stack.splice(i, 1)
  if (i === stack.length && prev && prev.isConnected && !document.activeElement?.closest?.('[data-a11y]')) prev.focus?.({ preventScroll: true })
}

const top = () => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].el.isConnected) return stack[i].el; return null }

function onKey(e) {
  const el = top()
  if (!el) return
  if (e.key === 'Escape') {
    if (e.defaultPrevented || el.hasAttribute('data-own-esc') || el.querySelector('[data-own-esc]')) return
    e.preventDefault()
    el.click() // ব্যাকড্রপের onClick যা করে (বন্ধ, বা busy হলে কিছুই না)
  } else if (e.key === 'Tab') {
    const f = [...el.querySelectorAll(FOCUSABLE)].filter(visible)
    if (!f.length) { e.preventDefault(); return }
    const a = document.activeElement
    if (!el.contains(a)) { e.preventDefault(); f[0].focus(); return }
    if (e.shiftKey && a === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
    else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
  }
}

export function installDialogA11y() {
  if (typeof document === 'undefined' || window.__dlgA11y) return
  window.__dlgA11y = true
  const scan = (n) => {
    if (n.nodeType !== 1) return
    if (isDialogBackdrop(n)) register(n)
    n.querySelectorAll?.('[class*="inset-0"]').forEach((c) => isDialogBackdrop(c) && register(c))
  }
  new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach(scan)
      m.removedNodes.forEach((n) => {
        if (n.nodeType !== 1) return
        if (n.dataset?.a11y) unregister(n)
        n.querySelectorAll?.('[data-a11y]').forEach(unregister)
      })
    }
  }).observe(document.body, { childList: true, subtree: true })
  document.addEventListener('keydown', onKey)
}
