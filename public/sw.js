// Minimal offline cache for the terminal prop: cache-first with a
// background refresh (stale-while-revalidate), so after one online visit
// the app — code, fonts, scenarios — runs with no network at the table.
// Asset filenames are content-hashed by Vite, so caching whatever is
// fetched is safe; a new build simply fetches and caches new names.
const CACHE = 'itrpg-cache-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(req)
      if (cached) {
        // Refresh in the background for next time; ignore network errors.
        fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone())
          })
          .catch(() => {})
        return cached
      }
      try {
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      } catch (err) {
        // Offline navigation falls back to the cached app shell.
        if (req.mode === 'navigate') {
          const shell =
            (await cache.match(self.registration.scope)) ||
            (await cache.match(self.registration.scope + 'index.html'))
          if (shell) return shell
        }
        throw err
      }
    })()
  )
})
