import { useCallback, useEffect, useRef, useState } from 'react'
import OutputLine from './OutputLine.jsx'
import Prompt from './Prompt.jsx'
import InputModal from './InputModal.jsx'
import ProgressModal from './ProgressModal.jsx'
import SelfDestructModal from './SelfDestructModal.jsx'
import Tracer from './Tracer.jsx'
import TraceCaught from './TraceCaught.jsx'

const toLines = (val, type) =>
  (Array.isArray(val) ? val : [val])
    .filter((v) => v != null)
    .map((v) => (typeof v === 'string' ? { text: v, type } : v))
import { runCommand, buildDecryptLines, buildCrackLines } from '../engine/commands.js'
import { complete } from '../engine/complete.js'
import { playBeep, playWhoosh } from '../audio/sfx.js'
import { scenarioIdsFor } from '../themes/index.js'

let LINE_ID = 0
const nextId = () => ++LINE_ID

// Effective tracer settings: a watched file may override the theme/scenario
// defaults via flat front-matter keys, so difficulty lives on the file.
const effTracer = (tr, node) => ({
  seconds: node?.tracerSeconds ?? tr?.seconds ?? 30,
  penalty: node?.tracerPenalty ?? tr?.penalty ?? 7,
  startAfter: node?.tracerStartAfter ?? tr?.startAfter ?? 0,
  nocrackSeconds: node?.tracerNocrackSeconds ?? tr?.nocrackSeconds ?? 5
})

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
  onComplete: l.onComplete,
  // countdown fields
  from: l.from,
  interval: l.interval,
  alarm: l.alarm,
  // image fields
  src: l.src,
  alt: l.alt
})

