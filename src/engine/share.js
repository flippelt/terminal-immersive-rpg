// Encode a scenario bundle into a URL-safe string so a GM can share a whole
// custom campaign as a single link — no hosting, no CORS. The payload rides
// in the `?scenario64=` query param and is decoded back on load.

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function base64ToUtf8(b64) {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const toUrlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromUrlSafe = (s) => s.replace(/-/g, '+').replace(/_/g, '/')

export function encodeBundle(bundle) {
  return toUrlSafe(utf8ToBase64(JSON.stringify(bundle)))
}

export function decodeBundle(token) {
  return JSON.parse(base64ToUtf8(fromUrlSafe(token)))
}

// Build a shareable URL for the current page that loads `bundle` on open.
export function shareUrl(bundle, location = window.location) {
  const base = `${location.origin}${location.pathname}`
  return `${base}?scenario64=${encodeBundle(bundle)}`
}
