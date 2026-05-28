// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import DecryptGame from './DecryptGame.jsx'

afterEach(cleanup)

const rowCount = (c) => c.querySelectorAll('.wordle__row').length
const capture = (c) => c.querySelector('.wordle__capture')

describe('DecryptGame attempts (GM override)', () => {
  it('defaults to 6 attempts when unset', () => {
    const { container } = render(<DecryptGame target="CIPHER" onWin={() => {}} onLose={() => {}} onCancel={() => {}} />)
    expect(rowCount(container)).toBe(6)
  })

  it('honors a GM override above the floor', () => {
    const { container } = render(<DecryptGame target="CIPHER" attempts={9} onWin={() => {}} onLose={() => {}} onCancel={() => {}} />)
    expect(rowCount(container)).toBe(9)
  })

  it('clamps to a minimum of 4 attempts', () => {
    const { container } = render(<DecryptGame target="CIPHER" attempts={2} onWin={() => {}} onLose={() => {}} onCancel={() => {}} />)
    expect(rowCount(container)).toBe(4)
  })
})

describe('DecryptGame input (mobile soft-keyboard)', () => {
  it('renders a focused capture input and auto-focuses on mount', () => {
    const { container } = render(<DecryptGame target="CIPHER" onWin={() => {}} onLose={() => {}} onCancel={() => {}} />)
    const input = capture(container)
    expect(input).toBeTruthy()
    expect(document.activeElement).toBe(input)
  })

  it('typing through the input fills the tiles, only A-Z (uppercased)', () => {
    const { container } = render(<DecryptGame target="CIPHER" onWin={() => {}} onLose={() => {}} onCancel={() => {}} />)
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
      const { container } = render(<DecryptGame target="CIPHER" onWin={onWin} onLose={() => {}} onCancel={() => {}} />)
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
    const { container } = render(<DecryptGame target="CIPHER" onWin={() => {}} onLose={() => {}} onCancel={onCancel} />)
    fireEvent.keyDown(capture(container), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})