export default function Terminal({
  theme,
  themes,
  onSwitchTheme,
  onSwitchScenario,
  onLoadScenarioUrl,
  onOpenScenarioPaste,
  onShareScenario,
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
  const [authed, setAuthed] = useState(true)
  const [loginTries, setLoginTries] = useState(0)
  const [selfDestruct, setSelfDestruct] = useState(null)
  const [tracerEndsAt, setTracerEndsAt] = useState(null)
  const [tracerTotal, setTracerTotal] = useState(null)
  const [caught, setCaught] = useState(null)
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
    setSelfDestruct(null)
    setTracerEndsAt(null)
    setTracerTotal(null)
    setCaught(null)
    const needsLogin = !!theme.login
    setAuthed(!needsLogin)
    setLoginTries(0)
    const boot = (theme.boot ?? []).map(toLine)
    const banner = theme.banner
      ? [toLine({ text: theme.banner, type: 'banner' })]
      : []
    // Behind a login gate the motd is withheld until the player authenticates.
    const tail = needsLogin
      ? [
          toLine({ text: theme.login.title ?? 'AUTHENTICATION REQUIRED', type: 'ok' }),
          toLine({ text: '', instant: true })
        ]
      : [
          ...(theme.motd ?? []).map((t) => toLine({ text: t })),
          toLine({ text: '', instant: true })
        ]
    setHistory([...boot, ...banner, ...tail])
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

  const handleLogin = useCallback(
    (value) => {
      const login = themeRef.current.login
      if (login && value === login.password) {
        setAuthed(true)
        push([
          { text: login.granted ?? 'ACCESS GRANTED', type: 'ok' },
          ...(themeRef.current.motd ?? []).map((t) => ({ text: t })),
          { text: '', instant: true }
        ])
      } else {
        setLoginTries((n) => n + 1)
        push([
          { text: login?.denied ?? 'ACCESS DENIED', type: 'err' },
          { text: '', instant: true }
        ])
      }
    },
    [push]
  )

  const openSelfDestruct = useCallback((config) => {
    setSelfDestruct(config ?? {})
  }, [])

  const handleDetonate = useCallback(() => {
    const c = selfDestruct ?? {}
    setSelfDestruct(null)
    push([
      ...toLines(c.detonate ?? 'DETONATION.', 'err'),
      { text: '', instant: true }
    ])
  }, [selfDestruct, push])

  const handleAbort = useCallback(() => {
    const c = selfDestruct ?? {}
    setSelfDestruct(null)
    push([
      ...toLines(c.aborted ?? 'self-destruct sequence aborted.', 'ok'),
      { text: '', instant: true }
    ])
  }, [selfDestruct, push])

  const openPasswordPrompt = useCallback((path, node) => {
    setModal({ kind: 'decrypt', path, node })
  }, [])

  // Tracer hit zero. If the theme configures a `caught` climax (Cyberpunk),
  // run it; the sequence reboots the console when it ends.
  const handleTraceComplete = useCallback(() => {
    const c = themeRef.current.tracer?.caught
    if (c) {
      setTracerEndsAt(null)
      setCaught(c)
    }
  }, [])

  const handleCaughtReboot = useCallback(() => {
    setCaught(null)
    reboot()
  }, [reboot])

  const openCrackPrompt = useCallback(
    (path, node) => {
      setModal({ kind: 'crack', path, node })
      // Cyberpunk-style tracer. Only files that opt in (`tracer: true`)
      // arm it. Arm at command time only when the GM set no grace
      // (startAfter 0 = the default, current behavior); a higher startAfter
      // delays arming until that many failed attempts (handled below).
      const tr = themeRef.current.tracer
      if (tr && node.tracer) {
        const eff = effTracer(tr, node)
        if (eff.startAfter <= 0) {
          setTracerEndsAt((prev) => {
            if (prev != null) return prev
            setTracerTotal(eff.seconds)
            return Date.now() + eff.seconds * 1000
          })
        }
      }
    },
    []
  )

  // Trip the tracer to a short, fixed countdown — used when a player brute-
  // forces a hardened (nocrack) watched file. Only ever makes it worse.
  const tripTracer = useCallback((seconds) => {
    const s = seconds ?? 5
    setTracerEndsAt((prev) => {
      const t = Date.now() + s * 1000
      return prev == null ? t : Math.min(prev, t)
    })
    setTracerTotal((prev) => (prev == null ? s : Math.min(prev, s)))
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
        // Cracking it in time beats the trace: stop the tracer (with an
        // optional GM-defined "evaded" line).
        const tr = themeRef.current.tracer
        const tracerWasOn = !!tr && node.tracer && tracerEndsAt != null
        if (tracerWasOn) setTracerEndsAt(null)
        push([
          { text: `roll ${roll} — SUCCESS${dcNote}`, type: 'ok' },
          ...(tracerWasOn && tr.evaded ? [{ text: tr.evaded, type: 'ok' }] : []),
          ...buildCrackLines(theme, path, node, unlock, theme.filesystem),
          { text: '', instant: true }
        ])
        return
      }
      const used = (crackAttempts.get(path) ?? 0) + 1
      setCrackAttempts((m) => new Map(m).set(path, used))
      // Tracer — only for files that opt in (`tracer: true`):
      //  • if not yet active, arm it once failed attempts reach the GM's
      //    grace `startAfter` (>= 1; startAfter 0 already armed at command);
      //  • if active, each failed attempt drags it earlier by `penalty`.
      const tr = themeRef.current.tracer
      if (tr && node.tracer) {
        const eff = effTracer(tr, node)
        setTracerEndsAt((prev) => {
          if (prev == null) {
            if (eff.startAfter >= 1 && used >= eff.startAfter) {
              setTracerTotal(eff.seconds)
              return Date.now() + eff.seconds * 1000
            }
            return prev
          }
          return prev - eff.penalty * 1000
        })
      }
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
    [modal, push, theme, unlock, gmMode, crackAttempts, tracerEndsAt]
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
        openSelfDestruct,
        tripTracer,
        crackAttempts,
        gmMode,
        toggleGm: onToggleGm,
        scenarioIds: scenarioIdsFor(theme.id),
        switchScenario: onSwitchScenario,
        loadScenarioUrl: onLoadScenarioUrl,
        openScenarioPaste: onOpenScenarioPaste,
        shareScenario: onShareScenario
      })
      if (out.length) push(out)
      push([{ text: '', instant: true }])
    },
    [theme, themes, cwd, push, clear, reboot, switchTheme, unlocked, unlock, resetProgress, openPasswordPrompt, openCrackPrompt, openSelfDestruct, tripTracer, crackAttempts, gmMode, onToggleGm, onSwitchScenario, onLoadScenarioUrl, onOpenScenarioPaste, onShareScenario]
  )

  const inputReady = animIdx >= history.length
  const speed = theme.crt?.typeSpeed ?? 12
  const activeLine = animIdx < history.length ? history[animIdx] : null
  const progressLine = activeLine?.type === 'progress' ? activeLine : null

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
        {inputReady && !modal && authed && (
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
      {inputReady && !authed && theme.login && (
        <InputModal
          key={loginTries}
          title={theme.login.title ?? 'AUTHENTICATION REQUIRED'}
          label={theme.login.label ?? 'access code:'}
          inputType="password"
          hint="enter to authenticate"
          onSubmit={handleLogin}
          onCancel={() => {}}
        />
      )}
      {modal && (
        <InputModal
          title={`${modal.kind === 'crack' ? 'CRACK' : 'DECRYPT'} // ${modal.path}`}
          label={modal.kind === 'crack' ? 'enter your roll:' : 'enter key:'}
          inputType={modal.kind === 'crack' ? 'number' : 'text'}
          onSubmit={handleModalSubmit}
          onCancel={handleModalCancel}
        />
      )}
      {progressLine && (
        <ProgressModal
          key={progressLine.id}
          label={progressLine.label}
          duration={progressLine.duration}
          onDone={advance}
        />
      )}
      {selfDestruct && (
        <SelfDestructModal
          config={selfDestruct}
          onAbort={handleAbort}
          onDetonate={handleDetonate}
        />
      )}
      {tracerEndsAt != null && theme.tracer && !caught && (
        <Tracer endsAt={tracerEndsAt} total={tracerTotal} config={theme.tracer} onComplete={handleTraceComplete} />
      )}
      {caught && <TraceCaught config={caught} onReboot={handleCaughtReboot} />}
    </>
  )
}
