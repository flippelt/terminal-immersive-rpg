// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import Tracer from './Tracer.jsx'

afterEach(cleanup)

describe('Tracer', () => {
  it('shows the active title and a countdown while running', () => {
    render(
      <Tracer
        endsAt={Date.now() + 30000}
        config={{ seconds: 30, label: 'ICE TRACE', active: 'ICE TRACE ACTIVE' }}
      />
    )
    expect(screen.getByText('ICE TRACE ACTIVE')).toBeTruthy()
    expect(screen.getByText(/ICE TRACE \d+s/)).toBeTruthy()
  })

  it('shows the complete title once the deadline has passed', () => {
    render(<Tracer endsAt={Date.now() - 1000} config={{ complete: 'TRACE COMPLETE' }} />)
    expect(screen.getByText('TRACE COMPLETE')).toBeTruthy()
  })

  it('fires onComplete exactly once after the deadline elapses', () => {
    vi.useFakeTimers()
    try {
      const onComplete = vi.fn()
      // Start with 0.5s on the clock. The ticking interval (250ms) will push
      // `now` past `endsAt` and the done-effect should fire onComplete once.
      const endsAt = Date.now() + 500
      render(
        <Tracer
          endsAt={endsAt}
          total={30}
          config={{ complete: 'TRACE COMPLETE' }}
          onComplete={onComplete}
        />
      )
      act(() => vi.advanceTimersByTime(800))
      expect(onComplete).toHaveBeenCalledTimes(1)
      // Subsequent ticks must not re-fire the callback (firedRef guard).
      act(() => vi.advanceTimersByTime(1500))
      expect(onComplete).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not fire onComplete while the tracer is still active', () => {
    vi.useFakeTimers()
    try {
      const onComplete = vi.fn()
      render(
        <Tracer
          endsAt={Date.now() + 30000}
          total={30}
          config={{ active: 'ICE TRACE ACTIVE' }}
          onComplete={onComplete}
        />
      )
      act(() => vi.advanceTimersByTime(1000))
      expect(onComplete).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
