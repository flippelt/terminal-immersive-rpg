import { normalizePath, getNode, listDir } from './filesystem.js'
import { renderMarkdown } from './markdown.js'
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
//   args, raw, theme, themes, fs, cwd, unlocked,
//   setCwd, clear, switchTheme, reboot, unlock
// }

const help = (extra = []) => [
  { text: 'COMMANDS', type: 'ok' },
  { text: '  help                  show this list' },
  { text: '  ls [path]             list directory' },
  { text: '  cd <path>             change directory' },
  { text: '  cat <file>            print file contents' },
  { text: '  grep <term> [path]    search file contents' },
  { text: '  find <name>           search filenames' },
  { text: '  pwd                   working directory' },
  { text: '  whoami                current operator' },
  { text: '  date                  system clock' },
  { text: '  clear                 wipe screen' },
  { text: '  motd                  reprint banner' },
  { text: '  theme [id]            switch system' },
  { text: '  scenario [list|load]  switch campaign within a system' },
  { text: '  loadscenario [url]    load a custom scenario (URL or paste JSON)' },
  { text: '  sharescenario         copy a link that embeds the loaded scenario' },
  { text: '  reboot                cold restart' },
  { text: '  reset                 wipe this scenario’s progress' },
  { text: '  check <file>          scan a file: lock, brute-force & surveillance' },
  { text: '  crack <file>          brute-force a locked file' },
  { text: '  decrypt <file> <key>  unlock with password' },
  { text: '  volume [0-100|mute]   audio level' },
  { text: '  hum [on|off]          ambient CRT hum' },
  ...extra.map((line) => ({ text: line, type: 'muted' }))
]

