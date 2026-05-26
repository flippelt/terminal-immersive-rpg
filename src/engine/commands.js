import { normalizePath, getNode, listDir } from './filesystem.js'

// Each command receives a `ctx` object and returns an array of "lines".
// A line is { text, type?, instant? }.
//   type: 'normal' | 'err' | 'ok' | 'muted' | 'user'
//   instant: skip typewriter animation for this line
//
// ctx = {
//   args, raw, theme, fs, cwd,
//   setCwd, setPrompt, clear, switchTheme, reboot
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
  { text: '  theme [id]            switch system (try: lancer alien br wh40k)' },
  { text: '  reboot                cold restart' },
  ...extra.map((line) => ({ text: line, type: 'muted' }))
]

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

  motd: (ctx) => ctx.theme.motd?.map((t) => ({ text: t })) ?? [{ text: '(no motd)' }],

  reboot: (ctx) => {
    ctx.reboot()
    return []
  },

  ls: (ctx) => {
    const target = ctx.args[0] ? normalizePath(ctx.cwd, ctx.args[0]) : ctx.cwd
    const entries = listDir(ctx.fs, target)
    if (!entries) return [{ text: `ls: ${target}: not a directory`, type: 'err' }]
    if (entries.length === 0) return [{ text: '(empty)', type: 'muted' }]
    return entries.map((e) => ({
      text: e.type === 'dir' ? `${e.name}/` : e.name,
      type: e.type === 'dir' ? 'ok' : 'normal'
    }))
  },

  cd: (ctx) => {
    const arg = ctx.args[0] ?? '/'
    const target = normalizePath(ctx.cwd, arg)
    const node = getNode(ctx.fs, target)
    if (!node) return [{ text: `cd: ${target}: no such directory`, type: 'err' }]
    if (node.type !== 'dir') return [{ text: `cd: ${target}: not a directory`, type: 'err' }]
    ctx.setCwd(target)
    return []
  },

  cat: (ctx) => {
    if (!ctx.args[0]) return [{ text: 'cat: missing operand', type: 'err' }]
    const target = normalizePath(ctx.cwd, ctx.args[0])
    const node = getNode(ctx.fs, target)
    if (!node) return [{ text: `cat: ${target}: no such file`, type: 'err' }]
    if (node.type !== 'file') return [{ text: `cat: ${target}: is a directory`, type: 'err' }]
    if (node.locked) return [{ text: `cat: ${target}: ACCESS DENIED`, type: 'err' }]
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
  // Custom command in theme JSON is just an array of lines (string or {text,type}).
  return () =>
    spec.map((line) => (typeof line === 'string' ? { text: line } : line))
}
