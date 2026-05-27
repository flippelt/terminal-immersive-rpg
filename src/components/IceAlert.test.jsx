// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import IceAlert from './IceAlert.jsx'

afterEach(cleanup)

describe('IceAlert', () => {
  it('shows the message and dismisses on Escape', () => {
    const onClose = vi.fn()
    render(<IceAlert message="SUSPICIOUS ACTIVITY" onClose={onClose} />)
    expect(screen.getByText('SUSPICIOUS ACTIVITY')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
  it('dismisses on click', () => {
    const onClose = vi.fn()
    render(<IceAlert message="X" onClose={onClose} />)
    fireEvent.click(screen.getByRole('alertdialog'))
    expect(onClose).toHaveBeenCalled()
  })
})
