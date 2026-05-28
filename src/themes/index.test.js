import { describe, it, expect } from 'vitest'
import { composeCustomScenario, composeTheme } from './index.js'

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

describe('per-language content (i18n)', () => {
  const bundle = {
    theme: 'ibm',
    name: 'Op',
    motd: ['hello'],
    dialog: { thinking: 'WORKING', fallback: 'NO DATA' },
    files: { '/brief.md': '# Briefing\nread me' },
    i18n: {
      pt: {
        motd: ['olá'],
        dialog: { fallback: 'SEM DADOS' },
        files: { '/brief.md': '# Instruções\nleia-me' }
      }
    }
  }

  it('keeps the base (English) content by default', () => {
    const t = composeCustomScenario(bundle)
    expect(t.motd).toEqual(['hello'])
    expect(t.dialog.fallback).toBe('NO DATA')
    expect(t.filesystem['/brief.md'].content).toContain('read me')
    expect(t.i18n).toBeUndefined() // the block is never carried through
  })

  it('overrides fields and file bodies for the active language', () => {
    const t = composeCustomScenario(bundle, 'pt')
    expect(t.motd).toEqual(['olá'])
    expect(t.filesystem['/brief.md'].content).toContain('leia-me')
  })

  it('shallow-merges plain objects so untranslated keys survive', () => {
    const t = composeCustomScenario(bundle, 'pt')
    expect(t.dialog.fallback).toBe('SEM DADOS') // translated
    expect(t.dialog.thinking).toBe('WORKING') // kept from base
  })

  it('preserves file metadata when translating the body', () => {
    const t = composeCustomScenario(
      {
        theme: 'ibm',
        files: { '/vault.dat': '---\nlocked: true\npassword: KEY\n---\nsecret' },
        i18n: { pt: { files: { '/vault.dat': 'segredo' } } }
      },
      'pt'
    )
    expect(t.filesystem['/vault.dat']).toMatchObject({ locked: true, password: 'KEY' })
    expect(t.filesystem['/vault.dat'].content).toBe('segredo')
  })

  it('falls back to English for a language with no i18n entry', () => {
    const t = composeCustomScenario(bundle, 'xx')
    expect(t.motd).toEqual(['hello'])
  })

  it('localizes a repo scenario via composeTheme', () => {
    // English baseline exists; pt is a no-op unless that scenario ships pt.
    const en = composeTheme('alien', 'nostromo', 'en')
    expect(en.i18n).toBeUndefined()
    expect(Array.isArray(en.motd)).toBe(true)
  })

  it('applies a bundled scenario translation end-to-end (cprd/heimdall pt)', () => {
    const en = composeTheme('cprd', 'heimdall', 'en')
    const pt = composeTheme('cprd', 'heimdall', 'pt')
    // shell field (motd) is translated
    expect(en.motd[0]).toContain('NetWatch Agent Console')
    expect(pt.motd[0]).toContain('Console de Agente NetWatch')
    // file body comes from the parallel files.pt/ tree
    expect(en.filesystem['/case.md'].content).toContain('illegal incursion')
    expect(pt.filesystem['/case.md'].content).toContain('incursão ilegal')
    // lock metadata is preserved when the body is translated
    expect(pt.filesystem['/blackbox.dat']).toMatchObject({
      locked: true,
      password: 'OPERATION-PHARMAKOS'
    })
    expect(pt.filesystem['/blackbox.dat'].content).toContain('OPERAÇÃO PHARMAKOS')
  })
})
