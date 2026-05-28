import { useEffect, useRef, useState } from 'react'
import { makeT } from '../i18n/ui.js'

const LANGS = [
  ['en', 'EN'],
  ['pt', 'PT']
]

// Bottom-left control: collapsed into one trigger that opens a panel with
// the system (theme) chips and a language toggle. Players see only enabled
// themes; in GM mode every theme shows a ×/+ toggle to enable/disable it.
export default function ThemeSwitcher({
  themes,
  current,
  onSelect,
  gmMode,
  disabled,
  onToggleDisabled,
  lang,
  onSetLang
}) {
  const t = makeT(lang)
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
          <p className="switcher__label">{t('switcher.system')}</p>
          <div className="switcher__row">
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
                    title={isOff ? t('switcher.gm.enable') : t('switcher.gm.disable')}
                    aria-label={isOff ? `enable ${t.id}` : `disable ${t.id}`}
                  >
                    {isOff ? '+' : '×'}
                  </button>
                )}
              </span>
            )
          })}
          </div>
          <p className="switcher__label">{t('switcher.language')}</p>
          <div className="switcher__row">
            {LANGS.map(([code, label]) => (
              <span key={code} className="switcher-chip">
                <button
                  className={code === lang ? 'active' : ''}
                  onClick={() => onSetLang?.(code)}
                  title={code === 'pt' ? 'Português' : 'English'}
                >
                  {label}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      <button
        className="theme-switcher__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="systems & language"
      >
        {open ? '▾' : '▴'} {current} · {(lang ?? 'en').toUpperCase()}
      </button>
    </div>
  )
}
