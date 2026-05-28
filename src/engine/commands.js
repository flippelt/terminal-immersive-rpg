import { normalizePath, getNode, listDir } from './filesystem.js'
import { renderMarkdown } from './markdown.js'
import { makeT } from '../i18n/ui.js'
import {
  setVolume as audioSetVolume,
  setMuted as audioSetMuted,
  getVolume as audioGetVolume,
  isMuted as audioIsMuted,
  startHum as audioStartHum,
  stopHum as audioStopHum,
  isHumOn as audioIsHumOn
} from '../audio/sfx.js'

// Each command receives a `ctx` object and returns an array of "lines".
// Line shapes:
//   { text, type?, instant? }                     plain output
//   { type: 'progress', duration, label, onComplete? }   animated bar
//
// ctx = {
//   args, raw, theme, themes, fs, cwd, unlocked, lang, t,
//   setCwd, clear, switchTheme, reboot, unlock
// }
// ctx.t is the UI translator (makeT(lang)); built-in operator-facing text
// goes through it so the terminal speaks the player's language. Command
// names themselves never translate. Helpers shared with Terminal.jsx accept
// `t` explicitly and default to English so unit tests stay language-stable.

// `help` no longer dumps lines into the terminal; it hands control to the
// HelpPopup (a movable/resizable cheat sheet on desktop, fixed modal on
// mobile). Terminal.jsx intercepts the `helpview` directive and opens the
// popup. The popup itself reads `help.title`, `help.lines`, theme.extraHelp
// and theme.aliases.
const help = () => [{ type: 'helpview' }]

// .md files render through the markdown layer; everything else (.log,
// .dat, ...) prints raw, like a data dump. A file with an `image:`
// front-matter key (a URL or data URI) renders that picture, CRT-filtered,
// above its text — Esper photos, maps, mugshots.
export function renderFileContent(path, node) {
  const text = node?.content ?? ''
  const lines = path.endsWith('.md')
    ? renderMarkdown(text)
    : text.split('\n').map((t) => ({ text: t }))
  if (node?.image) {
    return [
      { type: 'image', src: String(node.image), alt: node.imageAlt ?? path },
      ...lines
    ]
  }
  return lines
}

function resolveTarget(ctx, arg) {
  const path = normalizePath(ctx.cwd, arg)
  const node = getNode(ctx.fs, path)
  return { path, node }
}

function isLocked(node, ctx, path) {
  if (!node) return false
  if (!node.locked) return false
  return !ctx.unlocked?.has(path)
}

