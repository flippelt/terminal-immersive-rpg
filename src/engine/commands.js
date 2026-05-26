import { normalizePath, getNode, listDir } from './filesystem.js'
import {
  setVolume as audioSetVolume,
  setMuted as audioSetMuted,
  getVolume as audioGetVolume,
  isMuted as audioIsMuted
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
  { text: '  pwd                   working directory' },
  { text: '  whoami                current operator' },
  { text: '  date                  system clock' },
  { text: '  clear                 wipe screen' },
  { text: '  motd                  reprint banner' },
  { text: '  theme [id]            switch system' },
  { text: '  scenario [list|load]  switch campaign within a system' },
  { text: '  reboot                cold restart' },
  { text: '  crack <file>          brute-force a locked file' },
  { text: '  decrypt <file> <key>  unlock with password' },
  { text: '  volume [0-100|mute]   audio level' },
  ...extra.map((line) => ({ text: line, type: 'muted' }))
]

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
        if (node.crackable === false) meta.push('nocrack')
        return [
          {
            text: `★ GM preview // ${path} [LOCKED${meta.length ? ' ' + meta.join(' ') : ''}]`,
            type: 'muted'
          },
          ...(node.content ?? '').split('\n').map((text) => ({ text })),
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
    return (node.content ?? '').split('\n').map((text) => ({ text }))
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
      return [{ text: msg, type: 'err' }]
    }
    const duration = node.crackTime ?? ctx.theme.locks?.crackDefault ?? 5000
    const label =
      node.lockLabel ?? ctx.theme.locks?.crackLabel ?? 'BRUTE-FORCING'
    const success =
      node.crackSuccessMessage ?? `ACCESS GRANTED — ${path}`
    return [
      { text: `initiating attack on ${path}...`, type: 'muted' },
      {
        type: 'progress',
        duration,
        label,
        onComplete: () => ctx.unlock(path)
      },
      { text: success, type: 'ok' },
      { text: `you can now run \`cat ${path}\`.`, type: 'muted' }
    ]
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
    return buildDecryptLines(ctx.theme, path, node, key, ctx.unlock)
  }
}

// Shared between the inline (commands.js) and modal (Terminal.jsx) flows.
export function buildDecryptLines(theme, path, node, key, unlock) {
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
    { text: `${path} decrypted.`, type: 'ok' }
  ]
}

export function runCommand(input, ctx) {
  const trimmed = input.trim()
  if (!trimmed) return []
  const [name, ...args] = trimmed.split(/\s+/)
  const customs = ctx.theme.commands ?? {}
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
