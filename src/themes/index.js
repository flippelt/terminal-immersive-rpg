import alien from './alien.json'
import lancer from './lancer.json'
import bladerunner from './bladerunner.json'
import wh40k from './wh40k.json'
import fallout from './fallout.json'
import cyberpunk from './cyberpunk.json'

// A THEME is a skin (palette, font, banner, sounds, boot, locks defaults).
// A SCENARIO is content (motd, commands, filesystem) that plugs into a theme.
// One theme can have many scenarios under scenarios/<themeId>/<id>.json.

const THEME_LIST = [alien, lancer, bladerunner, wh40k, fallout, cyberpunk]
const THEME_REGISTRY = Object.fromEntries(THEME_LIST.map((t) => [t.id, t]))

// Eagerly load every scenario JSON. Key looks like
// './scenarios/alien/nostromo.json'.
const scenarioModules = import.meta.glob('./scenarios/*/*.json', { eager: true })

// SCENARIOS[themeId] = { scenarioId: scenarioObject, ... }
const SCENARIOS = {}
for (const [path, mod] of Object.entries(scenarioModules)) {
  const m = path.match(/\.\/scenarios\/([^/]+)\/([^/]+)\.json$/)
  if (!m) continue
  const [, themeId, scenarioId] = m
  const data = mod.default ?? mod
  ;(SCENARIOS[themeId] ??= {})[scenarioId] = { id: scenarioId, ...data }
}

export function scenarioIdsFor(themeId) {
  return Object.keys(SCENARIOS[themeId] ?? {})
}

// Merge a theme skin with a scenario's content into the object the
// engine consumes. Scenario fields override theme defaults; `commands`
// and `locks` shallow-merge.
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
    locks: { ...theme.locks, ...scenario.locks },
    commands: { ...theme.commands, ...scenario.commands },
    filesystem: scenario.filesystem ?? theme.filesystem ?? {}
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