const COMMANDS = {
  help: () => help(),
  '?': () => help(),

  clear: (ctx) => {
    ctx.clear()
    return []
  },

  pwd: (ctx) => [{ text: ctx.cwd }],

  whoami: (ctx) => [{ text: ctx.theme.user ?? ctx.t('operator') }],

  date: () => [{ text: new Date().toUTCString() }],

  motd: (ctx) =>
    ctx.theme.motd?.map((t) => ({ text: t })) ?? [{ text: ctx.t('motd.none') }],

  reboot: (ctx) => {
    ctx.reboot()
    return []
  },

  reset: (ctx) => {
    ctx.resetProgress?.()
    return []
  },

  loadscenario: (ctx) => {
    const url = ctx.args[0]
    if (!url) {
      if (ctx.openScenarioPaste) {
        ctx.openScenarioPaste()
        return [{ text: ctx.t('load.paste'), type: 'muted' }]
      }
      return [{ text: ctx.t('load.usage'), type: 'err' }]
    }
    if (!/^https?:\/\//i.test(url)) {
      return [{ text: ctx.t('load.badurl'), type: 'err' }]
    }
    ctx.loadScenarioUrl?.(url)
    return [{ text: ctx.t('load.fetching', { url }), type: 'muted' }]
  },

  sharescenario: (ctx) => {
    const url = ctx.shareScenario?.()
    if (!url) {
      return [{ text: ctx.t('share.none'), type: 'err' }]
    }
    return [
      { text: ctx.t('share.ok'), type: 'ok' },
      { text: url, type: 'muted' }
    ]
  },

  ls: (ctx) => {
    const target = ctx.args[0] ? normalizePath(ctx.cwd, ctx.args[0]) : ctx.cwd
    const entries = listDir(ctx.fs, target)
    if (!entries) return [{ text: ctx.t('ls.notdir', { target }), type: 'err' }]
    if (entries.length === 0) return [{ text: ctx.t('ls.empty'), type: 'muted' }]
    return entries.map((e) => {
      const child = getNode(ctx.fs, normalizePath(target, e.name))
      const locked = child?.locked && !ctx.unlocked?.has(normalizePath(target, e.name))
      let suffix = ''
      if (e.type === 'dir') suffix = '/'
      else if (locked) {
        if (ctx.gmMode) {
          const parts = [ctx.t('tag.locked')]
          if (child.password) parts.push(`pwd:${child.password}`)
          if (child.crackDC != null) parts.push(`DC:${child.crackDC}`)
          if (child.crackable === false) parts.push('nocrack')
          suffix = ` [${parts.join(' ')}]`
        } else {
          suffix = ` [${ctx.t('tag.locked')}]`
        }
      }
      return {
        text: `${e.name}${suffix}`,
        type: e.type === 'dir' ? 'ok' : locked ? 'muted' : 'normal'
      }
    })
  },

  cd: (ctx) => {
    const arg = ctx.args[0] ?? '/'
    const target = normalizePath(ctx.cwd, arg)
    const node = getNode(ctx.fs, target)
    if (!node) return [{ text: ctx.t('cd.nodir', { target }), type: 'err' }]
    if (node.type !== 'dir')
      return [{ text: ctx.t('cd.notdir', { target }), type: 'err' }]
    ctx.setCwd(target)
    return []
  },

  // Recon: read a file's security posture — encryption, brute-force, and
  // (crucially) whether it is *watched* (arms the tracer on intrusion).
  // Passive & free by default; if the file sets `checkDC` the scan becomes a
  // roll, resolved ONCE per file (its quality scales with the result). A
  // second scan of the same file raises a (configurable) suspicious-activity
  // alert — it warns, it does NOT start the trace. GM mode sees the truth.
  check: (ctx) => {
    if (!ctx.args[0]) return [{ text: ctx.t('check.missing'), type: 'err' }]
    const { path, node } = resolveTarget(ctx, ctx.args[0])
    if (!node) return [{ text: ctx.t('check.nofile', { path }), type: 'err' }]
    if (node.type !== 'file')
      return [{ text: ctx.t('check.isdir', { path }), type: 'err' }]
    const locked = isLocked(node, ctx, path)

    if (ctx.gmMode) {
      return buildCheckLines(ctx.theme, path, node, { tier: 'precise', locked, gm: true, t: ctx.t })
    }
    if (locked && node.checkDC != null) {
      const prev = ctx.checkResults?.get(path)
      if (prev) {
        // Already scanned once. A repeat scan trips a suspicious-activity
        // alert if configured (warning only — never starts the trace), and
        // burns one of the file's startAfter "grace" attempts.
        const alert = node.checkAlert ?? ctx.theme.tracer?.checkAlert
        if (alert) ctx.flagRescan?.(path, alert)
        return [
          { text: ctx.t('check.rescan', { path }), type: 'muted' },
          ...buildCheckLines(ctx.theme, path, node, { tier: prev, locked, t: ctx.t })
        ]
      }
      ctx.openCheckPrompt?.(path, node)
      return [{ text: ctx.t('check.running', { path }), type: 'muted' }]
    }
    return buildCheckLines(ctx.theme, path, node, { tier: 'precise', locked, t: ctx.t })
  },

  cat: (ctx) => {
    if (!ctx.args[0]) return [{ text: ctx.t('cat.missing'), type: 'err' }]
    const { path, node } = resolveTarget(ctx, ctx.args[0])
    if (!node) return [{ text: ctx.t('cat.nofile', { path }), type: 'err' }]
    if (node.type !== 'file')
      return [{ text: ctx.t('cat.isdir', { path }), type: 'err' }]
    if (isLocked(node, ctx, path)) {
      // GM mode: reveal locked content inline with a clear marker.
      if (ctx.gmMode) {
        const meta = []
        if (node.password) meta.push(`pwd:${node.password}`)
        if (node.crackDC != null) meta.push(`DC:${node.crackDC}`)
        if (node.crackable === false) meta.push('nocrack')
        return [
          {
            text: ctx.t('cat.gmpreview', {
              path,
              locked: ctx.t('tag.locked'),
              meta: meta.length ? ' ' + meta.join(' ') : ''
            }),
            type: 'muted'
          },
          ...renderFileContent(path, node),
          { text: ctx.t('cat.gmend'), type: 'muted' }
        ]
      }
      // Build the suggestions from what the file actually supports.
      const ways = []
      if (node.crackable !== false) ways.push(ctx.t('way.crack'))
      if (node.decryptTarget) ways.push(ctx.t('way.decrypt'))
      if (node.password) ways.push(ctx.t('way.unlock'))
      const hint = ways.length
        ? ctx.t('cat.hint.try', { ways: ways.join(ctx.t('way.or')) })
        : ctx.t('cat.hint.none')
      return [
        { text: ctx.t('cat.denied', { path }), type: 'err' },
        { text: hint, type: 'muted' }
      ]
    }
    // Cinematic read: hand off to the file-viewer popup (Terminal intercepts
    // this directive). The content itself is rendered by the viewer via
    // renderFileContent, so nothing prints inline.
    return [{ type: 'fileview', path, node }]
  },

  scenario: (ctx) => {
    const action = ctx.args[0]
    const ids = ctx.scenarioIds ?? []
    if (!action || action === 'status') {
      return [
        { text: ctx.t('scenario.current', { id: ctx.theme.scenarioId ?? ctx.t('scenario.none') }), type: 'ok' },
        ctx.theme.scenarioName
          ? { text: `  ${ctx.theme.scenarioName}`, type: 'muted' }
          : { text: ctx.t('scenario.usage'), type: 'muted' }
      ]
    }
    if (action === 'list') {
      if (ids.length === 0)
        return [{ text: ctx.t('scenario.empty'), type: 'muted' }]
      return [
        { text: ctx.t('scenario.listhead', { name: ctx.theme.name }), type: 'ok' },
        ...ids.map((id) => ({
          text: `  ${id}${id === ctx.theme.scenarioId ? ctx.t('scenario.current.tag') : ''}`,
          type: id === ctx.theme.scenarioId ? 'ok' : 'normal'
        }))
      ]
    }
    if (action === 'load') {
      const id = ctx.args[1]
      if (!id) return [{ text: ctx.t('scenario.load.missing'), type: 'err' }]
      if (!ids.includes(id))
        return [
          { text: ctx.t('scenario.unknownid', { id }), type: 'err' },
          { text: ctx.t('scenario.available', { ids: ids.join(', ') }), type: 'muted' }
        ]
      ctx.switchScenario?.(id)
      return []
    }
    return [{ text: ctx.t('scenario.unknownaction', { action }), type: 'err' }]
  },

  volume: (ctx) => {
    const arg = ctx.args[0]
    if (!arg) {
      return [
        {
          text: ctx.t('volume.status', {
            state: audioIsMuted() ? ctx.t('volume.muted') : Math.round(audioGetVolume() * 100) + '%'
          })
        },
        { text: ctx.t('volume.usage'), type: 'muted' }
      ]
    }
    if (arg === 'mute') {
      audioSetMuted(true)
      localStorage.setItem('tirpg.muted', 'true')
      return [{ text: ctx.t('volume.didmute'), type: 'muted' }]
    }
    if (arg === 'unmute') {
      audioSetMuted(false)
      localStorage.setItem('tirpg.muted', 'false')
      return [{ text: ctx.t('volume.didunmute'), type: 'ok' }]
    }
    const n = parseInt(arg, 10)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return [{ text: ctx.t('volume.range'), type: 'err' }]
    }
    audioSetVolume(n / 100)
    localStorage.setItem('tirpg.volume', String(n / 100))
    return [{ text: ctx.t('volume.set', { n }), type: 'ok' }]
  },

  grep: (ctx) => {
    const term = ctx.args[0]
    if (!term) return [{ text: ctx.t('grep.usage'), type: 'err' }]
    const scope = ctx.args[1] ? normalizePath(ctx.cwd, ctx.args[1]) : '/'
    const inScope = (p) => scope === '/' || p === scope || p.startsWith(scope + '/')
    const needle = term.toLowerCase()
    const out = []
    let lockedSkipped = 0
    for (const [p, node] of Object.entries(ctx.fs)) {
      if (node?.type !== 'file' || !inScope(p)) continue
      const locked = node.locked && !ctx.unlocked?.has(p)
      if (locked && !ctx.gmMode) {
        if ((node.content ?? '').toLowerCase().includes(needle)) lockedSkipped++
        continue
      }
      for (const line of (node.content ?? '').split('\n')) {
        if (line.toLowerCase().includes(needle)) {
          out.push({ text: `${p}: ${line.trim()}` })
        }
      }
    }
    if (out.length === 0 && lockedSkipped === 0)
      return [{ text: ctx.t('grep.nomatch', { term }), type: 'muted' }]
    if (lockedSkipped > 0)
      out.push({ text: ctx.t('grep.locked', { n: lockedSkipped }), type: 'muted' })
    return out
  },

  find: (ctx) => {
    const pat = ctx.args[0]
    if (!pat) return [{ text: ctx.t('find.usage'), type: 'err' }]
    const needle = pat.toLowerCase()
    const out = []
    for (const [p, node] of Object.entries(ctx.fs)) {
      if (p === '/') continue
      const name = p.split('/').pop()
      if (name.toLowerCase().includes(needle)) {
        const locked = node.locked && !ctx.unlocked?.has(p)
        out.push({
          text: node.type === 'dir' ? `${p}/` : locked ? `${p} [${ctx.t('tag.locked')}]` : p,
          type: node.type === 'dir' ? 'ok' : locked ? 'muted' : 'normal'
        })
      }
    }
    return out.length
      ? out.sort((a, b) => a.text.localeCompare(b.text))
      : [{ text: ctx.t('find.nomatch', { pat }), type: 'muted' }]
  },

  hum: (ctx) => {
    const arg = ctx.args[0]
    const turnOn = arg === 'on' || (!arg && !audioIsHumOn())
    if (arg && arg !== 'on' && arg !== 'off')
      return [{ text: ctx.t('hum.usage'), type: 'err' }]
    if (turnOn) {
      audioStartHum(ctx.theme.sounds?.hum)
      localStorage.setItem('tirpg.hum', 'on')
      return [{ text: ctx.t('hum.on'), type: 'ok' }]
    }
    audioStopHum()
    localStorage.setItem('tirpg.hum', 'off')
    return [{ text: ctx.t('hum.off'), type: 'muted' }]
  },

  // Dramatic self-destruct popup (countdown + OVERRIDE code). Configured
  // via theme.selfDestruct (scenario or skin). `destruct` is an alias.
  selfdestruct: (ctx) => {
    ctx.openSelfDestruct?.(ctx.theme.selfDestruct ?? {})
    return []
  },
  destruct: (ctx) => {
    ctx.openSelfDestruct?.(ctx.theme.selfDestruct ?? {})
    return []
  },

  // Hidden — GM prep dump of every locked file's secrets. GM mode only.
  gmsheet: (ctx) => {
    if (!ctx.gmMode)
      return [{ text: ctx.t('gmsheet.norequire'), type: 'err' }]
    const locked = Object.entries(ctx.fs).filter(
      ([, n]) => n?.type === 'file' && n.locked
    )
    const out = [
      { text: ctx.t('gmsheet.head', { name: ctx.theme.scenarioName ?? ctx.theme.scenarioId ?? ctx.theme.name }), type: 'ok' }
    ]
    if (locked.length === 0) {
      out.push({ text: ctx.t('gmsheet.empty'), type: 'muted' })
      return out
    }
    for (const [p, n] of locked.sort((a, b) => a[0].localeCompare(b[0]))) {
      const parts = []
      if (n.password) parts.push(`pwd:${n.password}`)
      if (n.crackDC != null) parts.push(`DC:${n.crackDC}`)
      if (n.crackable === false) parts.push('nocrack')
      if (n.checkDC != null) parts.push(`checkDC:${n.checkDC}`)
      const word = ctx.resolveDecryptTarget?.(p, n) ?? n.decryptTarget
      if (word) parts.push(`decryptWord:${word}`)
      if (n.tracer && ctx.theme.tracer) {
        const w = n.tracerSeconds ?? ctx.theme.tracer.seconds ?? 30
        parts.push(`tracer:${w}s`)
      }
      if (n.reveals) parts.push(`reveals:${n.reveals}`)
      out.push({ text: `  ${p}  [${parts.join(' ')}]`, type: 'muted' })
    }
    return out
  },

  // Hidden — toggles GM mode. Not in `help`. Same as Ctrl+Shift+G.
  gm: (ctx) => {
    ctx.toggleGm?.()
    const next = !ctx.gmMode
    return [
      {
        text: next ? ctx.t('gm.on') : ctx.t('gm.off'),
        type: next ? 'ok' : 'muted'
      }
    ]
  },

  theme: (ctx) => {
    const id = ctx.args[0]
    if (!id) {
      return [
        { text: ctx.t('theme.head') },
        ...ctx.themes.map((t) => ({
          text: `  ${t.id.padEnd(10)} ${t.name}`,
          type: t.id === ctx.theme.id ? 'ok' : 'normal'
        })),
        { text: ctx.t('theme.usage'), type: 'muted' }
      ]
    }
    const ok = ctx.switchTheme(id)
    if (!ok) return [{ text: ctx.t('theme.unknown', { id }), type: 'err' }]
    return []
  },

  crack: (ctx) => {
    if (!ctx.args[0]) return [{ text: ctx.t('crack.missing'), type: 'err' }]
    const { path, node } = resolveTarget(ctx, ctx.args[0])
    if (!node) return [{ text: ctx.t('crack.nofile', { path }), type: 'err' }]
    if (node.type !== 'file')
      return [{ text: ctx.t('crack.isdir', { path }), type: 'err' }]
    if (!node.locked || ctx.unlocked?.has(path))
      return [{ text: ctx.t('crack.notenc', { path }), type: 'muted' }]
    if (node.crackable === false) {
      const msg = node.crackFailMessage ?? ctx.t('crack.hardened')
      const watched = !!(node.tracer && ctx.theme.tracer)
      const secs = watched
        ? node.tracerNocrackSeconds ?? ctx.theme.tracer.nocrackSeconds ?? 5
        : null
      const label = watched ? ctx.theme.tracer.label ?? 'TRACE' : null
      // Show the failure as a quick popup; the tracer trip + history record
      // happen only after the player dismisses it. The popup is the player's
      // beat of "this didn't work" without the trace stealing seconds
      // mid-read.
      return [
        {
          type: 'failure',
          message: msg,
          tracerTrip: watched ? { seconds: secs } : null,
          historyLines: watched
            ? [
                { text: msg, type: 'err' },
                { text: ctx.t('crack.intrusion', { label, secs }), type: 'err' }
              ]
            : [{ text: msg, type: 'err' }]
        }
      ]
    }
    // Difficulty check: GM set a crackDC. Player rolls and enters the
    // result in a dialog; the modal handler in Terminal does the compare.
    if (node.crackDC != null) {
      const max = node.crackAttempts ?? 3
      const used = ctx.crackAttempts?.get(path) ?? 0
      if (used >= max) {
        return [
          { text: ctx.t('crack.lockedout', { path }), type: 'err' },
          { text: ctx.t('crack.lockedout.hint'), type: 'muted' }
        ]
      }
      ctx.openCrackPrompt?.(path, node)
      return [
        { text: ctx.t('crack.protected', { path }), type: 'muted' }
      ]
    }
    // On success, also hand the freshly-cracked file to the cat popup so the
    // player sees what they just unlocked without having to type `cat`.
    const onUnlock = (p) => {
      ctx.unlock?.(p)
      ctx.openFileViewer?.(p, node)
    }
    return buildCrackLines(ctx.theme, path, node, onUnlock, ctx.fs, ctx.t)
  },

  // `unlock <file> [key]` — apply a known password. Omit the key for the
  // secure dialog. (This is the classic "decrypt" behavior.)
  unlock: (ctx) => passwordUnlock(ctx, 'unlock'),

  // `decrypt <file>` — discover the key via a Wordle-style minigame. The game
  // is available when `decryptGame` says so (defaulting on for nocrack files);
  // otherwise the cipher is too strong to break here (recover the key and use
  // `unlock`). The target word is chosen at load (see themes/index.js).
  decrypt: (ctx) => {
    const [file] = ctx.args
    if (!file) {
      return [
        { text: ctx.t('decrypt.usage'), type: 'err' },
        { text: ctx.t('decrypt.usage.hint'), type: 'muted' }
      ]
    }
    const { path, node } = resolveTarget(ctx, file)
    if (!node) return [{ text: ctx.t('decrypt.nofile', { path }), type: 'err' }]
    if (node.type !== 'file')
      return [{ text: ctx.t('decrypt.isdir', { path }), type: 'err' }]
    if (!node.locked || ctx.unlocked?.has(path))
      return [{ text: ctx.t('decrypt.notenc', { path }), type: 'muted' }]
    if (node.decryptTarget) {
      ctx.openDecryptGame?.(path, node)
      return [{ text: ctx.t('decrypt.running', { path }), type: 'muted' }]
    }
    return [
      { text: ctx.t('decrypt.toohigh', { path }), type: 'err' },
      { text: ctx.t('decrypt.toohigh.hint'), type: 'muted' }
    ]
  },

  query: (ctx) => runDialog(ctx),
  ask: (ctx) => runDialog(ctx)
}

