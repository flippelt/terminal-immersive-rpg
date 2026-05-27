import { describe, it, expect } from 'vitest'
import { effTracer, scanTier } from './tracer.js'

describe('effTracer', () => {
  it('uses the theme defaults when the file overrides nothing', () => {
    const tr = { seconds: 30, penalty: 7, startAfter: 1, nocrackSeconds: 5 }
    expect(effTracer(tr, {})).toEqual({ seconds: 30, penalty: 7, startAfter: 1, nocrackSeconds: 5 })
  })
  it('falls back to global defaults with no theme/file', () => {
    expect(effTracer(null, null)).toEqual({ seconds: 30, penalty: 7, startAfter: 0, nocrackSeconds: 5 })
  })
  it('lets per-file keys win over the theme', () => {
    const tr = { seconds: 30, penalty: 7, startAfter: 2, nocrackSeconds: 5 }
    const node = { tracerSeconds: 12, tracerPenalty: 9, tracerStartAfter: 0, tracerNocrackSeconds: 3 }
    expect(effTracer(tr, node)).toEqual({ seconds: 12, penalty: 9, startAfter: 0, nocrackSeconds: 3 })
  })
  it('reduces startAfter by graceLost, floored at 0', () => {
    const tr = { startAfter: 2 }
    expect(effTracer(tr, {}, 1).startAfter).toBe(1)
    expect(effTracer(tr, {}, 5).startAfter).toBe(0)
  })
})

describe('scanTier', () => {
  it('precise when the roll beats the DC by 5+', () => {
    expect(scanTier(17, 12)).toBe('precise')
  })
  it('ambiguous near the DC (within 4 below up to +4)', () => {
    expect(scanTier(12, 12)).toBe('ambiguous')
    expect(scanTier(8, 12)).toBe('ambiguous')
    expect(scanTier(16, 12)).toBe('ambiguous')
  })
  it('fail well below the DC', () => {
    expect(scanTier(5, 12)).toBe('fail')
  })
  it('returns a false reading on a bad fail when misleads is on', () => {
    expect(scanTier(5, 12, true)).toBe('false')
  })
})
