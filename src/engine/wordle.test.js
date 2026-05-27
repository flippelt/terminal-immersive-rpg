import { describe, it, expect } from 'vitest'
import { scoreGuess, isWin, pickWord, DEFAULT_WORDS } from './wordle.js'

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
