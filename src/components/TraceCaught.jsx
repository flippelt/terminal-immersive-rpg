import { useEffect, useRef, useState } from 'react'

// A drawn, deliberately unsettling grin — used when the GM doesn't override
// `smiley` with text. Inherits color (red) and the throb animation.
function MenaceFace() {
  return (
    <svg className="caught__smiley caught__face" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="5" />
      {/* angry brows + hollow eyes */}
      <path d="M28 42 L52 52" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M92 42 L68 52" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <circle cx="44" cy="56" r="6" fill="currentColor" />
      <circle cx="76" cy="56" r="6" fill="currentColor" />
      {/* wide jagged grin with teeth */}
      <path
        d="M28 74 L40 90 L50 76 L60 92 L70 76 L80 90 L92 74"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// The "you ran out of time" climax (config-driven; currently only Cyberpunk
// ships a `tracer.caught`). A burst of FOUND YOU popups scatters across the
// screen, then a black takeover types the final line letter-by-letter, a
// menacing face lands, holds, the monitor "powers off", and the console
// reboots.
export default function TraceCaught({ config = {}, onReboot }) {
  const popupMsgs = config.popups ?? ['FOUND YOU!']
  const popupCount = config.popupCount ?? 14
  const popupInterval = config.popupInterval ?? 220
  const finalText = config.finalText ?? 'FOUND YOU'
  const typeSpeed = config.typeSpeed ?? 220
  const holdMs = (config.hold ?? 5) * 1000

  const [popups, setPopups] = useState([])
  const [phase, setPhase] = useState('popups') // 'popups' -> 'final'
  const [typed, setTyped] = useState('')
  const [showSmiley, setShowSmiley] = useState(false)
  const [off, setOff] = useState(false)
  const rebooted = useRef(false)

  const reboot = () => {
    if (!rebooted.current) {
      rebooted.current = true
      onReboot?.()
    }
  }

  // Phase 1 — scatter popups in quick succession.
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      const text = popupMsgs[i % popupMsgs.length]
      setPopups((p) => [
        ...p,
        {
          id: i,
          text,
          top: 6 + Math.random() * 76,
          left: 4 + Math.random() * 72,
          rot: -10 + Math.random() * 20
        }
      ])
      i += 1
      if (i >= popupCount) {
        clearInterval(id)
        setTimeout(() => setPhase('final'), 450)
      }
    }, popupInterval)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Phase 2 — type the final line, then reveal the face.
  useEffect(() => {
    if (phase !== 'final') return
    let n = 0
    const id = setInterval(() => {
      n += 1
      setTyped(finalText.slice(0, n))
      if (n >= finalText.length) {
        clearInterval(id)
        setTimeout(() => setShowSmiley(true), 500)
      }
    }, typeSpeed)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Hold, then power the monitor off (CRT collapse) and reboot. Honors
  // reduced-motion by skipping the collapse animation.
  useEffect(() => {
    if (!showSmiley) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => {
      if (reduce) reboot()
      else setOff(true)
    }, holdMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSmiley])

  // Power-off: collapse (~0.5s), then hold a fully black screen 0.7s, then
  // reboot. Content is hidden the instant it powers off, so nothing of the
  // FOUND YOU screen shows through before the reboot.
  useEffect(() => {
    if (!off) return
    const t = setTimeout(reboot, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [off])

  return (
    <div
      className={`caught${phase === 'final' ? ' caught--final' : ''}`}
      role="alertdialog"
      aria-label={finalText}
    >
      {phase === 'popups' &&
        popups.map((p) => (
          <div
            key={p.id}
            className="caught__popup"
            style={{ top: `${p.top}%`, left: `${p.left}%`, transform: `rotate(${p.rot}deg)` }}
          >
            {p.text}
          </div>
        ))}
      {phase === 'final' && !off && (
        <div className="caught__final">
          <span className="caught__text">{typed}</span>
          {showSmiley &&
            (config.smiley ? (
              <span className="caught__smiley">{config.smiley}</span>
            ) : (
              <MenaceFace />
            ))}
        </div>
      )}
      {off && <div className="caught__off" />}
    </div>
  )
}
