import { useCallback, useEffect, useRef, useState } from 'react'
import OutputLine from './OutputLine.jsx'
import Prompt from './Prompt.jsx'
import InputModal from './InputModal.jsx'
import ProgressModal from './ProgressModal.jsx'
import SelfDestructModal from './SelfDestructModal.jsx'
import Tracer from './Tracer.jsx'
import TraceCaught from './TraceCaught.jsx'
import IceAlert from './IceAlert.jsx'
import DecryptGame from './DecryptGame.jsx'
import DecryptSuccess from './DecryptSuccess.jsx'
import FileViewer from './FileViewer.jsx'
import Detonation from './Detonation.jsx'
import HelpPopup from './HelpPopup.jsx'
import FailurePopup from './FailurePopup.jsx'

const toLines = (val, type) =>
  (Array.isArray(val) ? val : [val])
    .filter((v) => v != null)
    .map((v) => (typeof v === 'string' ? { text: v, type } : v))
import { runCommand, buildDecryptLines, buildCrackLines, buildCheckLines, buildUnlockExtras } from '../engine/commands.js'
import { complete } from '../engine/complete.js'
import { effTracer, scanTier } from '../engine/tracer.js'
import { pickWord } from '../engine/wordle.js'
import { makeT } from '../i18n/ui.js'
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
  lang = 'en',
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
  const [checkResults, setCheckResults] = useState(() => new Map())
  const [iceAlert, setIceAlert] = useState(null)
  const [decryptGame, setDecryptGame] = useState(null) // { path, node }
  const [decryptProgress, setDecryptProgress] = useState(null) // { path, node, label, duration }
  const [decryptSuccess, setDecryptSuccess] = useState(null) // { path, node, key }
  const [fileViewer, setFileViewer] = useState(null) // { path, node }
  const [helpPopup, setHelpPopup] = useState(false)
  // { title?, message, hint?, onClose } — onClose runs the side effects that
  // were deferred while the popup was up (tracer time penalty, history-line
  // push). Designed so the player can read the failure message without
  // simultaneously losing tracer seconds.
  const [failurePopup, setFailurePopup] = useState(null)
  const [detonating, setDetonating] = useState(null) // selfDestruct config
  // path -> number of repeated scans; each burns one startAfter "grace".
  const scanReductionsRef = useRef(new Map())
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
    setCheckResults(new Map())
    setIceAlert(null)
    setDecryptGame(null)
    setDecryptProgress(null)
    setDecryptSuccess(null)
    setFileViewer(null)
    setHelpPopup(false)
    setFailurePopup(null)
    setDetonating(null)
    scanReductionsRef.current = new Map()
    decryptTargetsRef.current = new Map()
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
  const langRef = useRef(lang)
  langRef.current = lang
  // UI translator for built-in strings emitted from this component (decrypt
  // outcomes, roll results, modal cancels). Kept in a ref so callbacks read
  // the live language without re-subscribing. Command names never translate.
  const tRef = useRef(makeT(lang))
  tRef.current = makeT(lang)

  // Default-pool decrypt words are picked at runtime (so they follow the
  // active language) and cached per path so `gmsheet` and the game agree.
  // Cleared on reboot and whenever the language changes.
  const decryptTargetsRef = useRef(new Map())
  const resolveDecryptTarget = useCallback((path, node) => {
    if (!node) return undefined
    if (node.decryptWord || node.decryptWords) return node.decryptTarget
    if (!node.decryptTarget) return undefined // no game on this file
    const m = decryptTargetsRef.current
    if (!m.has(path)) m.set(path, pickWord({}, Math.random, langRef.current))
    return m.get(path)
  }, [])

  useEffect(() => {
    decryptTargetsRef.current = new Map()
  }, [lang])

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
    // Hand off to the voxel detonation overlay, which floods the screen and
    // reboots the console (so the detonate lines aren't shown behind it).
    setDetonating({ detonate: c.detonate ?? 'DETONATION.' })
  }, [selfDestruct])

  const handleDetonationReboot = useCallback(() => {
    setDetonating(null)
    reboot()
  }, [reboot])

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

  const openCheckPrompt = useCallback((path, node) => {
    setModal({ kind: 'check', path, node })
  }, [])

  const openDecryptGame = useCallback(
    (path, node) => {
      setDecryptGame({ path, node, target: resolveDecryptTarget(path, node) })
    },
    [resolveDecryptTarget]
  )

  // Won the cipher minigame: recover the key, evade the tracer, and run the
  // normal unlock sequence (progress + reveal chain + events).
  const openFileViewer = useCallback((path, node) => setFileViewer({ path, node }), [])

  // Show a failure popup. Any work that should wait for the player's
  // acknowledgement (tracer time penalty, history record push, etc.) belongs
  // in `onClose` — it runs only after they dismiss the popup.
  const showFailure = useCallback((opts) => {
    setFailurePopup(opts)
  }, [])

  // Won the cipher minigame: recover the key + evade the tracer and unlock
  // the file now (so it's readable the instant the viewer opens). The screen
  // sequence is: decrypt progress bar (%) -> ACCESS GRANTED + key auto-type
  // cinematic -> file viewer. The bar runs first; its onComplete kicks off
  // the cinematic. The terminal tail + file popup come when the cinematic
  // ends (handleDecryptReveal).
  const handleDecryptWin = useCallback(() => {
    if (!decryptGame) return
    const { path, node } = decryptGame
    setDecryptGame(null)
    const tr = themeRef.current.tracer
    if (tr && node.tracer && tracerEndsAt != null) setTracerEndsAt(null)
    unlock(path)
    const duration = node.decryptTime ?? themeRef.current.locks?.decryptDefault ?? 1500
    const label = node.decryptLabel ?? themeRef.current.locks?.decryptLabel ?? 'DECRYPTING'
    // Dedicated progress modal (not a queued line) so it always shows,
    // independent of the output animation cursor. Its onDone runs the
    // ACCESS GRANTED cinematic.
    setDecryptProgress({ path, node, duration, label })
  }, [decryptGame, unlock, tracerEndsAt])

  // Decrypt progress bar finished -> start the ACCESS GRANTED cinematic.
  const handleDecryptProgressDone = useCallback(() => {
    setDecryptProgress((dp) => {
      if (dp) setDecryptSuccess({ path: dp.path, node: dp.node, key: dp.node.password })
      return null
    })
  }, [])

  // Cinematic finished: post the terminal record + any reveal-chain / event
  // tail, then open the freshly-decrypted file in the viewer popup.
  const handleDecryptReveal = useCallback(() => {
    setDecryptSuccess((ds) => {
      if (ds) {
        const { path, node } = ds
        push([
          { text: tRef.current('decrypt.solved', { key: node.password }), type: 'ok' },
          { text: tRef.current('decrypt.done', { path }), type: 'ok' },
          ...buildUnlockExtras(themeRef.current, path, node, tRef.current),
          { text: '', instant: true }
        ])
        openFileViewer(path, node)
      }
      return null
    })
  }, [push, openFileViewer])

  const handleDecryptLose = useCallback(() => {
    setDecryptGame(null)
    const message = tRef.current('decrypt.failed')
    const hint = tRef.current('decrypt.failed.hint')
    setFailurePopup({
      message,
      hint,
      onClose: () => push([
        { text: message, type: 'err' },
        { text: hint, type: 'muted' },
        { text: '', instant: true }
      ])
    })
  }, [push])

  const handleDecryptCancel = useCallback(() => {
    setDecryptGame(null)
    push([{ text: tRef.current('decrypt.cancelled'), type: 'muted' }, { text: '', instant: true }])
  }, [push])

  // Clear the tracer when the player gets in cleanly via the inline
  // `decrypt <file> <key>` path. (The decrypt modal handles its own evade.)
  const evadeTracer = useCallback(
    (node) => {
      const tr = themeRef.current.tracer
      if (tr && node?.tracer && tracerEndsAt != null) {
        setTracerEndsAt(null)
        if (tr.evaded) push([{ text: tr.evaded, type: 'ok' }, { text: '', instant: true }])
      }
    },
    [tracerEndsAt, push]
  )

  // A repeated scan: pop the ICE warning (never arms the tracer) AND burn
  // one of the file's startAfter "grace" attempts (so re-probing a watched
  // file makes the eventual trace arm sooner).
  const flagRescan = useCallback((path, message) => {
    setIceAlert(message || tRef.current('alert.suspicious'))
    const m = scanReductionsRef.current
    m.set(path, (m.get(path) ?? 0) + 1)
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
        const eff = effTracer(tr, node, scanReductionsRef.current.get(path) ?? 0)
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

  // Common interception for command output that contains a failure directive.
  // Side effects in the directive (history lines, tracer trip) run from the
  // popup's onClose so they happen only after the player dismisses it.
  const showFailureFromDirective = useCallback((directive) => {
    showFailure({
      title: directive.title,
      message: directive.message,
      hint: directive.hint,
      onClose: () => {
        if (directive.historyLines?.length) {
          push([...directive.historyLines, { text: '', instant: true }])
        }
        if (directive.tracerTrip) {
          tripTracer(directive.tracerTrip.seconds)
        }
      }
    })
  }, [push, showFailure, tripTracer])

  const handleModalSubmit = useCallback(
    (value) => {
      if (!modal) return
      const { kind, path, node } = modal
      setModal(null)
      if (kind === 'decrypt') {
        // On unlock success, also reveal the file in the cat popup so the
        // player sees what they just unlocked without having to type `cat`.
        const onUnlock = (p) => { unlock(p); openFileViewer(p, node) }
        const lines = buildDecryptLines(theme, path, node, value, onUnlock, theme.filesystem, tRef.current)
        // Wrong key surfaces as a quick failure popup (history lines + any
        // side effects run on dismissal, not while the player is reading it).
        const fail = lines.find((l) => l.type === 'failure')
        if (fail) {
          showFailureFromDirective(fail)
          return
        }
        // Getting in cleanly (correct key) on a watched file also evades the
        // tracer — you're in before the trace finishes.
        const tr = themeRef.current.tracer
        if (value === node.password && tr && node.tracer && tracerEndsAt != null) {
          setTracerEndsAt(null)
          if (tr.evaded) lines.push({ text: tr.evaded, type: 'ok' })
        }
        push([...lines, { text: '', instant: true }])
        return
      }
      if (kind === 'check') {
        // Scan roll: quality scales with the margin vs checkDC.
        const roll = parseInt(value, 10)
        if (!Number.isFinite(roll)) {
          push([{ text: tRef.current('check.enternum'), type: 'err' }, { text: '', instant: true }])
          return
        }
        const misleads = node.checkMisleadsOnFail ?? themeRef.current.checkMisleadsOnFail ?? false
        const tier = scanTier(roll, node.checkDC, misleads)
        setCheckResults((m) => new Map(m).set(path, tier))
        const locked = !!node.locked && !unlocked.has(path)
        push([
          { text: tRef.current('roll.scan', { roll }), type: 'ok' },
          ...buildCheckLines(theme, path, node, { tier, locked, gm: gmMode, t: tRef.current }),
          { text: '', instant: true }
        ])
        return
      }
      // crack roll check
      const dc = node.crackDC
      const max = node.crackAttempts ?? 3
      const roll = parseInt(value, 10)
      if (!Number.isFinite(roll)) {
        push([{ text: tRef.current('crack.enternum'), type: 'err' }, { text: '', instant: true }])
        return
      }
      const dcNote = gmMode ? ` (DC ${dc})` : ''
      if (roll > dc) {
        // Cracking it in time beats the trace: stop the tracer (with an
        // optional GM-defined "evaded" line). Also open the cat popup so
        // the player can read the file they just cracked.
        const tr = themeRef.current.tracer
        const tracerWasOn = !!tr && node.tracer && tracerEndsAt != null
        if (tracerWasOn) setTracerEndsAt(null)
        const onUnlock = (p) => { unlock(p); openFileViewer(p, node) }
        push([
          { text: tRef.current('roll.success', { roll, dc: dcNote }), type: 'ok' },
          ...(tracerWasOn && tr.evaded ? [{ text: tr.evaded, type: 'ok' }] : []),
          ...buildCrackLines(theme, path, node, onUnlock, theme.filesystem, tRef.current),
          { text: '', instant: true }
        ])
        return
      }
      // Failed roll. Increment counters immediately (no visual side effect),
      // then show the failure popup. The tracer time penalty and the
      // history-line record are both deferred to popup close so the player
      // can read the message without simultaneously losing trace seconds.
      const used = (crackAttempts.get(path) ?? 0) + 1
      setCrackAttempts((m) => new Map(m).set(path, used))
      const remaining = max - used
      const failedMsg = tRef.current('roll.failed', { roll, dc: dcNote })
      const hintMsg = remaining > 0
        ? tRef.current('crack.attemptsleft', { n: remaining })
        : tRef.current('crack.lockedout2')
      const tr = themeRef.current.tracer
      const applyTracerPenalty = () => {
        if (!tr || !node.tracer) return
        const eff = effTracer(tr, node, scanReductionsRef.current.get(path) ?? 0)
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
      showFailure({
        message: failedMsg,
        hint: hintMsg,
        onClose: () => {
          applyTracerPenalty()
          push([
            { text: failedMsg, type: 'err' },
            { text: hintMsg, type: remaining > 0 ? 'muted' : 'err' },
            { text: '', instant: true }
          ])
        }
      })
    },
    [modal, push, theme, unlock, gmMode, crackAttempts, tracerEndsAt, unlocked, openFileViewer, showFailure, showFailureFromDirective]
  )

  const handleModalCancel = useCallback(() => {
    const kind = modal?.kind ?? 'operation'
    setModal(null)
    push([
      { text: tRef.current('op.cancelled', { kind }), type: 'muted' },
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
        openCheckPrompt,
        openDecryptGame,
        openSelfDestruct,
        tripTracer,
        flagRescan,
        evadeTracer,
        resolveDecryptTarget,
        lang,
        checkResults,
        crackAttempts,
        gmMode,
        toggleGm: onToggleGm,
        scenarioIds: scenarioIdsFor(theme.id),
        switchScenario: onSwitchScenario,
        loadScenarioUrl: onLoadScenarioUrl,
        openScenarioPaste: onOpenScenarioPaste,
        shareScenario: onShareScenario,
        openFileViewer
      })
      // Directive lines drive popups instead of printing inline:
      //   fileview  → cat-style file popup
      //   helpview  → help cheat-sheet popup
      //   failure   → crack/unlock/decrypt failure popup (defers any tracer
      //               trip + history-line record until the popup closes)
      const fv = out.find((l) => l.type === 'fileview')
      const hp = out.find((l) => l.type === 'helpview')
      const fail = out.find((l) => l.type === 'failure')
      if (fv) openFileViewer(fv.path, fv.node)
      if (hp) setHelpPopup(true)
      if (fail) showFailureFromDirective(fail)
      const printable = out.filter(
        (l) => l.type !== 'fileview' && l.type !== 'helpview' && l.type !== 'failure'
      )
      if (printable.length) push(printable)
      // A failure popup defers its own trailing blank to onClose; otherwise
      // pad with a blank line so the next prompt isn't stuck against output.
      if (!fail) push([{ text: '', instant: true }])
    },
    [theme, themes, cwd, push, clear, reboot, switchTheme, unlocked, unlock, resetProgress, openPasswordPrompt, openCrackPrompt, openCheckPrompt, openDecryptGame, openSelfDestruct, tripTracer, flagRescan, evadeTracer, resolveDecryptTarget, lang, checkResults, crackAttempts, gmMode, onToggleGm, onSwitchScenario, onLoadScenarioUrl, onOpenScenarioPaste, onShareScenario, openFileViewer, showFailureFromDirective]
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
        {inputReady && !modal && !decryptGame && !decryptProgress && !decryptSuccess && !fileViewer && !failurePopup && authed && (
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
          title={theme.login.title ?? tRef.current('login.title')}
          label={theme.login.label ?? tRef.current('login.label')}
          inputType="password"
          hint={tRef.current('login.hint')}
          t={tRef.current}
          onSubmit={handleLogin}
          onCancel={() => {}}
        />
      )}
      {modal && (
        <InputModal
          title={`${modal.kind === 'crack' ? tRef.current('modal.title.crack') : modal.kind === 'check' ? tRef.current('modal.title.scan') : tRef.current('modal.title.decrypt')} // ${modal.path}`}
          label={modal.kind === 'decrypt' ? tRef.current('modal.label.key') : tRef.current('modal.label.roll')}
          inputType={modal.kind === 'decrypt' ? 'text' : 'number'}
          t={tRef.current}
          onSubmit={handleModalSubmit}
          onCancel={handleModalCancel}
        />
      )}
      {progressLine && (
        <ProgressModal
          key={progressLine.id}
          label={progressLine.label}
          duration={progressLine.duration}
          t={tRef.current}
          onDone={advance}
        />
      )}
      {selfDestruct && (
        <SelfDestructModal
          config={selfDestruct}
          t={tRef.current}
          onAbort={handleAbort}
          onDetonate={handleDetonate}
        />
      )}
      {tracerEndsAt != null && theme.tracer && !caught && (
        <>
          <div className="tracer-vignette" aria-hidden="true" />
          <Tracer endsAt={tracerEndsAt} total={tracerTotal} config={theme.tracer} onComplete={handleTraceComplete} />
        </>
      )}
      {caught && <TraceCaught config={caught} onReboot={handleCaughtReboot} />}
      {iceAlert && <IceAlert message={iceAlert} t={tRef.current} onClose={() => setIceAlert(null)} />}
      {decryptGame && (
        <DecryptGame
          target={decryptGame.target ?? decryptGame.node.decryptTarget}
          attempts={decryptGame.node.decryptAttempts}
          label={decryptGame.node.decryptLabel}
          luck={decryptGame.node.decryptLuck !== false}
          t={tRef.current}
          onWin={handleDecryptWin}
          onLose={handleDecryptLose}
          onCancel={handleDecryptCancel}
        />
      )}
      {decryptProgress && (
        <ProgressModal
          key="decrypt-progress"
          label={decryptProgress.label}
          duration={decryptProgress.duration}
          t={tRef.current}
          onDone={handleDecryptProgressDone}
        />
      )}
      {decryptSuccess && (
        <DecryptSuccess
          keyText={decryptSuccess.key}
          t={tRef.current}
          onComplete={handleDecryptReveal}
        />
      )}
      {fileViewer && (
        <FileViewer
          path={fileViewer.path}
          node={fileViewer.node}
          t={tRef.current}
          onClose={() => setFileViewer(null)}
        />
      )}
      {helpPopup && (
        <HelpPopup
          theme={theme}
          t={tRef.current}
          onClose={() => setHelpPopup(false)}
        />
      )}
      {failurePopup && (
        <FailurePopup
          title={failurePopup.title}
          message={failurePopup.message}
          hint={failurePopup.hint}
          t={tRef.current}
          onClose={() => {
            const cb = failurePopup.onClose
            setFailurePopup(null)
            cb?.()
          }}
        />
      )}
      {detonating && <Detonation config={detonating} onReboot={handleDetonationReboot} />}
    </>
  )
}
