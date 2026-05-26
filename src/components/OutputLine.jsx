import { useTypewriter } from '../hooks/useTypewriter.js'

const CLASS_BY_TYPE = {
  err: 'line line--err',
  ok: 'line line--ok',
  muted: 'line line--muted',
  user: 'line line--user',
  banner: 'banner',
  normal: 'line'
}

export default function OutputLine({ line, animate, speed, onDone }) {
  const cls = CLASS_BY_TYPE[line.type] ?? CLASS_BY_TYPE.normal
  const text = line.text ?? ''
  // Banners and `instant` lines skip the typewriter — they appear whole.
  const enabled = animate && !line.instant && line.type !== 'banner'
  const { out } = useTypewriter(text, { speed, enabled, onDone })

  const display = enabled ? out : text

  if (line.type === 'banner') {
    return <pre className={cls}>{display}</pre>
  }
  return <p className={cls}>{display || ' '}</p>
}
