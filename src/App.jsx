import { useCallback, useEffect, useState } from 'react'
import Terminal from './components/Terminal.jsx'
import ThemeSwitcher from './components/ThemeSwitcher.jsx'
import { THEMES, DEFAULT_THEME, THEME_BY_ID, IS_DEMO } from './themes/index.js'

const LS_KEY = 'tirpg.theme'

function applyThemeCssVars(theme) {
  const root = document.documentElement
  const p = theme.palette ?? {}
  root.style.setProperty('--bg', p.bg ?? '#000')
  root.style.setProperty('--bg-soft', p.bgSoft ?? p.bg ?? '#001a00')
  root.style.setProperty('--fg', p.fg ?? '#33ff33')
  root.style.setProperty('--accent', p.accent ?? p.fg ?? '#88ff88')
  root.style.setProperty('--muted', p.muted ?? '#1a661a')
  root.style.setProperty('--error', p.error ?? '#ff4444')
  root.style.setProperty('--font', theme.font ?? "'3270 Nerd Font Mono'")
  root.style.setProperty('--font-size', theme.fontSize ?? '20px')
  root.style.setProperty('--glow', theme.crt?.glow ?? '6px')
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(LS_KEY)
    return THEME_BY_ID[saved] ?? DEFAULT_THEME
  })
  // GM mode is session-only by design — don't persist (default off each load).
  const [gmMode, setGmMode] = useState(false)

  const toggleGm = useCallback(() => setGmMode((m) => !m), [])

  useEffect(() => {
    applyThemeCssVars(theme)
    localStorage.setItem(LS_KEY, theme.id)
    const prefix = IS_DEMO ? '[DEMO] ' : ''
    document.title = `${prefix}${theme.header ?? theme.name ?? 'Terminal // RPG'}`
  }, [theme])

  // Hidden GM toggle: Ctrl+Shift+G. Also available via the `gm` command.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
        e.preventDefault()
        toggleGm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleGm])

  return (
    <div className="crt">
      <div className="chrome">
        <span>{theme.header}</span>
        <span className="chrome__right">
          {gmMode && <span className="chrome__gm">★ GM</span>}
          {IS_DEMO && <span className="chrome__demo">DEMO</span>}
          UPLINK · {new Date().getFullYear()}
        </span>
      </div>
      <div className="crt__screen">
        <Terminal
          theme={theme}
          themes={THEMES}
          onSwitchTheme={setTheme}
          gmMode={gmMode}
          onToggleGm={toggleGm}
        />
        <div className="crt__vignette" />
      </div>
      <ThemeSwitcher
        themes={THEMES}
        current={theme.id}
        onSelect={setTheme}
      />
    </div>
  )
}
