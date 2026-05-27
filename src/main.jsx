import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/base.css'
import './styles/crt.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Register the service worker for offline use (production builds only, so
// dev never serves stale assets). Scoped to the build base so it works
// under GitHub Pages' subpath as well as the domain root.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {})
  })
}
