import { useEffect, useRef, useState } from 'react'
import { scoreGuess, isWin } from '../engine/wordle.js'
import { makeT } from '../i18n/ui.js'

// `decrypt` minigame: a Wordle-style keyword hunt. Letters fill the tiles,
// Enter submits a full-length guess, Esc cancels.
//
// Input flows through a hidden, focused <input> rather than a window-level
// keydown listener — that's the only reliable way to surface the soft
// keyboard on mobile. The current guess is the input's value (filtered to
// A-Z); the tiles render off it. Tap anywhere in the modal to refocus the
// input (re-opens the keyboard on mobile after dismissal).
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
  const inputRef = useRef(null)

  // Open the soft keyboard the moment the modal mounts. iOS only honors
  // programmatic focus inside an active user gesture (the keystroke that ran
  // `decrypt`), so this runs synchronously in mount.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = () => {
    if (done || cur.length !== len) return
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
  }

  const onChange = (e) => {
    if (done) return
    // Only A-Z survives — soft keyboards may inject digits, accents,
    // autocomplete suggestions; we strip them. Uppercase and clamp to length.
    setCur(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, len))
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel?.()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
    // Letters and Backspace flow naturally through the input → onChange.
  }

  const refocus = () => inputRef.current?.focus()

  const remaining = tries - rows.length

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal modal--decrypt"
        role="dialog"
        aria-modal="true"
        aria-label="cipher minigame"
        onClick={(e) => {
          e.stopPropagation()
          refocus()
        }}
      >
        <div className="modal__header">{label ?? t('modal.decrypt.header')} {'//'} {len} {t('modal.decrypt.chars')}</div>
        <input
          ref={inputRef}
          className="wordle__capture"
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={len}
          value={cur}
          onChange={onChange}
          onKeyDown={onKeyDown}
          aria-label="cipher input"
        />
        <div className="wordle" onClick={refocus}>
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
