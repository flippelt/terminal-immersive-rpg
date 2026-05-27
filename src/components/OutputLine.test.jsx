// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import OutputLine from './OutputLine.jsx'

afterEach(cleanup)

describe('OutputLine', () => {
  it('renders an instant text line', () => {
    render(<OutputLine line={{ text: 'hello', type: 'ok', instant: true }} animate={false} speed={1} />)
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('renders an image and advances the queue on load', () => {
    const onDone = vi.fn()
    const { container } = render(
      <OutputLine line={{ type: 'image', src: 'data:,', alt: 'pic' }} animate onDone={onDone} />
    )
    const img = container.querySelector('img.crt-img')
    expect(img).toBeTruthy()
    fireEvent.load(img)
    expect(onDone).toHaveBeenCalled()
  })

  it('falls back to a message when the image errors', () => {
    const onDone = vi.fn()
    const { container } = render(
      <OutputLine line={{ type: 'image', src: 'bad', alt: '' }} animate onDone={onDone} />
    )
    fireEvent.error(container.querySelector('img'))
    expect(onDone).toHaveBeenCalled()
    expect(screen.getByText(/image unavailable/)).toBeTruthy()
  })

  it('renders nothing for a progress line (shown as a popup elsewhere)', () => {
    const { container } = render(<OutputLine line={{ type: 'progress' }} animate={false} />)
    expect(container.firstChild).toBeNull()
  })
})
