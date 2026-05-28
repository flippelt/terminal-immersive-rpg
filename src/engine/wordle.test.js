import { describe, it, expect } from 'vitest'
import { scoreGuess, isWin, pickWord, DEFAULT_WORDS, wordsFor, rollLuck, pickRevealPositions } from './wordle.js'

describe('scoreGuess', () => {
  it('marks all hits for the exact word', () => {
    expect(scoreGuess('CIPHER', 'CIPHER')).toEqual(['hit', 'hit', 'hit', 'hit', 'hit', 'hit'])
  })
  it('marks present, with the aligned letter a hit', () => {
    // target REACT, guess CRATE — the A (index 2) lines up → hit; rest present
    expect(scoreGuess('CRATE', 'REACT')).toEqual(['present', 'present', 'hit', 'present', 'present'])
  })
  it('handles duplicate letters in the guess', () => {
    // target ABBEY, guess BABES
    expect(scoreGuess('BABES', 'ABBEY')).toEqual(['present', 'present', 'hit', 'hit', 'miss'])
  })
  it('does not over-credit a repeated guess letter', () => {
    // target ALERT (one L), guess LLLLL -> exactly one of them counts (at the L position)
    const r = scoreGuess('LLLLL', 'ALERT')
    expect(r.filter((x) => x !== 'miss')).toEqual(['hit'])
  })
})

describe('isWin', () => {
  it('is case-insensitive', () => {
    expect(isWin('cipher', 'CIPHER')).toBe(true)
    expect(isWin('cyphr', 'CIPHER')).toBe(false)
  })
})

describe('pickWord', () => {
  it('returns a fixed decryptWord uppercased', () => {
    expect(pickWord({ decryptWord: 'swordfish' })).toBe('SWORDFISH')
  })
  it('picks from comma-separated decryptWords', () => {
    const w = pickWord({ decryptWords: 'alpha, bravo ,charlie' }, () => 0)
    expect(w).toBe('ALPHA')
  })
  it('falls back to the default pool', () => {
    expect(DEFAULT_WORDS).toContain(pickWord({}, () => 0))
  })
})

describe('default word pools', () => {
  // The minigame keyboard only accepts A-Z, and the grid sizes itself to the
  // word length — so words may vary in length but must be plain ASCII capitals
  // (no accents, or they'd be unwinnable).
  it('every default-pool word (en + pt) is ASCII A-Z only', () => {
    for (const lang of ['en', 'pt']) {
      for (const w of wordsFor(lang)) {
        expect(w, `${lang}: "${w}"`).toMatch(/^[A-Z]+$/)
      }
    }
  })
  it('keeps at least 25 six-letter words per language (lengths still vary)', () => {
    for (const lang of ['en', 'pt']) {
      const sixes = wordsFor(lang).filter((w) => w.length === 6)
      expect(sixes.length, `${lang} six-letter count`).toBeGreaterThanOrEqual(25)
    }
  })
})

describe('rollLuck', () => {
  it('returns null for rolls outside 1..20', () => {
    expect(rollLuck(0)).toBeNull()
    expect(rollLuck(21)).toBeNull()
    expect(rollLuck(NaN)).toBeNull()
    expect(rollLuck('x')).toBeNull()
  })
  it('truncates fractional rolls', () => {
    expect(rollLuck(20.7)?.roll).toBe(20)
  })
  it('roll 1 is a critical fail (lose 2 attempts)', () => {
    expect(rollLuck(1)).toMatchObject({ kind: 'lose', n: 2, tone: 'crit-fail' })
  })
  it('rolls 2-9 lose one attempt', () => {
    for (const r of [2, 5, 9]) {
      expect(rollLuck(r)).toMatchObject({ kind: 'lose', n: 1, tone: 'fail' })
    }
  })
  it('rolls 10-14 reveal one letter', () => {
    for (const r of [10, 12, 14]) {
      expect(rollLuck(r)).toMatchObject({ kind: 'reveal', n: 1, tone: 'good' })
    }
  })
  it('rolls 15-19 reveal two letters (15 sits with the higher tier)', () => {
    for (const r of [15, 17, 19]) {
      expect(rollLuck(r)).toMatchObject({ kind: 'reveal', n: 2, tone: 'great' })
    }
  })
  it('roll 20 is a critical hit (reveal three letters)', () => {
    expect(rollLuck(20)).toMatchObject({ kind: 'reveal', n: 3, tone: 'crit' })
  })
})

describe('pickRevealPositions', () => {
  it('returns up to `count` indices from [0, len) and skips already-taken ones', () => {
    const taken = new Set([1])
    // Fixed RNG so the selection is deterministic.
    const picks = pickRevealPositions(5, 2, taken, () => 0)
    expect(picks).toHaveLength(2)
    expect(picks).not.toContain(1)
    for (const p of picks) {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThan(5)
    }
    // Picks must be distinct.
    expect(new Set(picks).size).toBe(picks.length)
  })
  it('returns fewer than requested when the pool is small', () => {
    // 4 positions, two already taken → at most 2 picks possible.
    expect(pickRevealPositions(4, 5, new Set([0, 1])).length).toBe(2)
  })
  it('returns an empty array when len is 0 or count is 0', () => {
    expect(pickRevealPositions(0, 3)).toEqual([])
    expect(pickRevealPositions(5, 0)).toEqual([])
  })
})
