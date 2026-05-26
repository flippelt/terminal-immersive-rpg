import { useCallback, useEffect, useRef, useState } from 'react'
import OutputLine from './OutputLine.jsx'
import Prompt from './Prompt.jsx'
import InputModal from './InputModal.jsx'
import { runCommand, buildDecryptLines, buildCrackLines } from '../engine/commands.js'
import { complete } from '../engine/complete.js'
import { playBeep, playWhoosh } from '../audio/sfx.js'
import { scenarioIdsFor } from '../themes/index.js'

let LINE_ID = 0
const nextId = () => ++LINE_ID

// Unlock progress persists per theme+scenario so a campaign survives a
// reload/reboot. Cleared with the `reset` command.
const progressKey = (t) => `tirpg.progress.${t.id}.${t.scenarioId ?? 'default'}`
const loadProgress = (t) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(progressKey(t)) ?? '[]'))
  } catch {
    return new Set()
  }
}

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

export default function Terminal({
  theme,
  themes,
  onSwitchTheme,
  onSwitchScenario,
  gmMode,
  onToggleGm
}) {
  const [history, setHistory] = useState([])
  const [animIdx, setAnimIdx] = useState(0)
  const [cwd, setCwd] = useState('/')
  const [cmdHistory, setCmdHistory] = useState([])
  const [bootSeq, setBootSeq] = useState(0)
  const [unlocked, setUnlocked] = useState(() => new Set())
  const [modal, setModal] = useState(null) // { kind:'decrypt'|'crack', path, node }
  const [crackAttempts, setCrackAttempts] = useState(() => new Map())
  const scrollRef = useRef(null)

  // Keep a live ref to history so `advance` always reads the latest array
  // without needing it in deps (avoids re-creating onDone every line).
  const historyRef = useRef(history)
  historyRef.current = history

  // Boot sequence whenever theme changes (or reboot). Restores persisted
  // unlock progress for this theme+scenario. Crack attempts stay per-session.
  useEffect(() => {
    setAnimIdx(0)
    setCwd('/')
    setUnlocked(loadProgress(theme))
    setModal(null)
    setCrackAttempts(new Map())
    const boot = (theme.boot ?? []).map(toLine)
    const banner = theme.banner
      ? [toLine({ text: theme.banner, type: 'banner' })]
      : []
    const motd = (theme.motd ?? []).map((t) => toLine({ text: t }))
    setHistory([...boot, ...banner, ...motd, toLine({ text: '', instant: true })])
    playWhoosh(theme.sounds?.whoosh)
  }, [theme, bootSeq])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history, animIdx])

  const themeRef = useRef(theme)
  themeRef.current = theme

  const advance = useCallback(() => {
    setAnimIdx((i) => {
      const current = historyRef.current[i]
      current?.onComplete?.()
      if (current?.type === 'err' || current?.type === 'ok') {
        playBeep(themeRef.current.sounds?.beep, current.type)
      }
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
      try {
        localStorage.setItem(progressKey(themeRef.current), JSON.stringify([...next]))
      } catch {
        // storage unavailable — unlock still works for the session
      }
      return next
    })
  }, [])

  const resetProgress = useCallback(() => {
    try {
      localStorage.removeItem(progressKey(themeRef.current))
    } catch {
      // ignore
    }
    setUnlocked(new Set())
    setBootSeq((n) => n + 1)
  }, [])

  const openPasswordPrompt = useCallback((path, node) => {
    setModal({ kind: 'decrypt', path, node })
  }, [])

  const openCrackPrompt = useCallback((path, node) => {
    setModal({ kind: 'crack', path, node })
  }, [])

  const handleModalSubmit = useCallback(
    (value) => {
      if (!modal) return
      const { kind, path, node } = modal
      setModal(null)
      if (kind === 'decrypt') {
        push([
          ...buildDecryptLines(theme, path, node, value, unlock, theme.filesystem),
          { text: '', instant: true }
        ])
        return
      }
      // crack roll check
      const dc = node.crackDC
      const max = node.crackAttempts ?? 3
      const roll = parseInt(value, 10)
      if (!Number.isFinite(roll)) {
        push([{ text: 'crack: enter a number', type: 'err' }, { text: '', instant: true }])
        return
      }
      const dcNote = gmMode ? ` (DC ${dc})` : ''
      if (roll > dc) {
        push([
          { text: `roll ${roll} — SUCCESS${dcNote}`, type: 'ok' },
          ...buildCrackLines(theme, path, node, unlock, theme.filesystem),
          { text: '', instant: true }
        ])
        return
      }
      const used = (crackAttempts.get(path) ?? 0) + 1
      setCrackAttempts((m) => new Map(m).set(path, used))
      const remaining = max - used
      const lines = [{ text: `roll ${roll} — FAILED${dcNote}`, type: 'err' }]
      lines.push(
        remaining > 0
          ? { text: `brute-force attempts left: ${remaining}`, type: 'muted' }
          : { text: 'brute-force LOCKED OUT — password required (`decrypt`)', type: 'err' }
      )
      lines.push({ text: '', instant: true })
      push(lines)
    },
    [modal, push, theme, unlock, gmMode, crackAttempts]
  )

  const handleModalCancel = useCallback(() => {
    const kind = modal?.kind ?? 'operation'
    setModal(null)
    push([
      { text: `${kind}: cancelled.`, type: 'muted' },
      { text: '', instant: true }
    ])
  }, [modal, push])

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
        unlock,
        resetProgress,
        openPasswordPrompt,
        openCrackPrompt,
        crackAttempts,
        gmMode,
        toggleGm: onToggleGm,
        scenarioIds: scenarioIdsFor(theme.id),
        switchScenario: onSwitchScenario
      })
      if (out.length) push(out)
      push([{ text: '', instant: true }])
    },
    [theme, themes, cwd, push, clear, reboot, switchTheme, unlocked, unlock, resetProgress, openPasswordPrompt, openCrackPrompt, crackAttempts, gmMode, onToggleGm, onSwitchScenario]
  )

  const inputReady = animIdx >= history.length
  const speed = theme.crt?.typeSpeed ?? 12

  const completeInput = useCallback(
    (input) =>
      complete(input, {
        fs: theme.filesystem ?? {},
        cwd,
        theme,
        themes,
        scenarioIds: scenarioIdsFor(theme.id)
      }),
    [theme, cwd, themes]
  )

  return (
    <>
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
        {inputReady && !modal && (
          <Prompt
            sigil={theme.prompt ?? '$'}
            cwd={cwd}
            onSubmit={handleSubmit}
            history={cmdHistory}
            sounds={theme.sounds}
            complete={completeInput}
          />
        )}
      </div>
      {modal && (
        <InputModal
          title={`${modal.kind === 'crack' ? 'CRACK' : 'DECRYPT'} // ${modal.path}`}
          label={modal.kind === 'crack' ? 'enter your roll:' : 'enter key:'}
          inputType={modal.kind === 'crack' ? 'number' : 'text'}
          onSubmit={handleModalSubmit}
          onCancel={handleModalCancel}
        />
      )}
    </>
  )
}
