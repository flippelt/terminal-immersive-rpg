import { describe, it, expect } from 'vitest'
import { complete } from './complete.js'

const ctx = {
  cwd: '/',
  theme: { id: 'alien', commands: { query: [], override: [] } },
  themes: [{ id: 'alien' }, { id: 'cprd' }],
  scenarioIds: ['nostromo', 'sevastopol'],
  fs: {
    '/': { type: 'dir', children: ['directive.txt', 'logs', 'cargo.dat'] },
    '/directive.txt': { type: 'file', content: 'x' },
    '/cargo.dat': { type: 'file', content: 'y' },
    '/logs': { type: 'dir', children: ['dallas.log', 'kane.log'] },
    '/logs/dallas.log': { type: 'file', content: 'd' },
    '/logs/kane.log': { type: 'file', content: 'k' }
  }
}

describe('command completion', () => {
  it('completes a unique command and adds a space', () => {
    expect(complete('hel', ctx)).toEqual({ value: 'help ', list: [] })
  })
  it('includes theme custom commands', () => {
    expect(complete('quer', ctx)).toEqual({ value: 'query ', list: [] })
  })
  it('fills the common prefix and lists when ambiguous', () => {
    const r = complete('c', ctx) // cat, cd, clear, crack
    expect(r.value).toBe('c')
    expect(r.list).toEqual(expect.arrayContaining(['cat', 'cd', 'clear', 'crack']))
  })
})

describe('path completion', () => {
  it('completes a unique file and adds a space', () => {
    expect(complete('cat direc', ctx)).toEqual({ value: 'cat directive.txt ', list: [] })
  })
  it('appends a slash for directories (no space)', () => {
    expect(complete('cd lo', ctx)).toEqual({ value: 'cd logs/', list: [] })
  })
  it('descends into nested directories', () => {
    expect(complete('cat logs/da', ctx)).toEqual({
      value: 'cat logs/dallas.log ',
      list: []
    })
  })
  it('lists candidates inside a directory', () => {
    const r = complete('cat logs/', ctx)
    expect(r.list).toEqual(['dallas.log', 'kane.log'])
  })
})

describe('alias completion', () => {
  const aliasCtx = {
    ...ctx,
    theme: { ...ctx.theme, aliases: { auspex: 'check', audit: 'check' } }
  }
  it('completes a themed alias command name', () => {
    expect(complete('ausp', aliasCtx)).toEqual({ value: 'auspex ', list: [] })
  })
  it('lists aliases alongside builtins when ambiguous', () => {
    const r = complete('a', aliasCtx) // audit, auspex
    expect(r.list).toEqual(expect.arrayContaining(['audit', 'auspex']))
  })
  it('completes file paths for an alias of a file-arg command', () => {
    expect(complete('auspex direc', aliasCtx)).toEqual({
      value: 'auspex directive.txt ',
      list: []
    })
  })
  it('a custom command of the same name wins over an alias', () => {
    const c = {
      ...ctx,
      theme: { ...ctx.theme, commands: { ...ctx.theme.commands, scan: [] }, aliases: { scan: 'check' } }
    }
    // `scan` is a static custom command here, so it takes no path argument
    expect(complete('scan direc', c)).toEqual({ value: 'scan direc', list: [] })
  })
})

describe('theme / scenario completion', () => {
  it('completes theme ids', () => {
    expect(complete('theme cp', ctx)).toEqual({ value: 'theme cprd ', list: [] })
  })
  it('completes the scenario subcommand', () => {
    expect(complete('scenario lo', ctx)).toEqual({ value: 'scenario load ', list: [] })
  })
  it('completes scenario ids after load', () => {
    const r = complete('scenario load ', ctx)
    expect(r.list).toEqual(['nostromo', 'sevastopol'])
  })
})
