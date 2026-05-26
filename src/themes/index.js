import alien from './alien.json'
import lancer from './lancer.json'
import bladerunner from './bladerunner.json'
import wh40k from './wh40k.json'

export const THEMES = [alien, lancer, bladerunner, wh40k]
export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]))
export const DEFAULT_THEME = alien
