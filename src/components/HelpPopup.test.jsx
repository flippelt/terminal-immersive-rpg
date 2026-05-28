// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import HelpPopup from './HelpPopup.jsx'
import { makeT } from '../i18n/ui.js'

afterEach(cleanup)

const baseTheme = (overrides = {}) => ({
  id: 't',
  name: 'T',
  aliases: {},
  extraHelp: [],
  ...overrides
})

describe('HelpPopup', () => {
  it('renders one row per help.lines entry plus the title', () => {
    const { container, getByText } = render(
      <HelpPopup theme={baseTheme()} t={makeT('en')} onClose={() => {}} />
    )
    expect(getByText('COMMANDS')).toBeTruthy()
    const rows = container.querySelectorAll('.help-popup__row')
    expect(rows.length).toBeGreaterThan(0)
    // The 'ls' line is the second canonical entry.
    expect([...rows].some((r) => r.textContent.includes('ls'))).toBe(true)
  })

  it('surfaces scenario aliases under the canonical command they map to', () => {
    const theme = baseTheme({ aliases: { auspex: 'check', scrutinize: 'check' } })
    const { container } = render(
      <HelpPopup theme={theme} t={makeT('en')} onClose={() => {}} />
    )
    const checkRow = [...container.querySelectorAll('.help-popup__row')]
      .find((r) => r.querySelector('.help-popup__cmd').textContent.startsWith('check'))
    expect(checkRow).toBeTruthy()
    const aliases = checkRow.querySelector('.help-popup__aliases')
    expect(aliases).toBeTruthy()
    expect(aliases.textContent).toContain('auspex')
    expect(aliases.textContent).toContain('scrutinize')
  })

  it('omits the alias row for commands that have no aliases', () => {
    const { container } = render(
      <HelpPopup theme={baseTheme()} t={makeT('en')} onClose={() => {}} />
    )
    const lsRow = [...container.querySelectorAll('.help-popup__row')]
      .find((r) => r.querySelector('.help-popup__cmd').textContent.startsWith('ls'))
    expect(lsRow.querySelector('.help-popup__aliases')).toBeNull()
  })

  it('renders theme.extraHelp lines under a system-specific section', () => {
    const theme = baseTheme({ extraHelp: ['  litany               recite the imperial creed'] })
    const { container } = render(
      <HelpPopup theme={theme} t={makeT('en')} onClose={() => {}} />
    )
    expect(container.querySelector('.help-popup__section').textContent).toBeTruthy()
    const extras = container.querySelectorAll('.help-popup__extra')
    expect(extras.length).toBe(1)
    expect(extras[0].textContent).toContain('litany')
  })

  it('closes on Escape and on the × button', () => {
    const onClose = vi.fn()
    const { container } = render(
      <HelpPopup theme={baseTheme()} t={makeT('en')} onClose={onClose} />
    )
    const close = container.querySelector('.help-popup__close')
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
