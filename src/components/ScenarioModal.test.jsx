// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ScenarioModal from './ScenarioModal.jsx'

afterEach(cleanup)

describe('ScenarioModal', () => {
  it('submits the textarea value on ctrl+enter', () => {
    const onSubmit = vi.fn(() => null)
    render(<ScenarioModal onSubmit={onSubmit} onCancel={() => {}} />)
    const ta = screen.getByLabelText('scenario bundle JSON')
    fireEvent.change(ta, { target: { value: '{"a":1}' } })
    fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true })
    expect(onSubmit).toHaveBeenCalledWith('{"a":1}')
  })

  it('shows the error returned by onSubmit and stays open', () => {
    const onSubmit = vi.fn(() => 'invalid bundle: boom')
    render(<ScenarioModal onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.keyDown(screen.getByLabelText('scenario bundle JSON'), { key: 'Enter', ctrlKey: true })
    expect(screen.getByText(/invalid bundle: boom/)).toBeTruthy()
  })

  it('cancels on escape', () => {
    const onCancel = vi.fn()
    render(<ScenarioModal onSubmit={() => null} onCancel={onCancel} />)
    fireEvent.keyDown(screen.getByLabelText('scenario bundle JSON'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})
