import { useEffect, useRef, useState } from 'react'

const BAR_WIDTH = 28
const SPINNER = ['|', '/', '-', '\\']

// Centered popup that runs a progress bar (crack/decrypt) for `duration`
// ms and calls onDone when it completes. Cinematic replacement for the
// old inline bar. Coexists with corner popups; the password/roll dialog
// has already closed by the time this shows.
export default function ProgressModal({ label = 'WORKING', duration = 5000, onDone }) {
  const [pct, setPct] = useState(0)
  const [spin, setSpin] = useState(0)
  const cbRef = useRef(onDone)
  cbRef.current = onDone

  useEffect(() => {
    const dur = Math.max(200, duration)
    const start = performance.now()
    let raf
    const spinIv = setInterval(() => setSpin((s) => (s + 1) % SPINNER.length), 90)
    const tick = () => {
      const p = Math.min(100, ((performance.now() - start) / dur) * 100)
      setPct(p)
      if (p < 100) {
        raf = requestAnimationFrame(tick)
      } else {
        clearInterval(spinIv)
        cbRef.current?.()
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(spinIv)
    }
  }, [duration])

  const filled = Math.floor((pct / 100) * BAR_WIDTH)
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
  const spinner = pct < 100 ? SPINNER[spin] : '✓'

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal modal--progress" role="dialog" aria-label={label}>
        <div className="modal__header">{label}</div>
        <pre className="modal__bar">
          {spinner} [{bar}] {String(Math.floor(pct)).padStart(3, ' ')}%
        </pre>
      </div>
    </div>
  )
}
