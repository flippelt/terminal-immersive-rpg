import { useEffect, useRef, useState } from 'react'

const BAR_WIDTH = 24
const SPINNER = ['|', '/', '-', '\\']

export default function ProgressLine({ line, animate, onDone }) {
  const duration = Math.max(200, line.duration ?? 5000)
  const label = line.label ?? 'WORKING'
  const [pct, setPct] = useState(animate ? 0 : 100)
  const [spin, setSpin] = useState(0)
  const startRef = useRef(null)
  const cbRef = useRef(onDone)
  cbRef.current = onDone

  useEffect(() => {
    if (!animate) {
      setPct(100)
      cbRef.current?.()
      return
    }
    startRef.current = performance.now()
    let raf
    let spinIv = setInterval(() => setSpin((s) => (s + 1) % SPINNER.length), 90)
    const tick = () => {
      const elapsed = performance.now() - startRef.current
      const p = Math.min(100, (elapsed / duration) * 100)
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
  }, [animate, duration])

  const filled = Math.floor((pct / 100) * BAR_WIDTH)
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
  const pctStr = String(Math.floor(pct)).padStart(3, ' ')
  const spinner = pct < 100 ? SPINNER[spin] : '✓'

  return (
    <p className="line line--progress">
      {spinner} [{bar}] {pctStr}%  {label}
    </p>
  )
}