// .md files render through the markdown layer; everything else (.log,
// .dat, ...) prints raw, like a data dump. A file with an `image:`
// front-matter key (a URL or data URI) renders that picture, CRT-filtered,
// above its text — Esper photos, maps, mugshots.
function renderFileContent(path, node) {
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
  help: (ctx) => help(ctx.theme.extraHelp ?? []),
  '?': (ctx) => help(ctx.theme.extraHelp ?? []),

  clear: (ctx) => {
    ctx.clear()
    return []
  },

  pwd: (ctx) => [{ text: ctx.cwd }],

  whoami: (ctx) => [{ text: ctx.theme.user ?? 'operator' }],

  date: () => [{ text: new Date().toUTCString() }],

  motd: (ctx) =>
    ctx.theme.motd?.map((t) => ({ text: t })) ?? [{ text: '(no motd)' }],

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
        return [{ text: 'paste a scenario bundle (JSON) into the dialog.', type: 'muted' }]
      }
      return [{ text: 'loadscenario: provide a URL or paste JSON', type: 'err' }]
    }
    if (!/^https?:\/\//i.test(url)) {
      return [{ text: 'loadscenario: URL must start with http(s)://', type: 'err' }]
    }
    ctx.loadScenarioUrl?.(url)
    return [{ text: `fetching scenario from ${url} ...`, type: 'muted' }]
  },

  sharescenario: (ctx) => {
    const url = ctx.shareScenario?.()
    if (!url) {
      return [{ text: 'sharescenario: load a custom scenario first (`loadscenario`).', type: 'err' }]
    }
    return [
      { text: 'shareable link (copied to clipboard if allowed):', type: 'ok' },
      { text: url, type: 'muted' }
    ]
  },

  ls: (ctx) => {
    const target = ctx.args[0] ? normalizePath(ctx.cwd, ctx.args[0]) : ctx.cwd
    const entries = listDir(ctx.fs, target)
    if (!entries) return [{ text: `ls: ${target}: not a directory`, type: 'err' }]
    if (entries.length === 0) return [{ text: '(empty)', type: 'muted' }]
    return entries.map((e) => {
      const child = getNode(ctx.fs, normalizePath(target, e.name))
      const locked = child?.locked && !ctx.unlocked?.has(normalizePath(target, e.name))
      let suffix = ''
      if (e.type === 'dir') suffix = '/'
      else if (locked) {
        if (ctx.gmMode) {
          const parts = ['LOCKED']
          if (child.password) parts.push(`pwd:${child.password}`)
          if (child.crackDC != null) parts.push(`DC:${child.crackDC}`)
          if (child.crackable === false) parts.push('nocrack')
          suffix = ` [${parts.join(' ')}]`
        } else {
          suffix = ' [LOCKED]'
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
    if (!node) return [{ text: `cd: ${target}: no such directory`, type: 'err' }]
    if (node.type !== 'dir')
      return [{ text: `cd: ${target}: not a directory`, type: 'err' }]
    ctx.setCwd(target)
    return []
  },

  // Recon: read a file's security posture without touching it — whether it
  // is encrypted, brute-forceable, and (crucially) whether it is *watched*
  // (arms the tracer on intrusion). Passive: never trips anything.
  check: (ctx) => {
    if (!ctx.args[0]) return [{ text: 'check: missing operand', type: 'err' }]
    const { path, node } = resolveTarget(ctx, ctx.args[0])
    if (!node) return [{ text: `check: ${path}: no such file`, type: 'err' }]
    if (node.type !== 'file')
      return [{ text: `check: ${path}: is a directory`, type: 'err' }]

    const out = [{ text: `SECURITY SCAN // ${path}`, type: 'ok' }]
    if (!isLocked(node, ctx, path)) {
      out.push({ text: '  state: OPEN — no protection detected', type: 'muted' })
      return out
    }
    out.push({ text: '  state: ENCRYPTED' })
    if (node.crackable === false) {
      out.push({ text: '  brute-force: HARDENED — password required', type: 'muted' })
    } else if (node.crackDC != null) {
      const dc = ctx.gmMode ? ` (DC ${node.crackDC})` : ''
      out.push({ text: `  brute-force: possible — difficulty check${dc}`, type: 'muted' })
    } else {
      out.push({ text: '  brute-force: possible', type: 'muted' })
    }
    if (node.tracer && ctx.theme.tracer) {
      const tr = ctx.theme.tracer
      const label = tr.label ?? 'TRACE'
      const secs = node.tracerSeconds ?? tr.seconds ?? 30
      out.push({ text: `  surveillance: MONITORED — ${label} (${secs}s window) on intrusion ⚠`, type: 'err' })
      if (ctx.gmMode) {
        const penalty = node.tracerPenalty ?? tr.penalty ?? 7
        const startAfter = node.tracerStartAfter ?? tr.startAfter ?? 0
        out.push({ text: `  ★ tracer: -${penalty}s/fail · arms after ${startAfter} fail(s)`, type: 'muted' })
      }
    } else {
      out.push({ text: '  surveillance: clear', type: 'muted' })
    }
    if (ctx.gmMode && node.password) {
      out.push({ text: `  ★ pwd:${node.password}`, type: 'muted' })
    }
    return out
  },

  cat: (ctx) => {
    if (!ctx.args[0]) return [{ text: 'cat: missing operand', type: 'err' }]
    const { path, node } = resolveTarget(ctx, ctx.args[0])
    if (!node) return [{ text: `cat: ${path}: no such file`, type: 'err' }]
    if (node.type !== 'file')
      return [{ text: `cat: ${path}: is a directory`, type: 'err' }]
    if (isLocked(node, ctx, path)) {
      // GM mode: reveal locked content inline with a clear marker.
      if (ctx.gmMode) {
        const meta = []
        if (node.password) meta.push(`pwd:${node.password}`)
        if (node.crackDC != null) meta.push(`DC:${node.crackDC}`)
        if (node.crackable === false) meta.push('nocrack')
        return [
          {
            text: `★ GM preview // ${path} [LOCKED${meta.length ? ' ' + meta.join(' ') : ''}]`,
            type: 'muted'
          },
          ...renderFileContent(path, node),
          { text: '★ end preview (file remains locked for players)', type: 'muted' }
        ]
      }
      const hint =
        node.password && node.crackable !== false
          ? 'try: `crack <file>` or `decrypt <file> <key>`'
          : node.password
            ? 'try: `decrypt <file> <key>`'
            : 'try: `crack <file>`'
      return [
        { text: `cat: ${path}: ACCESS DENIED`, type: 'err' },
        { text: hint, type: 'muted' }
      ]
    }
    return renderFileContent(path, node)
  },

  scenario: (ctx) => {
    const action = ctx.args[0]
    const ids = ctx.scenarioIds ?? []
    if (!action || action === 'status') {
      return [
        { text: `current scenario: ${ctx.theme.scenarioId ?? '(none)'}`, type: 'ok' },
        ctx.theme.scenarioName
          ? { text: `  ${ctx.theme.scenarioName}`, type: 'muted' }
          : { text: 'usage: scenario list | scenario load <id>', type: 'muted' }
      ]
    }
    if (action === 'list') {
      if (ids.length === 0)
        return [{ text: 'no scenarios registered for this system.', type: 'muted' }]
      return [
        { text: `scenarios for ${ctx.theme.name}:`, type: 'ok' },
        ...ids.map((id) => ({
          text: `  ${id}${id === ctx.theme.scenarioId ? '  (current)' : ''}`,
          type: id === ctx.theme.scenarioId ? 'ok' : 'normal'
        }))
      ]
    }
    if (action === 'load') {
      const id = ctx.args[1]
      if (!id) return [{ text: 'scenario load: missing scenario id', type: 'err' }]
      if (!ids.includes(id))
        return [
          { text: `scenario: unknown id "${id}"`, type: 'err' },
          { text: `available: ${ids.join(', ')}`, type: 'muted' }
        ]
      ctx.switchScenario?.(id)
      return []
    }
    return [{ text: `scenario: unknown action "${action}"`, type: 'err' }]
  },

  volume: (ctx) => {
    const arg = ctx.args[0]
    if (!arg) {
      return [
        {
          text: `audio: ${audioIsMuted() ? 'muted' : Math.round(audioGetVolume() * 100) + '%'}`
        },
        { text: 'usage: volume <0-100> | volume mute | volume unmute', type: 'muted' }
      ]
    }
    if (arg === 'mute') {
      audioSetMuted(true)
      localStorage.setItem('tirpg.muted', 'true')
      return [{ text: 'audio muted.', type: 'muted' }]
    }
    if (arg === 'unmute') {
      audioSetMuted(false)
      localStorage.setItem('tirpg.muted', 'false')
      return [{ text: 'audio unmuted.', type: 'ok' }]
    }
    const n = parseInt(arg, 10)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return [{ text: 'volume: expected 0-100', type: 'err' }]
    }
    audioSetVolume(n / 100)
    localStorage.setItem('tirpg.volume', String(n / 100))
    return [{ text: `volume: ${n}%`, type: 'ok' }]
  },

  grep: (ctx) => {
    const term = ctx.args[0]
    if (!term) return [{ text: 'grep: usage: grep <term> [path]', type: 'err' }]
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
      return [{ text: `grep: no matches for "${term}"`, type: 'muted' }]
    if (lockedSkipped > 0)
      out.push({ text: `grep: ${lockedSkipped} match(es) inside locked file(s)`, type: 'muted' })
    return out
  },

  find: (ctx) => {
    const pat = ctx.args[0]
    if (!pat) return [{ text: 'find: usage: find <name>', type: 'err' }]
    const needle = pat.toLowerCase()
    const out = []
    for (const [p, node] of Object.entries(ctx.fs)) {
      if (p === '/') continue
      const name = p.split('/').pop()
      if (name.toLowerCase().includes(needle)) {
        const locked = node.locked && !ctx.unlocked?.has(p)
        out.push({
          text: node.type === 'dir' ? `${p}/` : locked ? `${p} [LOCKED]` : p,
          type: node.type === 'dir' ? 'ok' : locked ? 'muted' : 'normal'
        })
      }
    }
    return out.length
      ? out.sort((a, b) => a.text.localeCompare(b.text))
      : [{ text: `find: no files matching "${pat}"`, type: 'muted' }]
  },

  hum: (ctx) => {
    const arg = ctx.args[0]
    const turnOn = arg === 'on' || (!arg && !audioIsHumOn())
    if (arg && arg !== 'on' && arg !== 'off')
      return [{ text: 'hum: usage: hum [on|off]', type: 'err' }]
    if (turnOn) {
      audioStartHum(ctx.theme.sounds?.hum)
      localStorage.setItem('tirpg.hum', 'on')
      return [{ text: 'ambient hum: on', type: 'ok' }]
    }
    audioStopHum()
    localStorage.setItem('tirpg.hum', 'off')
    return [{ text: 'ambient hum: off', type: 'muted' }]
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
      return [{ text: 'gmsheet: GM mode required (Ctrl+Shift+G)', type: 'err' }]
    const locked = Object.entries(ctx.fs).filter(
      ([, n]) => n?.type === 'file' && n.locked
    )
    const out = [
      { text: `★ GM SHEET // ${ctx.theme.scenarioName ?? ctx.theme.scenarioId ?? ctx.theme.name}`, type: 'ok' }
    ]
    if (locked.length === 0) {
      out.push({ text: '  (no locked files in this scenario)', type: 'muted' })
      return out
    }
    for (const [p, n] of locked.sort((a, b) => a[0].localeCompare(b[0]))) {
      const parts = []
      if (n.password) parts.push(`pwd:${n.password}`)
      if (n.crackDC != null) parts.push(`DC:${n.crackDC}`)
      if (n.crackable === false) parts.push('nocrack')
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
        text: next ? '★ GM mode ON — passwords revealed in ls/cat' : 'GM mode OFF',
        type: next ? 'ok' : 'muted'
      }
    ]
  },

  theme: (ctx) => {
    const id = ctx.args[0]
    if (!id) {
      return [
        { text: 'available systems:' },
        ...ctx.themes.map((t) => ({
          text: `  ${t.id.padEnd(10)} ${t.name}`,
          type: t.id === ctx.theme.id ? 'ok' : 'normal'
        })),
        { text: 'usage: theme <id>', type: 'muted' }
      ]
    }
    const ok = ctx.switchTheme(id)
    if (!ok) return [{ text: `theme: unknown system "${id}"`, type: 'err' }]
    return []
  },

  crack: (ctx) => {
    if (!ctx.args[0]) return [{ text: 'crack: missing operand', type: 'err' }]
    const { path, node } = resolveTarget(ctx, ctx.args[0])
    if (!node) return [{ text: `crack: ${path}: no such file`, type: 'err' }]
    if (node.type !== 'file')
      return [{ text: `crack: ${path}: is a directory`, type: 'err' }]
    if (!node.locked || ctx.unlocked?.has(path))
      return [{ text: `crack: ${path}: file is not encrypted`, type: 'muted' }]
    if (node.crackable === false) {
      const msg =
        node.crackFailMessage ??
        'crack: encryption hardened — password required.'
      const lines = [{ text: msg, type: 'err' }]
      // Brute-forcing a hardened, *watched* file trips a fast trace.
      if (node.tracer && ctx.theme.tracer) {
        const secs = node.tracerNocrackSeconds ?? ctx.theme.tracer.nocrackSeconds ?? 5
        ctx.tripTracer?.(secs)
        lines.push({
          text: `>>> intrusion on hardened node logged — ${ctx.theme.tracer.label ?? 'TRACE'} active (${secs}s)`,
          type: 'err'
        })
      }
      return lines
    }
    // Difficulty check: GM set a crackDC. Player rolls and enters the
    // result in a dialog; the modal handler in Terminal does the compare.
    if (node.crackDC != null) {
      const max = node.crackAttempts ?? 3
      const used = ctx.crackAttempts?.get(path) ?? 0
      if (used >= max) {
        return [
          { text: `crack: ${path}: brute-force locked out`, type: 'err' },
          { text: 'too many failed attempts — password required (`decrypt`)', type: 'muted' }
        ]
      }
      ctx.openCrackPrompt?.(path, node)
      return [
        { text: `${path} — brute-force protected. enter your roll.`, type: 'muted' }
      ]
    }
    return buildCrackLines(ctx.theme, path, node, ctx.unlock, ctx.fs)
  },

  decrypt: (ctx) => {
    const [file, ...rest] = ctx.args
    const key = rest.join(' ')
    if (!file)
      return [
        { text: 'decrypt: usage: decrypt <file> [key]', type: 'err' },
        { text: '(omit key to be prompted by a secure dialog)', type: 'muted' }
      ]
    const { path, node } = resolveTarget(ctx, file)
    if (!node) return [{ text: `decrypt: ${path}: no such file`, type: 'err' }]
    if (node.type !== 'file')
      return [{ text: `decrypt: ${path}: is a directory`, type: 'err' }]
    if (!node.locked || ctx.unlocked?.has(path))
      return [{ text: `decrypt: ${path}: file is not encrypted`, type: 'muted' }]
    if (!node.password)
      return [
        { text: `decrypt: ${path}: no password-based encryption.`, type: 'err' },
        { text: 'try `crack` instead.', type: 'muted' }
      ]
    // Cinematic path: no key on the command line -> open the modal.
    if (!key) {
      ctx.openPasswordPrompt?.(path, node)
      return [
        { text: `${path} — encrypted. authentication required.`, type: 'muted' }
      ]
    }
    // Inline path (script/power-user): key already provided.
    return buildDecryptLines(ctx.theme, path, node, key, ctx.unlock, ctx.fs)
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
    return [{ text: 'query: no interface available on this system.', type: 'muted' }]
  }
  const q = ctx.args.join(' ').trim().toLowerCase()
  if (!q) return toDialogLines(dialog.empty ?? 'SPECIFY QUERY.', 'muted')

  const hit = (dialog.responses ?? []).find((r) =>
    (Array.isArray(r.match) ? r.match : [r.match])
      .filter(Boolean)
      .some((m) => q.includes(String(m).toLowerCase()))
  )
  const head = dialog.thinking ? toDialogLines(dialog.thinking, 'muted') : []
  const body = hit
    ? toDialogLines(hit.lines, hit.type ?? 'normal')
    : toDialogLines(dialog.fallback ?? 'INSUFFICIENT DATA. REPHRASE QUERY.', 'err')
  return [...head, ...body]
}

// Unlock chains: when a file declares `reveals` (one path, or several
// comma-separated), surface the keys of those files on unlock. Turns
// isolated locks into a puzzle chain — crack A to learn B's key.
function buildRevealLines(fs, node) {
  if (!node?.reveals) return []
  const paths = String(node.reveals)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const out = []
  for (const p of paths) {
    const target = getNode(fs, p)
    if (target?.password) {
      out.push({ text: `>>> recovered access key for ${p}`, type: 'ok' })
      out.push({ text: `    ${target.password}`, type: 'ok' })
    } else {
      out.push({ text: `>>> cross-reference found: ${p}`, type: 'muted' })
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

// The brute-force success sequence. Used by the plain crack flow and by
// the difficulty-check flow (after the roll passes, in Terminal).
export function buildCrackLines(theme, path, node, unlock, fs) {
  const duration = node.crackTime ?? theme.locks?.crackDefault ?? 5000
  const label = node.lockLabel ?? theme.locks?.crackLabel ?? 'BRUTE-FORCING'
  const success = node.crackSuccessMessage ?? `ACCESS GRANTED — ${path}`
  return [
    { text: `initiating attack on ${path}...`, type: 'muted' },
    { type: 'progress', duration, label, onComplete: () => unlock(path) },
    { text: success, type: 'ok' },
    { text: `you can now run \`cat ${path}\`.`, type: 'muted' },
    ...buildRevealLines(fs, node),
    ...buildEventLines(theme, path)
  ]
}

// Shared between the inline (commands.js) and modal (Terminal.jsx) flows.
export function buildDecryptLines(theme, path, node, key, unlock, fs) {
  if (key !== node.password) {
    return [
      { text: 'decrypt: key rejected.', type: 'err' },
      { text: 'system flags this attempt.', type: 'muted' }
    ]
  }
  const duration = node.decryptTime ?? theme.locks?.decryptDefault ?? 1500
  const label =
    node.decryptLabel ?? theme.locks?.decryptLabel ?? 'DECRYPTING'
  return [
    { text: 'key accepted. applying...', type: 'muted' },
    {
      type: 'progress',
      duration,
      label,
      onComplete: () => unlock(path)
    },
    { text: `${path} decrypted.`, type: 'ok' },
    ...buildRevealLines(fs, node),
    ...buildEventLines(theme, path)
  ]
}

export function runCommand(input, ctx) {
  const trimmed = input.trim()
  if (!trimmed) return []
  const [typed, ...args] = trimmed.split(/\s+/)
  // Themed command names: a theme/scenario may alias its own verb onto a
  // built-in (e.g. `auspex` -> `check`, `audit` -> `check`). A static
  // custom command of the same name still wins over the alias.
  const customs = ctx.theme.commands ?? {}
  const name = !customs[typed] && ctx.theme.aliases?.[typed] ? ctx.theme.aliases[typed] : typed
  const handler = COMMANDS[name] ?? makeCustom(customs[name])
  if (!handler) {
    const hint = ctx.theme.unknownHint ?? 'type `help` for available commands.'
    return [
      { text: `command not found: ${name}`, type: 'err' },
      { text: hint, type: 'muted' }
    ]
  }
  return handler({ ...ctx, args, raw: trimmed })
}

function makeCustom(spec) {
  if (!spec) return null
  return () =>
    spec.map((line) => (typeof line === 'string' ? { text: line } : line))
}
