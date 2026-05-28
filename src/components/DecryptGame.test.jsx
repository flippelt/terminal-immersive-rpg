// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import DecryptGame from './DecryptGame.jsx'

afterEach(cleanup)

const rowCount = (c) => c.querySelectorAll('.wordle__row').length

describe('DecryptGame attempts (GM override)', () => {
  it('defaults to 6 attempts when unset', () => {
    const { container } = render(<DecryptGame target="CIPHER" onWin={() => {}} onLose={() => {}} onCancel={() => {}} />)
    expect(rowCount(container)).toBe(6)
  })

  it('honors a GM override above the floor', () => {
    const { container } = render(<DecryptGame target="CIPHER" attempts={9} onWin={() => {}} onLose={() => {}} onCancel={() => {}} />)
    expect(rowCount(container)).toBe(9)
  })

  it('clamps to a minimum of 4 attempts', () => {
    const { container } = render(<DecryptGame target="CIPHER" attempts={2} onWin={() => {}} onLose={() => {}} onCancel={() => {}} />)
    expect(rowCount(container)).toBe(4)
  })
})
