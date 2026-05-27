import { useEffect } from 'react'

// A small ICE warning window — e.g. a repeated scan tripping suspicion.
// Warns only; it never arms the tracer. Dismiss by click, Enter or Esc, and
// it auto-closes after a few seconds.
export default function IceAlert({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="ice-alert" role="alertdialog" aria-label={message} onClick={onClose}>
      <div className="ice-alert__box">
        <div className="ice-alert__title">⚠ ICE</div>
        <div className="ice-alert__msg">{message}</div>
        <div className="ice-alert__hint">click · esc to dismiss</div>
      </div>
    </div>
  )
}
