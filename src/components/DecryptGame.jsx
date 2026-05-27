import { useEffect, useState } from 'react'
import { scoreGuess, isWin } from '../engine/wordle.js'

// `decrypt` minigame: a Wordle-style keyword hunt. Type letters, Enter to
// submit a full-length guess, Esc to cancel. Win/lose fire the callbacks.
export default function DecryptGame({ target, attempts = 6, label, onWin, onLose, onCancel }) {
  const word = String(target).toUpperCase()
  const len = word.length
  const [rows, setRows] = useState([]) // [{ letters:[], score:[] }]
  const [cur, setCur] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (done) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel?.()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (cur.length !== len) return
        const score = scoreGuess(cur, word)
        const next = [...rows, { letters: cur.split(''), score }]
        setRows(next)
        setCur('')
        if (isWin(cur, word)) {
          setDone(true)
          setTimeout(() => onWin?.(), 600)
        } else if (next.length >= attempts) {
          setDone(true)
          setTimeout(() => onLose?.(), 700)
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setCur((c) => c.slice(0, -1))
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        setCur((c) => (c.length < len ? c + e.key.toUpperCase() : c))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cur, rows, done, len, word, attempts, onWin, onLose, onCancel])

  const remaining = attempts - rows.length

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal modal--decrypt"
        role="dialog"
        aria-modal="true"
        aria-label="cipher minigame"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">{label ?? 'CIPHER ANALYSIS'} {'//'} {len} CHARS</div>
        <div className="wordle">
          {Array.from({ length: attempts }).map((_, r) => {
            const row = rows[r]
            const typing = r === rows.length && !done
            return (
              <div className="wordle__row" key={r}>
                {Array.from({ length: len }).map((_, i) => {
                  const ch = row ? row.letters[i] : typing ? cur[i] : undefined
                  const st = row ? row.score[i] : ''
                  const cls =
                    `wordle__tile${st ? ' wordle__tile--' + st : ''}` +
                    (!row && typing && cur[i] ? ' wordle__tile--active' : '')
                  return (
                    <span className={cls} key={i}>
                      {ch ?? ''}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="modal__footer">
          {remaining} attempt(s) left · type · enter to submit · esc to cancel
        </div>
      </div>
    </div>
  )
}
