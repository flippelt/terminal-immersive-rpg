import { useEffect, useRef, useState } from 'react'

// Streams text one char at a time. `text` is the final string,
// `speed` is ms per character (with a tiny jitter for organic feel).
export function useTypewriter(text, { speed = 12, enabled = true, onDone } = {}) {
  const [out, setOut] = useState(enabled ? '' : text)
  const [done, setDone] = useState(!enabled)
  const cbRef = useRef(onDone)
  cbRef.current = onDone

  useEffect(() => {
    if (!enabled) {
      setOut(text)
      setDone(true)
      cbRef.current?.()
      return
    }
    let i = 0
    let timer
    const tick = () => {
      i += 1
      setOut(text.slice(0, i))
      if (i >= text.length) {
        setDone(true)
        cbRef.current?.()
        return
      }
      const jitter = Math.random() * 6 - 3
      timer = setTimeout(tick, Math.max(2, speed + jitter))
    }
    timer = setTimeout(tick, speed)
    return () => clearTimeout(timer)
  }, [text, speed, enabled])

  return { out, done }
}
