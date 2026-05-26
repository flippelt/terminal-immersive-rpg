import { useCallback, useEffect, useRef, useState } from 'react'
import OutputLine from './OutputLine.jsx'
import Prompt from './Prompt.jsx'
import { runCommand } from '../engine/commands.js'

let LINE_ID = 0
const nextId = () => ++LINE_ID

// Pass through extra fields (duration, label, onComplete) for progress lines.
const toLine = (l) => ({
  id: nextId(),
  text: l.text ?? '',
  type: l.type ?? 'normal',
  instant: !!l.instant,
  duration: l.duration,
  label: l.label,
  onComplete: l.onComplete
})

export default function Terminal({ theme, themes, onSwitchTheme }) {
  const [history, setHistory] = useState([])
  const [animIdx, setAnimIdx] = useState(0)
  const [cwd, setCwd] = useState('/')
  const [cmdHistory, setCmdHistory] = useState([])
  const [bootSeq, setBootSeq] = useState(0)
  const [unlocked, setUnlocked] = useState(() => new Set())
  const scrollRef = useRef(null)

  // Keep a live ref to history so `advance` always reads the latest array
  // without needing it in deps (avoids re-creating onDone every line).
  const historyRef = useRef(history)
  historyRef.current = history

  // Boot sequence whenever theme changes (or reboot). Resets unlocks too.
  useEffect(() => {
    setAnimIdx(0)
    setCwd('/')
    setUnlocked(new Set())
    const boot = (theme.boot ?? []).map(toLine)
    const banner = theme.banner
      ? [toLine({ text: theme.banner, type: 'banner' })]
      : []
    const motd = (theme.motd ?? []).map((t) => toLine({ text: t }))
    setHistory([...boot, ...banner, ...motd, toLine({ text: '', instant: true })])
  }, [theme, bootSeq])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history, animIdx])

  const advance = useCallback(() => {
    setAnimIdx((i) => {
      const current = historyRef.current[i]
      current?.onComplete?.()
      return i + 1
    })
  }, [])

  const push = useCallback((lines) => {
    setHistory((h) => [...h, ...lines.map(toLine)])
  }, [])

  const clear = useCallback(() => {
    setHistory([])
    setAnimIdx(0)
  }, [])

  const reboot = useCallback(() => {
    setBootSeq((n) => n + 1)
  }, [])

  const switchTheme = useCallback(
    (id) => {
      const target = themes.find((t) => t.id === id)
      if (!target) return false
      onSwitchTheme(target)
      return true
    },
    [themes, onSwitchTheme]
  )

  const unlock = useCallback((path) => {
    setUnlocked((s) => {
      const next = new Set(s)
      next.add(path)
      return next
    })
  }, [])

  const handleSubmit = useCallback(
    (raw) => {
      const sigil = `${theme.prompt ?? '$'} ${cwd === '/' ? '/' : cwd} >`
      push([{ text: `${sigil} ${raw}`, type: 'user', instant: true }])
      if (raw.trim()) {
        setCmdHistory((h) => [...h, raw])
      }
      const out = runCommand(raw, {
        theme,
        themes,
        fs: theme.filesystem ?? {},
        cwd,
        setCwd,
        clear,
        reboot,
        switchTheme,
        unlocked,
        unlock
      })
      if (out.length) push(out)
      push([{ text: '', instant: true }])
    },
    [theme, themes, cwd, push, clear, reboot, switchTheme, unlocked, unlock]
  )

  const inputReady = animIdx >= history.length
  const speed = theme.crt?.typeSpeed ?? 12

  return (
    <div className="crt__content" ref={scrollRef}>
      {history.slice(0, animIdx + 1).map((line, i) => {
        const animate = i === animIdx
        return (
          <OutputLine
            key={line.id}
            line={animate ? line : { ...line, instant: true }}
            animate={animate}
            speed={speed}
            onDone={animate ? advance : undefined}
          />
        )
      })}
      {inputReady && (
        <Prompt
          sigil={theme.prompt ?? '$'}
          cwd={cwd}
          onSubmit={handleSubmit}
          history={cmdHistory}
        />
      )}
    </div>
  )
}
