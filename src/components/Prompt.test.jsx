// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import Prompt from './Prompt.jsx'

afterEach(cleanup)

const capture = (c) => c.querySelector('.prompt-line__capture')
// The inline cursor renders a single non-breaking space at the caret
// position; strip it before asserting so tests don't depend on caret column.
const NBSP = String.fromCharCode(0x00a0)
const typed = (c) =>
  c.querySelector('.prompt-line__text').textContent.split(NBSP).join(' ').trim()

const baseProps = (overrides = {}) => ({
  sigil: '$',
  cwd: '/',
  onSubmit: vi.fn(),
  history: [],
  ...overrides
})

describe('Prompt history navigation', () => {
  it('ArrowUp cycles backward through history', () => {
    const props = baseProps({ history: ['ls', 'cd /etc', 'cat note.txt'] })
    const { container } = render(<Prompt {...props} />)
    const input = capture(container)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(typed(container)).toBe('cat note.txt')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(typed(container)).toBe('cd /etc')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(typed(container)).toBe('ls')
  })

  it('ArrowDown walks forward and clears past the end of history', () => {
    const props = baseProps({ history: ['ls', 'pwd'] })
    const { container } = render(<Prompt {...props} />)
    const input = capture(container)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(typed(container)).toBe('ls')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(typed(container)).toBe('pwd')
    // One more ArrowDown takes us past the last entry: input should clear.
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(typed(container)).toBe('')
  })

  it('Enter submits the typed command and clears the input', () => {
    const onSubmit = vi.fn()
    const { container } = render(<Prompt {...baseProps({ onSubmit })} />)
    const input = capture(container)
    fireEvent.change(input, { target: { value: 'ls /home' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('ls /home')
    expect(typed(container)).toBe('')
  })
})

describe('Prompt shortcuts', () => {
  it('Ctrl+L submits the `clear` command', () => {
    const onSubmit = vi.fn()
    const { container } = render(<Prompt {...baseProps({ onSubmit })} />)
    fireEvent.keyDown(capture(container), { key: 'l', ctrlKey: true })
    expect(onSubmit).toHaveBeenCalledWith('clear')
  })

  it('Tab completion replaces the input with the resolved value', () => {
    const complete = vi.fn(() => ({ value: 'cat /note.txt ', list: ['/note.txt'] }))
    const { container } = render(<Prompt {...baseProps({ complete })} />)
    const input = capture(container)
    fireEvent.change(input, { target: { value: 'cat /no' } })
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(complete).toHaveBeenCalledWith('cat /no')
    expect(typed(container)).toBe('cat /note.txt')
  })

  it('Tab completion with multiple candidates shows hint row', () => {
    const complete = vi.fn(() => ({
      value: 'cat /n',
      list: ['/note.txt', '/next.dat']
    }))
    const { container } = render(<Prompt {...baseProps({ complete })} />)
    const input = capture(container)
    fireEvent.change(input, { target: { value: 'cat /n' } })
    fireEvent.keyDown(input, { key: 'Tab' })
    const hints = container.querySelector('.completion-hints')
    expect(hints).toBeTruthy()
    expect(hints.textContent).toContain('/note.txt')
    expect(hints.textContent).toContain('/next.dat')
  })
})

describe('Prompt focus management', () => {
  it('auto-focuses the capture input on mount', () => {
    const { container } = render(<Prompt {...baseProps()} />)
    expect(document.activeElement).toBe(capture(container))
  })
})
