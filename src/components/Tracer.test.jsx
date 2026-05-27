// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Tracer from './Tracer.jsx'

afterEach(cleanup)

describe('Tracer', () => {
  it('shows the active title and a countdown while running', () => {
    render(
      <Tracer
        endsAt={Date.now() + 30000}
        config={{ seconds: 30, label: 'ICE TRACE', active: 'ICE TRACE ACTIVE' }}
      />
    )
    expect(screen.getByText('ICE TRACE ACTIVE')).toBeTruthy()
    expect(screen.getByText(/ICE TRACE \d+s/)).toBeTruthy()
  })

  it('shows the complete title once the deadline has passed', () => {
    render(<Tracer endsAt={Date.now() - 1000} config={{ complete: 'TRACE COMPLETE' }} />)
    expect(screen.getByText('TRACE COMPLETE')).toBeTruthy()
  })
})
