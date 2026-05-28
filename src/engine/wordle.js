// Wordle-style scoring for the `decrypt` minigame. Pure & unit-tested.
import enWords from '../i18n/words.en.json'
import ptWords from '../i18n/words.pt.json'

// Default keyword pools by language (src/i18n/words.<lang>.json).
const POOLS = { en: enWords.words, pt: ptWords.words }
export const DEFAULT_WORDS = enWords.words

// The default keyword pool for a language (falls back to English).
export function wordsFor(lang) {
  return POOLS[lang] ?? DEFAULT_WORDS
}

// Pick the target word for a game file: a fixed `decryptWord`, a random one
// from comma-separated `decryptWords`, else a random word from the active
// language's default pool. Uppercased.
export function pickWord(meta, rand = Math.random, lang = 'en') {
  const norm = (w) => String(w).trim().toUpperCase()
  if (meta?.decryptWord) return norm(meta.decryptWord)
  const list = meta?.decryptWords
    ? String(meta.decryptWords).split(',').map(norm).filter(Boolean)
    : wordsFor(lang)
  return list[Math.floor(rand() * list.length)] ?? wordsFor(lang)[0]
}

// Score a guess against the target, Wordle-style, handling duplicate letters:
// returns one of 'hit' (right letter, right spot), 'present' (right letter,
// wrong spot), 'miss' (not in remaining letters) per position.
export function scoreGuess(guess, target) {
  const g = String(guess).toUpperCase()
  const t = String(target).toUpperCase()
  const n = t.length
  const res = new Array(n).fill('miss')
  const counts = {}
  for (let i = 0; i < n; i++) counts[t[i]] = (counts[t[i]] ?? 0) + 1
  // first pass: exact hits consume a letter
  for (let i = 0; i < n; i++) {
    if (g[i] === t[i]) {
      res[i] = 'hit'
      counts[g[i]] -= 1
    }
  }
  // second pass: present-but-misplaced from what's left
  for (let i = 0; i < n; i++) {
    if (res[i] === 'hit') continue
    if (counts[g[i]] > 0) {
      res[i] = 'present'
      counts[g[i]] -= 1
    }
  }
  return res
}

export const isWin = (guess, target) =>
  String(guess).toUpperCase() === String(target).toUpperCase()

// "Feelin' Lucky?" — one-shot d20 the player can roll before their first
// wordle guess. Returns the effect to apply (and a tone/smiley for the UI to
// render). Pure & deterministic given the roll, so the UI tests can drive
// fixed rolls.
//
// Range mapping:
//   1       → lose 2 attempts (critical fail)
//   2–9     → lose 1 attempt
//   10–14   → reveal 1 random letter
//   15–19   → reveal 2 random letters
//   20      → reveal 3 random letters (critical hit)
//
// Note: the project spec wrote the reveal ranges as "10–15" and "15–19" with
// 15 overlapping; we resolve in favor of the higher tier (15 = 2 letters)
// so a roll of 15 is unambiguously a "strong" outcome.
export function rollLuck(n) {
  if (!Number.isFinite(n)) return null
  const roll = Math.trunc(n)
  if (roll < 1 || roll > 20) return null
  if (roll === 1) return { roll, kind: 'lose', n: 2, smiley: ';_;', tone: 'crit-fail' }
  if (roll <= 9) return { roll, kind: 'lose', n: 1, smiley: ':/', tone: 'fail' }
  if (roll <= 14) return { roll, kind: 'reveal', n: 1, smiley: ':)', tone: 'good' }
  if (roll <= 19) return { roll, kind: 'reveal', n: 2, smiley: ';)', tone: 'great' }
  return { roll, kind: 'reveal', n: 3, smiley: '\\o/', tone: 'crit' }
}

// Pick N distinct positions from [0..len) that aren't already in `taken`.
// Used by the luck "reveal" effect; the caller passes its own RNG so tests
// can pin the choice.
export function pickRevealPositions(len, count, taken = new Set(), rand = Math.random) {
  const pool = []
  for (let i = 0; i < len; i++) if (!taken.has(i)) pool.push(i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)))
}