// Conversational interface ("talk to the ship AI"). Matches the player's
// words against a GM-authored Q&A map in `theme.dialog`. Falls back to a
// scenario's static `query` command when no dialog is configured, so the
// built-in never clobbers an existing gag.
function toDialogLines(val, type) {
  return (Array.isArray(val) ? val : [val])
    .filter((v) => v != null)
    .map((v) => (typeof v === 'string' ? { text: v, type } : v))
}

function runDialog(ctx) {
  const dialog = ctx.theme.dialog
  if (!dialog) {
    const custom = ctx.theme.commands?.query
    if (custom) return makeCustom(custom)()
    return [{ text: ctx.t('dialog.none'), type: 'muted' }]
  }
  const q = ctx.args.join(' ').trim().toLowerCase()
  if (!q) return toDialogLines(dialog.empty ?? ctx.t('dialog.empty'), 'muted')

  const hit = (dialog.responses ?? []).find((r) =>
    (Array.isArray(r.match) ? r.match : [r.match])
      .filter(Boolean)
      .some((m) => q.includes(String(m).toLowerCase()))
  )
  const head = dialog.thinking ? toDialogLines(dialog.thinking, 'muted') : []
  const body = hit
    ? toDialogLines(hit.lines, hit.type ?? 'normal')
    : toDialogLines(dialog.fallback ?? ctx.t('dialog.fallback'), 'err')
  return [...head, ...body]
}

