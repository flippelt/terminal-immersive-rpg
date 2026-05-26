import { useEffect, useRef, useState } from 'react'

// Collapsed by default into a trigger button (keeps the bottom of the
// screen clean even with many systems). Clicking opens the menu above it.
// Players see only enabled themes; in GM mode every theme is shown with a
// ×/+ toggle to enable/disable it for players.
export default function ThemeSwitcher({
  themes,
  current,
  onSelect,
  gmMode,
  disabled,
  onToggleDisabled
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visible = gmMode
    ? themes
    : themes.filter((t) => !disabled?.has(t.id) || t.id === current)

  return (
    <div className="theme-switcher" ref={ref}>
      {open && (
        <div className="theme-switcher__menu">
          {visible.map((t) => {
            const isOff = disabled?.has(t.id)
            return (
              <span
                key={t.id}
                className={`switcher-chip${isOff ? ' switcher-chip--off' : ''}`}
              >
                <button
                  className={t.id === current ? 'active' : ''}
                  onClick={() => {
                    onSelect(t)
                    setOpen(false)
                  }}
                  title={t.name}
                >
                  {t.id}
                </button>
                {gmMode && (
                  <button
                    className="switcher-chip__toggle"
                    onClick={() => onToggleDisabled(t.id)}
                    title={isOff ? 'enable for players' : 'disable for players'}
                    aria-label={isOff ? `enable ${t.id}` : `disable ${t.id}`}
                  >
                    {isOff ? '+' : '×'}
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}
      <button
        className="theme-switcher__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="systems"
      >
        {open ? '▾' : '▴'} {current}
      </button>
    </div>
  )
}
