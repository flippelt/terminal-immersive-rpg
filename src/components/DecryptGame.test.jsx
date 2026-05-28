// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import DecryptGame from './DecryptGame.jsx'

afterEach(cleanup)

const rowCount = (c) => c.querySelectorAll('.wordle__row').length
const capture = (c) => c.querySelector('.wordle__capture')
const luckInput = (c) => c.querySelector('.wordle-luck__input')
const luckRoot = (c) => c.querySelector('.wordle-luck')

// Most existing tests focus on the wordle mechanics; they pass `luck={false}`
// so the "Feelin' Lucky?" popup doesn't sit on top of the wordle and steal
// focus / occupy the first row.
const wordleProps = (over = {}) => ({
  target: 'CIPHER',
  luck: false,
  onWin: () => {},
  onLose: () => {},
  onCancel: () => {},
  ...over
})

describe('DecryptGame attempts (GM override)', () => {
  it('defaults to 6 attempts when unset', () => {
    const { container } = render(<DecryptGame {...wordleProps()} />)
    expect(rowCount(container)).toBe(6)
  })

  it('honors a GM override above the floor', () => {
    const { container } = render(<DecryptGame {...wordleProps({ attempts: 9 })} />)
    expect(rowCount(container)).toBe(9)
  })

  it('clamps to a minimum of 4 attempts', () => {
    const { container } = render(<DecryptGame {...wordleProps({ attempts: 2 })} />)
    expect(rowCount(container)).toBe(4)
  })
})

describe('DecryptGame input (mobile soft-keyboard)', () => {
  it('renders a focused capture input and auto-focuses on mount when luck is disabled', () => {
    const { container } = render(<DecryptGame {...wordleProps()} />)
    const input = capture(container)
    expect(input).toBeTruthy()
    expect(document.activeElement).toBe(input)
  })

  it('typing through the input fills the tiles, only A-Z (uppercased)', () => {
    const { container } = render(<DecryptGame {...wordleProps()} />)
    const input = capture(container)
    fireEvent.change(input, { target: { value: 'ci2p?h' } })
    expect(input.value).toBe('CIPH')
    // First row's tiles should reflect the current guess
    const tiles = container.querySelectorAll('.wordle__row')[0].querySelectorAll('.wordle__tile')
    expect([...tiles].map((t) => t.textContent).join('')).toBe('CIPH')
  })

  it('submits the guess on Enter and wins when it matches the target', () => {
    vi.useFakeTimers()
    try {
      const onWin = vi.fn()
      const { container } = render(<DecryptGame {...wordleProps({ onWin })} />)
      const input = capture(container)
      fireEvent.change(input, { target: { value: 'cipher' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      act(() => vi.advanceTimersByTime(650))
      expect(onWin).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('Escape on the input cancels the game', () => {
    const onCancel = vi.fn()
    const { container } = render(<DecryptGame {...wordleProps({ onCancel })} />)
    fireEvent.keyDown(capture(container), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('DecryptGame onLose (defeat path)', () => {
  it('fires onLose after the configured number of wrong guesses', () => {
    vi.useFakeTimers()
    try {
      const onLose = vi.fn()
      const onWin = vi.fn()
      // 4 attempts is the floor; target ABCDE doesn't match WRONG.
      const { container } = render(
        <DecryptGame {...wordleProps({ target: 'ABCDE', attempts: 4, onWin, onLose })} />
      )
      const input = capture(container)
      for (let i = 0; i < 4; i++) {
        fireEvent.change(input, { target: { value: 'WRONG' } })
        fireEvent.keyDown(input, { key: 'Enter' })
      }
      act(() => vi.advanceTimersByTime(800))
      expect(onLose).toHaveBeenCalledTimes(1)
      expect(onWin).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not advance the guess when Enter is pressed with a partial word', () => {
    const onWin = vi.fn()
    const onLose = vi.fn()
    const { container } = render(
      <DecryptGame {...wordleProps({ onWin, onLose })} />
    )
    const input = capture(container)
    // Partial guess (CIP for a 6-letter target).
    fireEvent.change(input, { target: { value: 'CIP' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // No row should have been committed yet — only one (empty) typing row.
    expect(rowCount(container)).toBe(6)
    const committed = container.querySelectorAll('.wordle__row .wordle__tile--miss, .wordle__row .wordle__tile--hit, .wordle__row .wordle__tile--present')
    expect(committed.length).toBe(0)
    expect(onWin).not.toHaveBeenCalled()
    expect(onLose).not.toHaveBeenCalled()
  })
})

describe('DecryptGame luck popup integration', () => {
  it('shows the luck popup on mount and focuses its input first', () => {
    const { container } = render(
      <DecryptGame target="CIPHER" onWin={() => {}} onLose={() => {}} onCancel={() => {}} />
    )
    expect(luckRoot(container)).toBeTruthy()
    expect(document.activeElement).toBe(luckInput(container))
  })

  it('hides the luck popup after the first wordle guess (no roll)', () => {
    const { container } = render(
      <DecryptGame target="CIPHER" onWin={() => {}} onLose={() => {}} onCancel={() => {}} />
    )
    expect(luckRoot(container)).toBeTruthy()
    // The wordle capture is still mounted underneath; submitting a guess
    // dismisses the luck popup without consuming the player's roll.
    fireEvent.change(capture(container), { target: { value: 'WRONGW' } })
    fireEvent.keyDown(capture(container), { key: 'Enter' })
    expect(luckRoot(container)).toBeNull()
  })

  it('reveal effect adds the hint row and dismisses the popup', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(
        <DecryptGame target="CIPHER" onWin={() => {}} onLose={() => {}} onCancel={() => {}} />
      )
      // Roll 20 → reveal 3 letters.
      fireEvent.change(luckInput(container), { target: { value: '20' } })
      fireEvent.keyDown(luckInput(container), { key: 'Enter' })
      // Result is on screen; wait for the hold + commit.
      act(() => vi.advanceTimersByTime(1800))
      expect(luckRoot(container)).toBeNull()
      const hintTiles = container.querySelectorAll('.wordle__tile--revealed')
      expect(hintTiles.length).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('lose effect burns rows at the top of the grid and dismisses the popup', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(
        <DecryptGame target="CIPHER" attempts={6} onWin={() => {}} onLose={() => {}} onCancel={() => {}} />
      )
      // Roll 1 → critical fail, lose 2 attempts.
      fireEvent.change(luckInput(container), { target: { value: '1' } })
      fireEvent.keyDown(luckInput(container), { key: 'Enter' })
      act(() => vi.advanceTimersByTime(1800))
      expect(luckRoot(container)).toBeNull()
      const burnedRows = container.querySelectorAll('.wordle__row--burned')
      expect(burnedRows.length).toBe(2)
      // The grid still has the same total row count (tries) — burned slots
      // replace would-be guess rows, they don't add capacity.
      expect(rowCount(container)).toBe(6)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not show the luck popup when luck={false} (GM opt-out)', () => {
    const { container } = render(
      <DecryptGame target="CIPHER" luck={false} onWin={() => {}} onLose={() => {}} onCancel={() => {}} />
    )
    expect(luckRoot(container)).toBeNull()
    expect(document.activeElement).toBe(capture(container))
  })
})