// Unlock chains: when a file declares `reveals` (one path, or several
// comma-separated), surface the keys of those files on unlock. Turns
// isolated locks into a puzzle chain — crack A to learn B's key.
function buildRevealLines(fs, node, t = makeT('en')) {
  if (!node?.reveals) return []
  const paths = String(node.reveals)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const out = []
  for (const p of paths) {
    const target = getNode(fs, p)
    if (target?.password) {
      out.push({ text: t('reveal.key', { path: p }), type: 'ok' })
      out.push({ text: `    ${target.password}`, type: 'ok' })
    } else {
      out.push({ text: t('reveal.xref', { path: p }), type: 'muted' })
    }
  }
  return out
}

// onUnlock triggers: a scenario may map a path to a list of lines (in
// theme.events) that play right after the file opens — an alarm, a
// villain's message, even a `countdown`. Turns unlocking into an event.
function buildEventLines(theme, path) {
  const ev = theme.events?.[path]
  if (!Array.isArray(ev)) return []
  return ev.map((l) => (typeof l === 'string' ? { text: l } : l))
}

// The terminal "tail" that follows a successful unlock once the cinematic
// (progress bar, or the decrypt reveal sequence) is done: any recovered-key
// reveal chain plus scenario onUnlock events. Shared so the decrypt minigame
// win can post the same lines without re-running the progress bar.
export function buildUnlockExtras(theme, path, node, t = makeT('en')) {
  return [
    ...buildRevealLines(theme.filesystem ?? {}, node, t),
    ...buildEventLines(theme, path)
  ]
}

