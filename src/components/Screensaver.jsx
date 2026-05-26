import { useEffect, useRef } from 'react'

// Idle screensaver: matrix-style character rain tinted with the active
// theme's --fg. Click/any activity wakes it (handled by App).
export default function Screensaver({ onWake }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return // static overlay, no animation

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const styles = getComputedStyle(document.documentElement)
    const fg = (styles.getPropertyValue('--fg').trim() || '#33ff33')
    const fontSize = 16
    const chars = 'アイウエオカキクケコ0123456789ABCDEF<>/\\[]{}#$%&*+='

    let w, h, cols, drops, raf, last = 0
    const resize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
      cols = Math.ceil(w / fontSize)
      drops = Array.from({ length: cols }, () => Math.random() * -60)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (t) => {
      raf = requestAnimationFrame(draw)
      if (t - last < 55) return
      last = t
      ctx.fillStyle = 'rgba(0, 0, 0, 0.09)'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = fg
      ctx.font = `${fontSize}px monospace`
      for (let i = 0; i < cols; i++) {
        const ch = chars[(Math.random() * chars.length) | 0]
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize)
        if (drops[i] * fontSize > h && Math.random() > 0.975) drops[i] = 0
        drops[i]++
      }
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="screensaver" onClick={onWake} role="presentation">
      <canvas ref={canvasRef} className="screensaver__canvas" />
      <span className="screensaver__hint">— idle — press any key —</span>
    </div>
  )
}
