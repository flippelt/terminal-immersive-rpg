// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import FailurePopup from './FailurePopup.jsx'
import { makeT } from '../i18n/ui.js'

afterEach(cleanup)

describe('FailurePopup', () => {
  it('renders the message and optional hint', () => {
    const { getByText } = render(
      <FailurePopup
        message="brute-force locked out"
        hint="too many failed attempts"
        t={makeT('en')}
        onClose={() => {}}
      />
    )
    expect(getByText('brute-force locked out')).toBeTruthy()
    expect(getByText('too many failed attempts')).toBeTruthy()
  })

  it('uses the default failure title when none is provided', () => {
    const { getByText } = render(
      <FailurePopup message="x" t={makeT('en')} onClose={() => {}} />
    )
    expect(getByText('OPERATION FAILED')).toBeTruthy()
  })

  it('fires onClose on Escape, on × button, and on OK', () => {
    const onClose = vi.fn()
    const { container, getByText, rerender } = render(
      <FailurePopup message="x" t={makeT('en')} onClose={onClose} />
    )
    // OK button
    fireEvent.click(getByText('OK'))
    expect(onClose).toHaveBeenCalledTimes(1)
    // X button
    rerender(<FailurePopup message="x" t={makeT('en')} onClose={onClose} />)
    fireEvent.click(container.querySelector('.failure-popup__close'))
    expect(onClose).toHaveBeenCalledTimes(2)
    // Escape (window-level listener)
    rerender(<FailurePopup message="x" t={makeT('en')} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('clicking the backdrop dismisses it (deferred side effects then run)', () => {
    const onClose = vi.fn()
    const { container } = render(
      <FailurePopup message="x" t={makeT('en')} onClose={onClose} />
    )
    fireEvent.click(container.querySelector('.modal-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