// Render a `check` scan. `tier` scales detail with the scan roll:
//   precise   — full posture (window, and DC/penalty/pwd in GM mode)
//   ambiguous — hedged: "possible monitoring?", no fine numbers
//   fail      — inconclusive, no reliable data
//   false     — a misleading reading (reports the OPPOSITE surveillance);
//               only used when checkMisleadsOnFail is enabled
export function buildCheckLines(theme, path, node, { tier = 'precise', locked = false, gm = false, t = makeT('en') } = {}) {
  const out = [{ text: t('scan.title', { path }), type: 'ok' }]
  if (!locked) {
    out.push({ text: t('scan.open'), type: 'muted' })
    return out
  }
  if (tier === 'fail') {
    out.push({ text: t('scan.inconclusive'), type: 'muted' })
    return out
  }
  const watched = !!(node.tracer && theme.tracer)
  const label = theme.tracer?.label ?? 'TRACE'
  out.push({ text: t('scan.encrypted') })

  if (tier === 'false') {
    // Deliberately wrong: invert the surveillance reading.
    out.push({ text: t('scan.bf.possible'), type: 'muted' })
    out.push(
      watched
        ? { text: t('scan.surv.clear'), type: 'muted' }
        : { text: t('scan.surv.monitored', { label }), type: 'err' }
    )
    out.push({ text: t('scan.lowconf'), type: 'muted' })
    return out
  }

  if (node.crackable === false) {
    out.push({ text: t('scan.bf.hardened'), type: 'muted' })
  } else if (node.crackDC != null) {
    const dc = gm ? ` (DC ${node.crackDC})` : ''
    out.push({ text: t('scan.bf.check', { dc }), type: 'muted' })
  } else {
    out.push({ text: t('scan.bf.possible'), type: 'muted' })
  }

  if (tier === 'ambiguous') {
    out.push({
      text: watched ? t('scan.surv.noisy.maybe') : t('scan.surv.noisy.none'),
      type: 'muted'
    })
    return out
  }

  // precise
  if (watched) {
    const secs = node.tracerSeconds ?? theme.tracer.seconds ?? 30
    out.push({ text: t('scan.surv.window', { label, secs }), type: 'err' })
    if (gm) {
      const penalty = node.tracerPenalty ?? theme.tracer.penalty ?? 7
      const startAfter = node.tracerStartAfter ?? theme.tracer.startAfter ?? 0
      out.push({ text: t('scan.gm.tracer', { penalty, startAfter }), type: 'muted' })
    }
  } else {
    out.push({ text: t('scan.surv.clear'), type: 'muted' })
  }
  if (gm && node.password) out.push({ text: t('scan.gm.pwd', { password: node.password }), type: 'muted' })
  return out
}

