import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import OutputLine from './OutputLine.jsx'
import Prompt from './Prompt.jsx'
import { runCommand } from '../engine/commands.js'

let LINE_ID = 0
const nextId = () => ++LINE_ID

const toLine = (l) => ({
  id: nextId(),
  text: l.text ?? '',
  type: l.type ?? 'normal',
  instant: !!l.instant
})

export default function Terminal({ theme, themes, onSwitchTheme }) {
  const [history, setHistory] = useState([]) // displayed/queued lines
  const [animIdx, setAnimIdx] = useState(0) // index of line currently animating
  const [cwd, setCwd] = useState('/')
  const [cmdHistory, setCmdHistory] = useState([])
  const [bootSeq, setBootSeq] = useState(0) // bumps to re-trigger boot
  const scrollRef = useRef(null)

  // Boot sequence whenever theme changes (or reboot).
  useEffect(() => {
    setHistory([])
    setAnimIdx(0)
    setCwd('/')
    const boot = (theme.boot ?? []).map(toLine)
    const banner = theme.banner ? [toLine({ text: theme.banner, type: 'banner' })] : []
    const motd = (theme.motd ?? []).map((t) => toLine({ text: t }))
    setHistory([...boot, ...banner, ...motd, toLine({ text: '', instant: true })])
  }, [theme.id, bootSeq])

  // Autoscroll as new lines complete.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history, animIdx])

  const advance = useCallback(() => {
    setAnimIdx((i) => i + 1)
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

  const handleSubmit = useCallback(
    (raw) => {
      // Echo the user input as a line.
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
        switchTheme
      })
      if (out.length) push(out)
      // Blank spacer after output for breathing room.
      push([{ text: '', instant: true }])
    },
    [theme, themes, cwd, push, clear, reboot, switchTheme]
  )

  // Animate lines sequentially: animIdx advances as each finishes.
  const inputReady = animIdx >= history.length

  const speed = theme.crt?.typeSpeed ?? 12

  return (
    <div className="crt__content" ref={scrollRef}>
      {history.slice(0, animIdx + 1).map((line, i) => {
        const animate = i === animIdx
        // Already-done lines render statically (instant).
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
