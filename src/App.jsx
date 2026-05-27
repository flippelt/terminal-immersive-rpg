import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Terminal from './components/Terminal.jsx'
import ThemeSwitcher from './components/ThemeSwitcher.jsx'
import AudioToggle from './components/AudioToggle.jsx'
import Screensaver from './components/Screensaver.jsx'
import { setVolume as setAudioVolume, startHum } from './audio/sfx.js'

const IDLE_MS = 45000
import {
  THEMES,
  DEFAULT_THEME,
  THEME_BY_ID,
  IS_DEMO,
  composeTheme
} from './themes/index.js'

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

function initialSelection() {
  const params = new URLSearchParams(window.location.search)
  const urlTheme = params.get('theme')
  const urlScenario = params.get('scenario')
  const saved = localStorage.getItem(LS_KEY)
  const themeId =
    (urlTheme && THEME_BY_ID[urlTheme]?.id) ||
    (saved && THEME_BY_ID[saved]?.id) ||
    DEFAULT_THEME.id
  // null scenario -> composeTheme falls back to the theme's defaultScenario.
  return { themeId, scenarioId: urlScenario || null }
}

export default function App() {
  const [sel, setSel] = useState(initialSelection)
  // GM mode is session-only by design — don't persist (default off each load).
  const [gmMode, setGmMode] = useState(false)

  // Themes the GM has disabled for players. Persisted so the table keeps
  // the GM's setup across reloads.
  const [disabledThemes, setDisabledThemes] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('tirpg.disabledThemes') ?? '[]'))
    } catch {
      return new Set()
    }
  })

  const toggleThemeDisabled = useCallback((id) => {
    setDisabledThemes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('tirpg.disabledThemes', JSON.stringify([...next]))
      return next
    })
  }, [])

  const theme = useMemo(
    () => composeTheme(sel.themeId, sel.scenarioId),
    [sel]
  )

  const setTheme = useCallback((themeSkin) => {
    // Switching theme resets to that theme's default scenario.
    setSel({ themeId: themeSkin.id, scenarioId: null })
  }, [])

  const switchScenario = useCallback((scenarioId) => {
    setSel((s) => ({ ...s, scenarioId }))
  }, [])

  const toggleGm = useCallback(() => setGmMode((m) => !m), [])

  // Idle screensaver: appears after IDLE_MS without activity; any activity
  // wakes it. The waking keystroke is swallowed so it doesn't leak into the
  // terminal input.
  const [idle, setIdle] = useState(false)
  const idleRef = useRef(false)
  idleRef.current = idle
  useEffect(() => {
    let timer
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), IDLE_MS)
    }
    const onActivity = (e) => {
      if (idleRef.current) {
        setIdle(false)
        if (e.type === 'keydown') {
          e.preventDefault()
          e.stopPropagation()
        }
      }
      arm()
    }
    const opts = { capture: true }
    const evts = ['keydown', 'mousedown', 'mousemove', 'touchstart', 'wheel']
    evts.forEach((ev) => window.addEventListener(ev, onActivity, opts))
    arm()
    return () => {
      clearTimeout(timer)
      evts.forEach((ev) => window.removeEventListener(ev, onActivity, opts))
    }
  }, [])

  // Restore audio volume + ambient hum once on mount. (Hum is off by
  // default; it only sounds once the AudioContext resumes on first input.)
  useEffect(() => {
    const stored = parseFloat(localStorage.getItem('tirpg.volume') ?? '0.4')
    setAudioVolume(Number.isFinite(stored) ? stored : 0.4)
    if (localStorage.getItem('tirpg.hum') === 'on') startHum()
  }, [])

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
          onSwitchScenario={switchScenario}
          gmMode={gmMode}
          onToggleGm={toggleGm}
        />
        <div className="crt__vignette" />
      </div>
      <ThemeSwitcher
        themes={THEMES}
        current={theme.id}
        onSelect={setTheme}
        gmMode={gmMode}
        disabled={disabledThemes}
        onToggleDisabled={toggleThemeDisabled}
      />
      <AudioToggle />
      {idle && (
        <Screensaver
          onWake={() => setIdle(false)}
          effect={theme.screensaver}
          label={theme.name}
        />
      )}
    </div>
  )
}
