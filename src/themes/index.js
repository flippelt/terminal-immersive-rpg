import alien from './alien.json'
import lancer from './lancer.json'
import bladerunner from './bladerunner.json'
import wh40k from './wh40k.json'
import fallout from './fallout.json'
import cyberpunk from './cyberpunk.json'

const ALL = [alien, lancer, bladerunner, wh40k, fallout, cyberpunk]

// Demo build (vite build --mode demo) shows a curated subset suitable
// for a public showcase. Edit DEMO_IDS to taste — keep it stable.
// Keep the demo *short* — it's a taste, not a vitrine.
const DEMO_IDS = ['alien', 'cprd']

export const IS_DEMO = import.meta.env.MODE === 'demo'

export const THEMES = IS_DEMO
  ? ALL.filter((t) => DEMO_IDS.includes(t.id))
  : ALL
export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]))
export const DEFAULT_THEME = THEMES[0] ?? ALL[0]
