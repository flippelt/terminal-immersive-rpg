import { describe, it, expect, vi } from 'vitest'
import { runCommand, buildDecryptLines } from './commands.js'

const fs = {
  '/': { type: 'dir', children: ['note.txt', 'secret.dat', 'next.dat'] },
  '/note.txt': { type: 'file', content: 'line one\nline two' },
  '/secret.dat': {
    type: 'file',
    locked: true,
    password: 'SWORD',
    crackable: true,
    crackTime: 1000,
    reveals: '/next.dat'
  },
  '/next.dat': { type: 'file', locked: true, password: 'FISH', crackable: false }
}

function makeCtx(over = {}) {
  return {
    theme: { id: 't', name: 'T', commands: {}, locks: {} },
    themes: [{ id: 't', name: 'T' }],
    fs,
    cwd: '/',
    unlocked: new Set(),
    unlock: vi.fn(),
    setCwd: vi.fn(),
    clear: vi.fn(),
    reboot: vi.fn(),
    ...over
  }
}

const texts = (lines) => lines.map((l) => l.text)

describe('cat', () => {
  it('prints file content split by line', () => {
    const out = runCommand('cat note.txt', makeCtx())
    expect(texts(out)).toEqual(['line one', 'line two'])
  })
  it('denies a locked file', () => {
    const out = runCommand('cat secret.dat', makeCtx())
    expect(out[0].type).toBe('err')
    expect(out[0].text).toContain('ACCESS DENIED')
  })
  it('reveals locked content in GM mode without unlocking', () => {
    const out = runCommand('cat secret.dat', makeCtx({ gmMode: true }))
    expect(out[0].text).toContain('GM preview')
    expect(out.some((l) => l.text?.includes('pwd:SWORD'))).toBe(true)
  })
  it('reads a locked file once it is unlocked', () => {
    const out = runCommand('cat secret.dat', makeCtx({ unlocked: new Set(['/secret.dat']) }))
    expect(out[0].type).not.toBe('err')
  })
})

describe('ls', () => {
  it('marks locked files', () => {
    const out = runCommand('ls', makeCtx())
    const secret = out.find((l) => l.text.startsWith('secret.dat'))
    expect(secret.text).toContain('[LOCKED]')
  })
  it('shows passwords in GM mode', () => {
    const out = runCommand('ls', makeCtx({ gmMode: true }))
    const secret = out.find((l) => l.text.startsWith('secret.dat'))
    expect(secret.text).toContain('pwd:SWORD')
    const next = out.find((l) => l.text.startsWith('next.dat'))
    expect(next.text).toContain('nocrack')
  })
})

describe('crack', () => {
  it('queues a progress line whose onComplete unlocks the file', () => {
    const ctx = makeCtx()
    const out = runCommand('crack secret.dat', ctx)
    const progress = out.find((l) => l.type === 'progress')
    expect(progress).toBeTruthy()
    expect(progress.duration).toBe(1000)
    progress.onComplete()
    expect(ctx.unlock).toHaveBeenCalledWith('/secret.dat')
  })
  it('reveals the chained file key on success', () => {
    const out = runCommand('crack secret.dat', makeCtx())
    expect(out.some((l) => l.text?.includes('/next.dat'))).toBe(true)
    expect(out.some((l) => l.text?.includes('FISH'))).toBe(true)
  })
  it('refuses an un-crackable file', () => {
    const out = runCommand('crack next.dat', makeCtx())
    expect(out[0].type).toBe('err')
  })
})

describe('crack with difficulty (crackDC)', () => {
  const dcFs = {
    '/': { type: 'dir', children: ['vault.dat'] },
    '/vault.dat': {
      type: 'file',
      locked: true,
      password: 'KEY',
      crackable: true,
      crackDC: 12,
      crackAttempts: 3
    }
  }
  it('opens the roll prompt instead of cracking directly', () => {
    const openCrackPrompt = vi.fn()
    const out = runCommand(
      'crack vault.dat',
      makeCtx({ fs: dcFs, openCrackPrompt, crackAttempts: new Map() })
    )
    expect(openCrackPrompt).toHaveBeenCalledWith('/vault.dat', dcFs['/vault.dat'])
    expect(out.some((l) => l.type === 'progress')).toBe(false)
  })
  it('locks out crack after attempts are spent', () => {
    const out = runCommand(
      'crack vault.dat',
      makeCtx({ fs: dcFs, crackAttempts: new Map([['/vault.dat', 3]]) })
    )
    expect(out[0].type).toBe('err')
    expect(out[0].text).toContain('locked out')
  })
})

describe('buildDecryptLines', () => {
  const theme = { locks: {} }
  it('rejects a wrong key', () => {
    const out = buildDecryptLines(theme, '/secret.dat', fs['/secret.dat'], 'NOPE', vi.fn(), fs)
    expect(out[0].type).toBe('err')
  })
  it('accepts the right key, unlocks, and reveals the chain', () => {
    const unlock = vi.fn()
    const out = buildDecryptLines(theme, '/secret.dat', fs['/secret.dat'], 'SWORD', unlock, fs)
    const progress = out.find((l) => l.type === 'progress')
    progress.onComplete()
    expect(unlock).toHaveBeenCalledWith('/secret.dat')
    expect(out.some((l) => l.text?.includes('FISH'))).toBe(true)
  })
  it('appends onUnlock event lines from theme.events', () => {
    const themeWithEvents = {
      locks: {},
      events: { '/secret.dat': [{ text: 'ALARM', type: 'err' }] }
    }
    const out = buildDecryptLines(themeWithEvents, '/secret.dat', fs['/secret.dat'], 'SWORD', vi.fn(), fs)
    expect(out.some((l) => l.text === 'ALARM')).toBe(true)
  })
})

describe('grep / find', () => {
  it('greps file contents and skips locked files for players', () => {
    const out = runCommand('grep organism', makeCtx())
    // note.txt has no "organism"; secret.dat is locked -> reported as hidden
    expect(out.some((l) => l.text?.includes('locked file'))).toBe(false)
  })
  it('greps a plain hit', () => {
    const out = runCommand('grep one', makeCtx())
    expect(out.some((l) => l.text?.startsWith('/note.txt:'))).toBe(true)
  })
  it('finds files by name', () => {
    const out = runCommand('find note', makeCtx())
    expect(out[0].text).toBe('/note.txt')
  })
  it('find marks locked files', () => {
    const out = runCommand('find secret', makeCtx())
    expect(out[0].text).toContain('[LOCKED]')
  })
})

describe('gmsheet', () => {
  it('requires GM mode', () => {
    const out = runCommand('gmsheet', makeCtx())
    expect(out[0].type).toBe('err')
  })
  it('lists locked files with their secrets in GM mode', () => {
    const out = runCommand('gmsheet', makeCtx({ gmMode: true }))
    expect(out.some((l) => l.text.includes('/secret.dat') && l.text.includes('pwd:SWORD'))).toBe(true)
    expect(out.some((l) => l.text.includes('reveals:/next.dat'))).toBe(true)
  })
})

describe('cd', () => {
  it('rejects a non-directory', () => {
    const out = runCommand('cd note.txt', makeCtx())
    expect(out[0].type).toBe('err')
  })
  it('changes into a directory', () => {
    const ctx = makeCtx({
      fs: { '/': { type: 'dir', children: ['d'] }, '/d': { type: 'dir', children: [] } }
    })
    runCommand('cd d', ctx)
    expect(ctx.setCwd).toHaveBeenCalledWith('/d')
  })
})
