import { describe, it, expect } from 'vitest'
import { composeCustomScenario } from './index.js'

describe('composeCustomScenario', () => {
  it('builds a runtime theme with a filesystem from a bundle', () => {
    const t = composeCustomScenario({
      theme: 'ibm',
      name: 'Test Op',
      motd: ['hi'],
      files: {
        '/note.md': '# hello',
        '/vault.dat': '---\nlocked: true\npassword: KEY\n---\nsecret'
      }
    })
    expect(t.custom).toBe(true)
    expect(t.scenarioName).toBe('Test Op')
    expect(t.filesystem['/note.md']).toMatchObject({ type: 'file' })
    expect(t.filesystem['/vault.dat']).toMatchObject({ locked: true, password: 'KEY' })
  })

  it('normalizes paths without a leading slash', () => {
    const t = composeCustomScenario({ files: { 'a.txt': 'x' } })
    expect(t.filesystem['/a.txt']).toBeTruthy()
  })

  it('lets the bundle override skin fields', () => {
    const t = composeCustomScenario({ palette: { fg: '#abcdef' }, files: {} })
    expect(t.palette.fg).toBe('#abcdef')
  })

  it('throws on a non-object bundle', () => {
    expect(() => composeCustomScenario(null)).toThrow()
    expect(() => composeCustomScenario([])).toThrow()
  })

  it('throws when files is not an object', () => {
    expect(() => composeCustomScenario({ files: ['a'] })).toThrow()
  })

  it('falls back to a base theme when the theme id is unknown', () => {
    const t = composeCustomScenario({ theme: 'nope', files: {} })
    expect(t.id).toBeTruthy()
  })
})