// Shared password-unlock flow for `unlock` (and `decrypt` fallback).
function passwordUnlock(ctx, cmd) {
  const t = ctx.t
  const [file, ...rest] = ctx.args
  const key = rest.join(' ')
  if (!file) {
    return [
      { text: t('unlock.usage', { cmd }), type: 'err' },
      { text: t('unlock.usage.hint'), type: 'muted' }
    ]
  }
  const { path, node } = resolveTarget(ctx, file)
  if (!node) return [{ text: t('unlock.nofile', { cmd, path }), type: 'err' }]
  if (node.type !== 'file')
    return [{ text: t('unlock.isdir', { cmd, path }), type: 'err' }]
  if (!node.locked || ctx.unlocked?.has(path))
    return [{ text: t('unlock.notenc', { cmd, path }), type: 'muted' }]
  if (!node.password)
    return [
      { text: t('unlock.nopwd', { cmd, path }), type: 'err' },
      { text: t('unlock.nopwd.hint'), type: 'muted' }
    ]
  // Cinematic path: no key on the command line -> open the modal.
  if (!key) {
    ctx.openPasswordPrompt?.(path, node)
    return [{ text: t('unlock.authreq', { path }), type: 'muted' }]
  }
  // Inline path (script/power-user): key already provided.
  if (key === node.password && node.tracer) ctx.evadeTracer?.(node)
  // On success, surface the freshly-unlocked file in the cat popup so the
  // player can read it immediately.
  const onUnlock = (p) => {
    ctx.unlock?.(p)
    ctx.openFileViewer?.(p, node)
  }
  return buildDecryptLines(ctx.theme, path, node, key, onUnlock, ctx.fs, t)
}

