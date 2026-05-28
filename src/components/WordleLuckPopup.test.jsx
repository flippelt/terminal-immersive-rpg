// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import WordleLuckPopup from './WordleLuckPopup.jsx'
import { makeT } from '../i18n/ui.js'

afterEach(cleanup)

const t = makeT('en')

const input = (container) => container.querySelector('.wordle-luck__input')

describe('WordleLuckPopup prompt', () => {
  it('renders the title, label, and hint, and auto-focuses the input', () => {
    const { container, getByText } = render(<WordleLuckPopup t={t} onCommit={() => {}} />)
    expect(getByText("Feelin' Lucky? ;)")).toBeTruthy()
    expect(getByText('roll 1d20:')).toBeTruthy()
    expect(getByText(/enter to roll/i)).toBeTruthy()
    expect(document.activeElement).toBe(input(container))
  })

  it('only accepts digits up to two characters', () => {
    const { container } = render(<WordleLuckPopup t={t} onCommit={() => {}} />)
    const el = input(container)
    fireEvent.change(el, { target: { value: '1a2b3' } })
    expect(el.value).toBe('12')
  })

  it('shows the invalid hint and shake when the input falls outside 1..20', () => {
    const { container, getByText } = render(<WordleLuckPopup t={t} onCommit={() => {}} />)
    const el = input(container)
    fireEvent.change(el, { target: { value: '25' } })
    fireEvent.keyDown(el, { key: 'Enter' })
    expect(getByText('enter a number 1–20')).toBeTruthy()
    expect(el.className).toContain('wordle-luck__input--error')
  })

  it('does not call onCommit until the result hold elapses', () => {
    vi.useFakeTimers()
    try {
      const onCommit = vi.fn()
      const { container } = render(<WordleLuckPopup t={t} onCommit={onCommit} />)
      const el = input(container)
      fireEvent.change(el, { target: { value: '20' } })
      fireEvent.keyDown(el, { key: 'Enter' })
      // The result panel is showing now, but onCommit only fires after the
      // hold (~1700ms) — the player has time to read the smiley.
      expect(onCommit).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(800))
      expect(onCommit).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(1000))
      expect(onCommit).toHaveBeenCalledTimes(1)
      expect(onCommit.mock.calls[0][0]).toMatchObject({ kind: 'reveal', n: 3, tone: 'crit' })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('WordleLuckPopup result state', () => {
  const renderResult = (rollValue) => {
    vi.useFakeTimers()
    const onCommit = vi.fn()
    const result = render(<WordleLuckPopup t={t} onCommit={onCommit} />)
    const el = input(result.container)
    fireEvent.change(el, { target: { value: String(rollValue) } })
    fireEvent.keyDown(el, { key: 'Enter' })
    return { ...result, onCommit }
  }

  afterEach(() => vi.useRealTimers())

  it('a crit-fail (roll 1) shows the crit-fail tone and message', () => {
    const { container, getByText } = renderResult(1)
    expect(container.querySelector('.wordle-luck--crit-fail')).toBeTruthy()
    expect(getByText('critical fail — lost 2 attempts')).toBeTruthy()
    expect(getByText('d20: 1')).toBeTruthy()
  })

  it('a mid roll (10) reveals one letter', () => {
    const { container, getByText } = renderResult(10)
    expect(container.querySelector('.wordle-luck--good')).toBeTruthy()
    expect(getByText('1 letter revealed')).toBeTruthy()
  })

  it('a strong roll (17) reveals two letters', () => {
    const { container, getByText } = renderResult(17)
    expect(container.querySelector('.wordle-luck--great')).toBeTruthy()
    expect(getByText('2 letters revealed')).toBeTruthy()
  })

  it('roll 15 sits in the higher tier (2 letters)', () => {
    const { getByText } = renderResult(15)
    expect(getByText('2 letters revealed')).toBeTruthy()
  })
})
