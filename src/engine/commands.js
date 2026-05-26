import { normalizePath, getNode, listDir } from './filesystem.js'

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
  { text: '  reboot                cold restart' },
  { text: '  crack <file>          brute-force a locked file' },
  { text: '  decrypt <file> <key>  unlock with password' },
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
      return {
        text: e.type === 'dir' ? `${e.name}/` : locked ? `${e.name} [LOCKED]` : e.name,
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
    if (!file || !key)
      return [
        { text: 'decrypt: usage: decrypt <file> <key>', type: 'err' }
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
    if (key !== node.password) {
      return [
        { text: 'decrypt: key rejected.', type: 'err' },
        { text: 'system flags this attempt.', type: 'muted' }
      ]
    }
    const duration = node.decryptTime ?? ctx.theme.locks?.decryptDefault ?? 1500
    const label =
      node.decryptLabel ?? ctx.theme.locks?.decryptLabel ?? 'DECRYPTING'
    return [
      { text: 'key accepted. applying...', type: 'muted' },
      {
        type: 'progress',
        duration,
        label,
        onComplete: () => ctx.unlock(path)
      },
      { text: `${path} decrypted.`, type: 'ok' }
    ]
  }
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
