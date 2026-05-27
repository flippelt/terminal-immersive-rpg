import { useEffect, useRef, useState } from 'react'

// Top-right corner popup: a real-time "you are being traced" countdown.
// Silent. `endsAt` is a timestamp (ms); failed crack attempts move it
// earlier (handled by Terminal). Reaching 0 shows TRACE COMPLETE and fires
// onComplete once (Terminal may then run the "caught" climax).
export default function Tracer({ endsAt, total: totalProp, config = {}, onComplete }) {
  const total = totalProp ?? config.seconds ?? 30
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000))
  const done = remaining <= 0
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100))

  const firedRef = useRef(false)
  useEffect(() => {
    if (done && !firedRef.current) {
      firedRef.current = true
      onComplete?.()
    }
  }, [done, onComplete])

  return (
    <div className={`tracer${done ? ' tracer--done' : ''}`} role="status" aria-live="polite">
      <div className="tracer__title">
        {done ? config.complete ?? 'TRACE COMPLETE' : config.active ?? 'ICE TRACE ACTIVE'}
      </div>
      {!done && (
        <div className="tracer__count">
          {config.label ?? 'TRACE'} {remaining}s
        </div>
      )}
      <div className="tracer__bar">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
