// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import FileViewer from './FileViewer.jsx'

afterEach(cleanup)

const node = { type: 'file', content: 'line one\nline two' }

describe('FileViewer', () => {
  it('renders the file content and name', () => {
    render(<FileViewer path="/note.txt" node={node} onClose={() => {}} />)
    expect(screen.getByText('line one')).toBeTruthy()
    expect(screen.getByText('line two')).toBeTruthy()
    expect(screen.getByText('/note.txt')).toBeTruthy()
  })

  it('closes via the × button', () => {
    const onClose = vi.fn()
    render(<FileViewer path="/note.txt" node={node} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<FileViewer path="/note.txt" node={node} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