// The brute-force success sequence. Used by the plain crack flow and by
// the difficulty-check flow (after the roll passes, in Terminal).
export function buildCrackLines(theme, path, node, unlock, fs, t = makeT('en')) {
  const duration = node.crackTime ?? theme.locks?.crackDefault ?? 5000
  const label = node.lockLabel ?? theme.locks?.crackLabel ?? 'BRUTE-FORCING'
  const success = node.crackSuccessMessage ?? t('crack.success', { path })
  return [
    { text: t('crack.initiate', { path }), type: 'muted' },
    { type: 'progress', duration, label, onComplete: () => unlock(path) },
    { text: success, type: 'ok' },
    { text: t('crack.cathint', { path }), type: 'muted' },
    ...buildRevealLines(fs, node, t),
    ...buildEventLines(theme, path)
  ]
}

// Shared between the inline (commands.js) and modal (Terminal.jsx) flows.
export function buildDecryptLines(theme, path, node, key, unlock, fs, t = makeT('en')) {
  if (key !== node.password) {
    // Wrong key surfaces as a quick failure popup so the player gets a clear
    // beat of "rejected" — Terminal turns this directive into the popup and
    // pushes the history record only when it's dismissed.
    return [
      {
        type: 'failure',
        message: t('decrypt.rejected'),
        hint: t('decrypt.flagged'),
        historyLines: [
          { text: t('decrypt.rejected'), type: 'err' },
          { text: t('decrypt.flagged'), type: 'muted' }
        ]
      }
    ]
  }
  const duration = node.decryptTime ?? theme.locks?.decryptDefault ?? 1500
  const label =
    node.decryptLabel ?? theme.locks?.decryptLabel ?? 'DECRYPTING'
  return [
    { text: t('decrypt.keyok'), type: 'muted' },
    {
      type: 'progress',
      duration,
      label,
      onComplete: () => unlock(path)
    },
    { text: t('decrypt.done', { path }), type: 'ok' },
    ...buildRevealLines(fs, node, t),
    ...buildEventLines(theme, path)
  ]
}

export function runCommand(input, ctx) {
  const trimmed = input.trim()
  if (!trimmed) return []
  const t = ctx.t ?? makeT(ctx.lang)
  const [typed, ...args] = trimmed.split(/\s+/)
  // Themed command names: a theme/scenario may alias its own verb onto a
  // built-in (e.g. `auspex` -> `check`, `audit` -> `check`). A static
  // custom command of the same name still wins over the alias.
  const customs = ctx.theme.commands ?? {}
  const name = !customs[typed] && ctx.theme.aliases?.[typed] ? ctx.theme.aliases[typed] : typed
  const handler = COMMANDS[name] ?? makeCustom(customs[name])
  if (!handler) {
    const hint = ctx.theme.unknownHint ?? t('cmd.hint')
    return [
      { text: t('cmd.notfound', { name }), type: 'err' },
      { text: hint, type: 'muted' }
    ]
  }
  return handler({ ...ctx, args, raw: trimmed, t })
}

function makeCustom(spec) {
  if (!spec) return null
  return () =>
    spec.map((line) => (typeof line === 'string' ? { text: line } : line))
}
