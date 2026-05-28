import { useEffect, useState } from 'react'
import { scoreGuess, isWin } from '../engine/wordle.js'
import { makeT } from '../i18n/ui.js'

// `decrypt` minigame: a Wordle-style keyword hunt. Type letters, Enter to
// submit a full-length guess, Esc to cancel. Win/lose fire the callbacks.
export default function DecryptGame({ target, attempts, label, t = makeT('en'), onWin, onLose, onCancel }) {
  const word = String(target).toUpperCase()
  const len = word.length
  // GM override: `decryptAttempts` front-matter sets the max guesses.
  // Default 6, with a hard floor of 4 so a file can never be made
  // unreasonably tight.
  const tries = Math.max(4, Number.isFinite(attempts) ? attempts : 6)
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
        } else if (next.length >= tries) {
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
  }, [cur, rows, done, len, word, tries, onWin, onLose, onCancel])

  const remaining = tries - rows.length

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal modal--decrypt"
        role="dialog"
        aria-modal="true"
        aria-label="cipher minigame"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">{label ?? t('modal.decrypt.header')} {'//'} {len} {t('modal.decrypt.chars')}</div>
        <div className="wordle">
          {Array.from({ length: tries }).map((_, r) => {
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
          {t('modal.decrypt.footer', { n: remaining })}
        </div>
      </div>
    </div>
  )
}
