import { describe, it, expect } from 'vitest'
import { encodeBundle, decodeBundle, shareUrl } from './share.js'

describe('share encode/decode', () => {
  it('round-trips a bundle, including unicode', () => {
    const bundle = {
      name: 'Operação Nightjar — MU/TH/UR ✦',
      files: { '/brief.md': '# título\nlinha com acento: ção' }
    }
    expect(decodeBundle(encodeBundle(bundle))).toEqual(bundle)
  })

  it('produces a URL-safe token (no +, /, =)', () => {
    const token = encodeBundle({ files: {}, blob: 'a'.repeat(200) + '???>>>' })
    expect(token).not.toMatch(/[+/=]/)
  })

  it('builds a share URL with the scenario64 param', () => {
    const url = shareUrl(
      { name: 'x', files: {} },
      { origin: 'https://example.com', pathname: '/app/' }
    )
    expect(url.startsWith('https://example.com/app/?scenario64=')).toBe(true)
    const token = new URL(url).searchParams.get('scenario64')
    expect(decodeBundle(token)).toEqual({ name: 'x', files: {} })
  })
})
