import { normalizePath, listDir } from './filesystem.js'

// Tab completion. Returns { value, list }:
//   value — the input with the completion applied (full match, or the
//           longest common prefix when ambiguous)
//   list  — candidate labels to display when there's more than one match

const BUILTINS = [
  'help', 'ls', 'cd', 'cat', 'pwd', 'whoami', 'date', 'clear', 'motd',
  'theme', 'scenario', 'reboot', 'crack', 'decrypt', 'volume'
]
const FILE_ARG = new Set(['cat', 'cd', 'ls', 'crack', 'decrypt'])

function commonPrefix(strs) {
  if (strs.length === 0) return ''
  let p = strs[0]
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].startsWith(p)) p = p.slice(0, -1)
  }
  return p
}

function replaceLastToken(input, token) {
  const m = input.match(/^(.*\s)(\S*)$/)
  return m ? m[1] + token : token
}

function finishWord(input, matches) {
  if (matches.length === 0) return { value: input, list: [] }
  if (matches.length === 1) {
    const t = matches[0]
    const suffix = t.endsWith('/') ? '' : ' '
    return { value: replaceLastToken(input, t + suffix), list: [] }
  }
  return { value: replaceLastToken(input, commonPrefix(matches)), list: matches }
}

function completePath(input, argPrefix, ctx) {
  const slash = argPrefix.lastIndexOf('/')
  const dirPart = slash === -1 ? '' : argPrefix.slice(0, slash + 1)
  const namePart = slash === -1 ? argPrefix : argPrefix.slice(slash + 1)
  const entries = listDir(ctx.fs, normalizePath(ctx.cwd, dirPart || '.'))
  if (!entries) return { value: input, list: [] }
  const names = entries
    .filter((e) => e.name.startsWith(namePart))
    .map((e) => e.name + (e.type === 'dir' ? '/' : ''))
    .sort()
  if (names.length === 0) return { value: input, list: [] }
  if (names.length === 1) {
    const suffix = names[0].endsWith('/') ? '' : ' '
    return { value: replaceLastToken(input, dirPart + names[0] + suffix), list: [] }
  }
  return { value: replaceLastToken(input, dirPart + commonPrefix(names)), list: names }
}

export function complete(input, ctx) {
  const tokens = input.split(/\s+/)
  // First token (or empty) -> complete a command name.
  if (tokens.length <= 1) {
    const prefix = tokens[0] ?? ''
    const names = [...BUILTINS, ...Object.keys(ctx.theme?.commands ?? {})]
      .filter((n) => n.startsWith(prefix))
      .sort()
    return finishWord(input, names)
  }
  const cmd = tokens[0]
  const argPrefix = tokens[tokens.length - 1]

  if (cmd === 'theme') {
    const ids = (ctx.themes ?? []).map((t) => t.id).filter((id) => id.startsWith(argPrefix)).sort()
    return finishWord(input, ids)
  }
  if (cmd === 'scenario') {
    if (tokens.length === 2) {
      return finishWord(input, ['list', 'load', 'status'].filter((a) => a.startsWith(argPrefix)))
    }
    if (tokens[1] === 'load') {
      return finishWord(input, (ctx.scenarioIds ?? []).filter((id) => id.startsWith(argPrefix)).sort())
    }
    return { value: input, list: [] }
  }
  if (FILE_ARG.has(cmd)) return completePath(input, argPrefix, ctx)
  return { value: input, list: [] }
}
