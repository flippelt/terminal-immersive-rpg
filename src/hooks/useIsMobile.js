import { useEffect, useState } from 'react'

// True when the viewport matches the project's mobile breakpoint
// (kept in lockstep with the `@media (max-width: 640px)` rules in crt.css).
const QUERY = '(max-width: 640px)'

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.(QUERY).matches ?? false
  })
  useEffect(() => {
    const mql = window.matchMedia?.(QUERY)
    if (!mql) return undefined
    const onChange = (e) => setMobile(e.matches)
    mql.addEventListener?.('change', onChange) ?? mql.addListener?.(onChange)
    return () => {
      mql.removeEventListener?.('change', onChange) ?? mql.removeListener?.(onChange)
    }
  }, [])
  return mobile
}
