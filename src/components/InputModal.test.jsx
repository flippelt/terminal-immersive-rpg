// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import InputModal from './InputModal.jsx'

afterEach(cleanup)

describe('InputModal', () => {
  it('submits the value on Enter', () => {
    const onSubmit = vi.fn()
    render(<InputModal title="DECRYPT" label="enter key:" onSubmit={onSubmit} onCancel={() => {}} />)
    const input = screen.getByLabelText('enter key:')
    fireEvent.change(input, { target: { value: 'SWORD' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('SWORD')
  })

  it('cancels on Escape', () => {
    const onCancel = vi.fn()
    render(<InputModal title="t" label="l:" onSubmit={() => {}} onCancel={onCancel} />)
    fireEvent.keyDown(screen.getByLabelText('l:'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})
