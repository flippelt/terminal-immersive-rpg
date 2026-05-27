import { useEffect, useRef } from 'react'

// Idle screensaver. One effect per theme (theme.screensaver), all tinted
// with the active --fg. Click/any activity wakes it (handled by App).
//   matrix    falling glyphs       (IBM)
//   starfield warp-speed stars     (Alien, Cyberpunk)
//   rain      diagonal streaks     (Blade Runner)
//   sweep     radar sweep          (Lancer, Dataslate)
//   static    machine-spirit noise (WH40K)
//   bounce    DVD-style label      (Fallout)

const MATRIX_CHARS = 'アイウエオカキクケコ0123456789ABCDEF<>/\\[]{}#$%&*+='

function makeEffect(name, ctx, w, h, fg, label) {
  const fade = (a = 0.09) => {
    ctx.fillStyle = `rgba(0,0,0,${a})`
    ctx.fillRect(0, 0, w, h)
  }

  switch (name) {
    case 'matrix': {
      const fs = 16
      const cols = Math.ceil(w / fs)
      const drops = Array.from({ length: cols }, () => Math.random() * -60)
      return () => {
        fade(0.09)
        ctx.fillStyle = fg
        ctx.font = `${fs}px monospace`
        for (let i = 0; i < cols; i++) {
          ctx.fillText(MATRIX_CHARS[(Math.random() * MATRIX_CHARS.length) | 0], i * fs, drops[i] * fs)
          if (drops[i] * fs > h && Math.random() > 0.975) drops[i] = 0
          drops[i]++
        }
      }
    }
    case 'rain': {
      const drops = Array.from({ length: Math.round(w / 8) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        len: 8 + Math.random() * 22,
        v: 8 + Math.random() * 12
      }))
      const skew = 1.6
      return () => {
        fade(0.14)
        ctx.strokeStyle = fg
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.6
        ctx.beginPath()
        for (const d of drops) {
          ctx.moveTo(d.x, d.y)
          ctx.lineTo(d.x + skew * (d.len / 3), d.y + d.len)
          d.y += d.v
          d.x += skew
          if (d.y > h) {
            d.y = -d.len
            d.x = Math.random() * w
          }
        }
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
    case 'sweep': {
      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) * 0.45
      let ang = 0
      return () => {
        fade(0.08)
        // faint rings
        ctx.strokeStyle = fg
        ctx.globalAlpha = 0.12
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath()
          ctx.arc(cx, cy, (r * k) / 3, 0, Math.PI * 2)
          ctx.stroke()
        }
        // sweep wedge
        ang += 0.03
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, r, ang - 0.35, ang)
        ctx.closePath()
        ctx.fillStyle = fg
        ctx.globalAlpha = 0.18
        ctx.fill()
        // leading line
        ctx.globalAlpha = 0.7
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang))
        ctx.strokeStyle = fg
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
    case 'static': {
      return () => {
        fade(0.25)
        ctx.fillStyle = fg
        const n = Math.round((w * h) / 1600)
        for (let i = 0; i < n; i++) {
          const a = Math.random()
          if (a < 0.5) continue
          ctx.globalAlpha = a * 0.5
          ctx.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 2, 2)
        }
        ctx.globalAlpha = 1
      }
    }
    case 'bounce': {
      const text = (label || '□').toUpperCase()
      const fs = 28
      ctx.font = `${fs}px monospace`
      const tw = ctx.measureText(text).width
      let x = Math.random() * (w - tw)
      let y = Math.random() * (h - fs) + fs
      let vx = 1.4
      let vy = 1.1
      return () => {
        fade(0.18)
        x += vx
        y += vy
        if (x <= 0 || x + tw >= w) vx = -vx
        if (y - fs <= 0 || y >= h) vy = -vy
        ctx.fillStyle = fg
        ctx.font = `${fs}px monospace`
        ctx.fillText(text, x, y)
      }
    }
    case 'starfield':
    default: {
      const stars = Array.from({ length: 220 }, () => ({
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random()
      }))
      const cx = w / 2
      const cy = h / 2
      return () => {
        fade(0.2)
        ctx.fillStyle = fg
        for (const s of stars) {
          s.z -= 0.008
          if (s.z <= 0.02) {
            s.x = Math.random() * 2 - 1
            s.y = Math.random() * 2 - 1
            s.z = 1
          }
          const px = cx + (s.x / s.z) * cx
          const py = cy + (s.y / s.z) * cy
          if (px < 0 || px >= w || py < 0 || py >= h) continue
          const size = (1 - s.z) * 2.5
          ctx.globalAlpha = Math.min(1, 1 - s.z + 0.2)
          ctx.fillRect(px, py, size, size)
        }
        ctx.globalAlpha = 1
      }
    }
  }
}

export default function Screensaver({ onWake, effect = 'starfield', label }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#33ff33'

    let frame
    let raf
    let last = 0
    const setup = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      frame = makeEffect(effect, ctx, canvas.width, canvas.height, fg, label)
    }
    setup()
    window.addEventListener('resize', setup)

    const loop = (t) => {
      raf = requestAnimationFrame(loop)
      if (t - last < 50) return
      last = t
      frame()
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', setup)
    }
  }, [effect, label])

  return (
    <div className="screensaver" onClick={onWake} role="presentation">
      <canvas ref={canvasRef} className="screensaver__canvas" />
      <span className="screensaver__hint">— idle — press any key —</span>
    </div>
  )
}
