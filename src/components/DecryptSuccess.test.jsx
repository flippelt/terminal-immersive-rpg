// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import DecryptSuccess from './DecryptSuccess.jsx'

// jsdom has no matchMedia; default it to "motion allowed".
function mockReducedMotion(reduce) {
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: reduce,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {}
  }))
}

beforeEach(() => {
  vi.useFakeTimers()
  mockReducedMotion(false)
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('DecryptSuccess', () => {
  it('runs ACCESS GRANTED then auto-types the key and completes', () => {
    const onComplete = vi.fn()
    render(<DecryptSuccess keyText="sword" onComplete={onComplete} />)
    // Beat 1: ACCESS GRANTED is shown.
    expect(screen.getByText('ACCESS GRANTED')).toBeTruthy()
    // Advance past the granted hold -> key beat.
    act(() => vi.advanceTimersByTime(1450))
    expect(screen.getByText('KEY RECOVERED')).toBeTruthy()
    // Type out all 5 chars + the trailing hold.
    act(() => vi.advanceTimersByTime(5 * 130 + 900))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('skips straight to completion when reduced motion is requested', () => {
    mockReducedMotion(true)
    const onComplete = vi.fn()
    render(<DecryptSuccess keyText="sword" onComplete={onComplete} />)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
