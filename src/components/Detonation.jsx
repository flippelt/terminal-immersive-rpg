import { useEffect, useMemo, useState } from 'react'
import { playGlitch, playPowerOff } from '../audio/sfx.js'

const COLS = 18
const ROWS = 12

// Self-destruct detonation: red voxels flood the screen (monitor sectors
// failing), hold ~0.5s, then the monitor powers off (CRT collapse) and the
// console reboots. The overlay is opaque the whole time, so nothing of the
// old screen shows through before the reboot (same pattern as the tracer
// "caught" climax).
export default function Detonation({ config = {}, onReboot }) {
  const [off, setOff] = useState(false)
  const delays = useMemo(
    () => Array.from({ length: COLS * ROWS }, () => Math.random() * 0.45),
    []
  )
  const lines = (Array.isArray(config.detonate) ? config.detonate : [config.detonate]).filter(Boolean)

  // Flood + hold, then power-off (honors reduced motion by skipping it).
  useEffect(() => {
    playGlitch()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => {
      if (reduce) onReboot?.()
      else {
        playPowerOff()
        setOff(true)
      }
    }, 950)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!off) return
    const t = setTimeout(() => onReboot?.(), 550)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [off])

  return (
    <div className="detonation" role="alertdialog" aria-label="self-destruct">
      <div className="detonation__grid">
        {delays.map((d, i) => (
          <span key={i} className="detonation__cell" style={{ animationDelay: `${d}s` }} />
        ))}
      </div>
      {lines.length > 0 && (
        <div className="detonation__msg">
          {lines.map((t, i) => (
            <div key={i}>{t}</div>
          ))}
        </div>
      )}
      {off && <div className="caught__off" />}
    </div>
  )
}
