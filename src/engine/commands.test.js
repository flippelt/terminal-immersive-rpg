import { describe, it, expect, vi } from 'vitest'
import { runCommand, buildDecryptLines, buildCheckLines } from './commands.js'

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
  it('emits an image line for a file with an image front-matter', () => {
    const imgFs = {
      '/': { type: 'dir', children: ['photo.md'] },
      '/photo.md': { type: 'file', content: '# caption', image: 'data:image/png;base64,AAAA', imageAlt: 'a photo' }
    }
    const out = runCommand('cat photo.md', makeCtx({ fs: imgFs }))
    expect(out[0]).toMatchObject({ type: 'image', src: 'data:image/png;base64,AAAA', alt: 'a photo' })
    expect(out.some((l) => l.text?.includes('CAPTION'))).toBe(true)
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

describe('unlock / decrypt routing', () => {
  const gameFs = {
    '/': { type: 'dir', children: ['safe.dat', 'plain.dat'] },
    '/safe.dat': { type: 'file', locked: true, password: 'MAINFRAME', crackable: false, decryptGame: true, decryptTarget: 'KERNEL', decryptAttempts: 6 },
    '/plain.dat': { type: 'file', locked: true, password: 'PW', crackable: true }
  }
  it('unlock opens the password dialog when no key is given', () => {
    const openPasswordPrompt = vi.fn()
    runCommand('unlock plain.dat', makeCtx({ fs: gameFs, openPasswordPrompt }))
    expect(openPasswordPrompt).toHaveBeenCalledWith('/plain.dat', gameFs['/plain.dat'])
  })
  it('unlock with the right key returns the unlock sequence', () => {
    const out = runCommand('unlock plain.dat PW', makeCtx({ fs: gameFs }))
    expect(out.some((l) => l.type === 'progress')).toBe(true)
  })
  it('decrypt opens the minigame for a decryptGame file', () => {
    const openDecryptGame = vi.fn()
    runCommand('decrypt safe.dat', makeCtx({ fs: gameFs, openDecryptGame }))
    expect(openDecryptGame).toHaveBeenCalledWith('/safe.dat', gameFs['/safe.dat'])
  })
  it('decrypt on a file with no game reports encryption too high (no unlock fallback)', () => {
    const openPasswordPrompt = vi.fn()
    const openDecryptGame = vi.fn()
    const out = runCommand('decrypt plain.dat', makeCtx({ fs: gameFs, openPasswordPrompt, openDecryptGame }))
    expect(openDecryptGame).not.toHaveBeenCalled()
    expect(openPasswordPrompt).not.toHaveBeenCalled()
    expect(out[0].text).toMatch(/encryption level too high/)
  })
  it('gmsheet reveals the decrypt word', () => {
    const out = runCommand('gmsheet', makeCtx({ fs: gameFs, gmMode: true }))
    expect(out.some((l) => l.text.includes('decryptWord:KERNEL'))).toBe(true)
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

describe('query / dialog', () => {
  const dialog = {
    thinking: 'PROCESSING...',
    fallback: 'NO DATA.',
    responses: [
      { match: ['special order', '937'], type: 'err', lines: ['CREW EXPENDABLE.'] },
      { match: 'organism', lines: ['UNCLASSIFIED.'] }
    ]
  }
  it('matches a keyword and returns its lines', () => {
    const out = runCommand('query what is special order 937', makeCtx({ theme: { dialog, commands: {} } }))
    expect(out.some((l) => l.text === 'CREW EXPENDABLE.')).toBe(true)
    expect(out.some((l) => l.text === 'PROCESSING...')).toBe(true)
  })
  it('falls back when nothing matches', () => {
    const out = runCommand('query weather report', makeCtx({ theme: { dialog, commands: {} } }))
    expect(out.some((l) => l.text === 'NO DATA.')).toBe(true)
  })
  it('defers to a scenario static query when no dialog is set', () => {
    const out = runCommand('query anything', makeCtx({ theme: { commands: { query: ['ACCESS DENIED'] } } }))
    expect(out[0].text).toBe('ACCESS DENIED')
  })
})

describe('loadscenario', () => {
  it('rejects a non-http operand', () => {
    const out = runCommand('loadscenario ./local.json', makeCtx())
    expect(out[0].type).toBe('err')
  })
  it('calls loadScenarioUrl for an http(s) url', () => {
    const loadScenarioUrl = vi.fn()
    const out = runCommand('loadscenario https://example.com/s.json', makeCtx({ loadScenarioUrl }))
    expect(loadScenarioUrl).toHaveBeenCalledWith('https://example.com/s.json')
    expect(out[0].text).toContain('fetching')
  })
  it('opens the paste dialog with no operand', () => {
    const openScenarioPaste = vi.fn()
    runCommand('loadscenario', makeCtx({ openScenarioPaste }))
    expect(openScenarioPaste).toHaveBeenCalled()
  })
})

describe('sharescenario', () => {
  it('prints the link when a custom scenario is active', () => {
    const out = runCommand('sharescenario', makeCtx({ shareScenario: () => 'https://x/?scenario64=abc' }))
    expect(out.some((l) => l.text.includes('scenario64=abc'))).toBe(true)
  })
  it('errors when no custom scenario is loaded', () => {
    const out = runCommand('sharescenario', makeCtx({ shareScenario: () => null }))
    expect(out[0].type).toBe('err')
  })
})

describe('check', () => {
  it('reports an open file as unprotected', () => {
    const out = runCommand('check note.txt', makeCtx())
    expect(out.some((l) => l.text.includes('OPEN'))).toBe(true)
  })
  it('reports surveillance for a watched locked file', () => {
    const watched = {
      '/': { type: 'dir', children: ['w.dat'] },
      '/w.dat': { type: 'file', locked: true, password: 'X', crackable: true, crackDC: 10, tracer: true }
    }
    const out = runCommand(
      'check w.dat',
      makeCtx({ fs: watched, theme: { commands: {}, locks: {}, tracer: { label: 'ICE TRACE' } } })
    )
    expect(out.some((l) => l.text.includes('MONITORED'))).toBe(true)
  })
  it('reports surveillance clear when the file is not watched', () => {
    const out = runCommand('check secret.dat', makeCtx())
    expect(out.some((l) => l.text.includes('surveillance: clear'))).toBe(true)
  })
})

describe('crack on a hardened watched file', () => {
  it('trips the tracer fast and refuses', () => {
    const hardened = {
      '/': { type: 'dir', children: ['h.dat'] },
      '/h.dat': { type: 'file', locked: true, password: 'X', crackable: false, tracer: true }
    }
    const tripTracer = vi.fn()
    const out = runCommand(
      'crack h.dat',
      makeCtx({ fs: hardened, tripTracer, theme: { commands: {}, locks: {}, tracer: { nocrackSeconds: 5, label: 'ICE TRACE' } } })
    )
    expect(tripTracer).toHaveBeenCalledWith(5)
    expect(out[0].type).toBe('err')
  })
})

describe('per-file tracer overrides', () => {
  it('check shows the file-overridden window over the theme default', () => {
    const fsO = {
      '/': { type: 'dir', children: ['o.dat'] },
      '/o.dat': { type: 'file', locked: true, password: 'X', crackable: true, crackDC: 10, tracer: true, tracerSeconds: 12 }
    }
    const out = runCommand('check o.dat', makeCtx({ fs: fsO, theme: { commands: {}, locks: {}, tracer: { seconds: 30, label: 'T' } } }))
    expect(out.some((l) => l.text.includes('12s window'))).toBe(true)
  })
  it('nocrack fast-trace honors the file override', () => {
    const fsO = {
      '/': { type: 'dir', children: ['o.dat'] },
      '/o.dat': { type: 'file', locked: true, password: 'X', crackable: false, tracer: true, tracerNocrackSeconds: 3 }
    }
    const tripTracer = vi.fn()
    runCommand('crack o.dat', makeCtx({ fs: fsO, tripTracer, theme: { commands: {}, locks: {}, tracer: { nocrackSeconds: 5, label: 'T' } } }))
    expect(tripTracer).toHaveBeenCalledWith(3)
  })
})

describe('check with difficulty (checkDC)', () => {
  const dcFs = {
    '/': { type: 'dir', children: ['v.dat'] },
    '/v.dat': { type: 'file', locked: true, password: 'X', crackable: true, crackDC: 12, checkDC: 12, tracer: true }
  }
  const theme = { commands: {}, locks: {}, tracer: { label: 'ICE TRACE', seconds: 30, checkAlert: 'SUS' } }

  it('opens the scan roll prompt instead of revealing posture', () => {
    const openCheckPrompt = vi.fn()
    const out = runCommand('check v.dat', makeCtx({ fs: dcFs, openCheckPrompt, theme }))
    expect(openCheckPrompt).toHaveBeenCalledWith('/v.dat', dcFs['/v.dat'])
    expect(out.some((l) => l.text.includes('MONITORED'))).toBe(false)
  })
  it('flags a repeat scan (alert + grace loss) and does not re-roll', () => {
    const openCheckPrompt = vi.fn()
    const flagRescan = vi.fn()
    runCommand(
      'check v.dat',
      makeCtx({ fs: dcFs, openCheckPrompt, flagRescan, checkResults: new Map([['/v.dat', 'precise']]), theme })
    )
    expect(openCheckPrompt).not.toHaveBeenCalled()
    expect(flagRescan).toHaveBeenCalledWith('/v.dat', 'SUS')
  })
  it('GM mode reveals the truth without a roll', () => {
    const openCheckPrompt = vi.fn()
    const out = runCommand('check v.dat', makeCtx({ fs: dcFs, openCheckPrompt, gmMode: true, theme }))
    expect(openCheckPrompt).not.toHaveBeenCalled()
    expect(out.some((l) => l.text.includes('MONITORED'))).toBe(true)
  })
})

describe('buildCheckLines tiers', () => {
  const theme = { tracer: { label: 'ICE TRACE', seconds: 30 } }
  const node = { locked: true, password: 'X', crackable: true, crackDC: 10, tracer: true }
  it('precise shows the surveillance window', () => {
    const out = buildCheckLines(theme, '/v', node, { tier: 'precise', locked: true })
    expect(out.some((l) => l.text.includes('MONITORED') && l.text.includes('30s'))).toBe(true)
  })
  it('ambiguous hedges the reading', () => {
    const out = buildCheckLines(theme, '/v', node, { tier: 'ambiguous', locked: true })
    expect(out.some((l) => l.text.toLowerCase().includes('noisy'))).toBe(true)
  })
  it('fail is inconclusive', () => {
    const out = buildCheckLines(theme, '/v', node, { tier: 'fail', locked: true })
    expect(out.some((l) => l.text.toLowerCase().includes('inconclusive'))).toBe(true)
  })
  it('false inverts the surveillance reading (watched → clear)', () => {
    const out = buildCheckLines(theme, '/v', node, { tier: 'false', locked: true })
    expect(out.some((l) => l.text.includes('surveillance: clear'))).toBe(true)
  })
})

describe('command aliases', () => {
  it('resolves a themed alias to a built-in', () => {
    const out = runCommand(
      'scan note.txt',
      makeCtx({ theme: { commands: {}, locks: {}, aliases: { scan: 'check' } } })
    )
    expect(out[0].text).toContain('SECURITY SCAN')
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
