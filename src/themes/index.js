import alien from './alien.json'
import lancer from './lancer.json'
import bladerunner from './bladerunner.json'
import wh40k from './wh40k.json'
import fallout from './fallout.json'
import cyberpunk from './cyberpunk.json'
import dataslate from './dataslate.json'
import ibm from './ibm.json'

// A THEME is a skin (palette, font, banner, sounds, boot, locks defaults).
// A SCENARIO is a campaign that plugs into a theme. Its layout on disk:
//
//   scenarios/<theme>/<id>/scenario.json   -> motd, commands, overrides
//   scenarios/<theme>/<id>/files/**        -> the player-visible filesystem
//
// Every file under files/ becomes one node in the virtual filesystem.
// A locked file carries front-matter (a --- block) with its metadata;
// a plain file is just its text. Directories are inferred from the tree.

const THEME_LIST = [alien, lancer, bladerunner, wh40k, fallout, cyberpunk, dataslate, ibm]
const THEME_REGISTRY = Object.fromEntries(THEME_LIST.map((t) => [t.id, t]))

// --- front-matter --------------------------------------------------------
// Leading `---\n ... \n---` block of flat `key: value` lines. Unquoted
// values coerce to boolean/number; quote a value to force a string
// (e.g. a numeric-only password: `password: "12345"`).
function parseFrontMatter(raw) {
  const text = String(raw).replace(/\r\n/g, '\n')
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { meta: {}, content: text.replace(/\n+$/, '') }
  const [, header, body] = m
  const meta = {}
  for (const line of header.split('\n')) {
    const i = line.indexOf(':')
    if (i === -1) continue
    const key = line.slice(0, i).trim()
    const rawVal = line.slice(i + 1).trim()
    let val = rawVal
    if (/^".*"$/.test(rawVal) || /^'.*'$/.test(rawVal)) val = rawVal.slice(1, -1)
    else if (rawVal === 'true') val = true
    else if (rawVal === 'false') val = false
    else if (/^-?\d+$/.test(rawVal)) val = parseInt(rawVal, 10)
    meta[key] = val
  }
  return { meta, content: body.replace(/\n+$/, '') }
}

// --- filesystem builder --------------------------------------------------
function buildFilesystem(entries) {
  const fs = { '/': { type: 'dir', children: [] } }
  const ensureDir = (p) => (fs[p] ??= { type: 'dir', children: [] })
  const addChild = (dirPath, name) => {
    const d = ensureDir(dirPath)
    if (!d.children.includes(name)) d.children.push(name)
  }

  for (const { path, content, meta } of entries) {
    const parts = path.split('/').filter(Boolean)
    let cur = ''
    for (let i = 0; i < parts.length - 1; i++) {
      addChild(cur === '' ? '/' : cur, parts[i])
      cur = cur + '/' + parts[i]
      ensureDir(cur)
    }
    addChild(cur === '' ? '/' : cur, parts[parts.length - 1])
    fs[path] = { type: 'file', content, ...meta }
  }

  for (const node of Object.values(fs)) {
    if (node.type === 'dir') node.children.sort()
  }
  return fs
}

// --- load scenarios from disk -------------------------------------------
const metaModules = import.meta.glob('./scenarios/*/*/scenario.json', {
  eager: true
})
const fileModules = import.meta.glob('./scenarios/*/*/files/**/*', {
  eager: true,
  query: '?raw',
  import: 'default'
})

const SCENARIOS = {} // SCENARIOS[themeId][scenarioId] = composed scenario
const FILE_BUCKETS = {} // key `${theme}/${scenario}` -> [{ path, content, meta }]

for (const [key, raw] of Object.entries(fileModules)) {
  const m = key.match(/\.\/scenarios\/([^/]+)\/([^/]+)\/files\/(.+)$/)
  if (!m) continue
  const [, themeId, scenarioId, rel] = m
  const { meta, content } = parseFrontMatter(raw)
  const bucket = (FILE_BUCKETS[`${themeId}/${scenarioId}`] ??= [])
  bucket.push({ path: '/' + rel, content, meta })
}

for (const [key, mod] of Object.entries(metaModules)) {
  const m = key.match(/\.\/scenarios\/([^/]+)\/([^/]+)\/scenario\.json$/)
  if (!m) continue
  const [, themeId, scenarioId] = m
  const data = mod.default ?? mod
  const files = FILE_BUCKETS[`${themeId}/${scenarioId}`] ?? []
  ;(SCENARIOS[themeId] ??= {})[scenarioId] = {
    id: scenarioId,
    ...data,
    filesystem: buildFilesystem(files)
  }
}

export function scenarioIdsFor(themeId) {
  return Object.keys(SCENARIOS[themeId] ?? {})
}

// Merge a theme skin with a scenario's content. Scenario fields override
// theme defaults; `commands` and `locks` shallow-merge.
export function composeTheme(themeId, scenarioId) {
  const theme = THEME_REGISTRY[themeId]
  if (!theme) return null
  const available = SCENARIOS[themeId] ?? {}
  const sid = available[scenarioId] ? scenarioId : theme.defaultScenario
  const scenario = available[sid] ?? {}

  return {
    ...theme,
    scenarioId: scenario.id ?? sid ?? null,
    scenarioName: scenario.name ?? null,
    user: scenario.user ?? theme.user,
    header: scenario.header ?? theme.header,
    prompt: scenario.prompt ?? theme.prompt,
    boot: scenario.boot ?? theme.boot ?? [],
    motd: scenario.motd ?? theme.motd ?? [],
    login: scenario.login ?? theme.login ?? null,
    locks: { ...theme.locks, ...scenario.locks },
    commands: { ...theme.commands, ...scenario.commands },
    filesystem: scenario.filesystem ?? {}
  }
}

// Demo build (vite build --mode demo) shows a curated subset.
const DEMO_IDS = ['alien', 'cprd']

export const IS_DEMO = import.meta.env.MODE === 'demo'

export const THEMES = IS_DEMO
  ? THEME_LIST.filter((t) => DEMO_IDS.includes(t.id))
  : THEME_LIST
export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]))
export const DEFAULT_THEME = THEMES[0] ?? THEME_LIST[0]
