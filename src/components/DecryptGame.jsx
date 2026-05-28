import { useCallback, useEffect, useRef, useState } from 'react'
import { isWin, pickRevealPositions, scoreGuess } from '../engine/wordle.js'
import { makeT } from '../i18n/ui.js'
import WordleLuckPopup from './WordleLuckPopup.jsx'

// `decrypt` minigame: a Wordle-style keyword hunt. Letters fill the tiles,
// Enter submits a full-length guess, Esc cancels.
//
// Input flows through a hidden, focused <input> rather than a window-level
// keydown listener — that's the only reliable way to surface the soft
// keyboard on mobile. The current guess is the input's value (filtered to
// A-Z); the tiles render off it. Tap anywhere in the modal to refocus the
// input (re-opens the keyboard on mobile after dismissal).
//
// Before the player makes any guess, a "Feelin' Lucky?" popup sits above
// the wordle: a one-shot d20 the player may roll for a chance at lost
// attempts or revealed letters. Rolling commits the effect and dismisses
// the popup; making any wordle guess also dismisses it without using the
// roll. The luck popup can only be used once per minigame.
export default function DecryptGame({
  target,
  attempts,
  label,
  luck = true,
  t = makeT('en'),
  onWin,
  onLose,
  onCancel
}) {
  const word = String(target).toUpperCase()
  const len = word.length
  // GM override: `decryptAttempts` front-matter sets the max guesses.
  // Default 6, with a hard floor of 4 so a file can never be made
  // unreasonably tight.
  const tries = Math.max(4, Number.isFinite(attempts) ? attempts : 6)
  const [rows, setRows] = useState([]) // [{ letters:[], score:[] }]
  const [cur, setCur] = useState('')
  const [done, setDone] = useState(false)
  // Luck-roll state. `luckUsed` flips true on first wordle guess OR after a
  // luck commit; once true, the popup never shows again for this minigame.
  // Starts true when the GM opted out via `decryptLuck: false`, so the
  // popup never appears at all on that file.
  // `revealed` is the set of positions the player has been shown for free
  // (rendered as a hint row above the grid). `lostByLuck` is the number of
  // attempts a bad roll burned — those slots render as struck-through
  // "phantom" rows at the top of the grid so the player sees what they cost.
  const [luckUsed, setLuckUsed] = useState(!luck)
  const [revealed, setRevealed] = useState(() => new Set())
  const [lostByLuck, setLostByLuck] = useState(0)
  const inputRef = useRef(null)

  // Open the soft keyboard the moment the modal mounts. iOS only honors
  // programmatic focus inside an active user gesture (the keystroke that ran
  // `decrypt`), so this runs synchronously in mount. While the luck popup
  // is up it owns focus instead — once it commits/skips, focus returns to
  // the wordle input via the effect below.
  useEffect(() => {
    if (!luckUsed) return
    inputRef.current?.focus()
  }, [luckUsed])

  const submit = () => {
    if (done || cur.length !== len) return
    // First guess implicitly ends the luck offer, even without rolling.
    if (!luckUsed) setLuckUsed(true)
    const score = scoreGuess(cur, word)
    const next = [...rows, { letters: cur.split(''), score }]
    setRows(next)
    setCur('')
    if (isWin(cur, word)) {
      setDone(true)
      setTimeout(() => onWin?.(), 600)
    } else if (next.length + lostByLuck >= tries) {
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

  // The luck roll resolved. Apply its effect, then dismiss the popup.
  // - "lose": burn N attempts. If that takes us past `tries`, end the game.
  // - "reveal": pick N distinct unrevealed positions and add them to the
  //   hint row. The player still has to type those letters in their guess —
  //   the reveal teaches them, it doesn't auto-fill.
  const onLuckCommit = useCallback(
    (effect) => {
      if (effect.kind === 'lose') {
        setLostByLuck((prev) => {
          const total = prev + effect.n
          if (rows.length + total >= tries) {
            setDone(true)
            setTimeout(() => onLose?.(), 800)
          }
          return total
        })
      } else if (effect.kind === 'reveal') {
        setRevealed((prev) => {
          const picks = pickRevealPositions(len, effect.n, prev)
          if (picks.length === 0) return prev
          const next = new Set(prev)
          for (const p of picks) next.add(p)
          return next
        })
      }
      setLuckUsed(true)
    },
    [rows.length, tries, len, onLose]
  )

  const remaining = tries - rows.length - lostByLuck
  const luckActive = !luckUsed && rows.length === 0

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div className="modal-stack" onClick={(e) => e.stopPropagation()}>
        {luckActive && <WordleLuckPopup t={t} onCommit={onLuckCommit} />}
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
          {revealed.size > 0 && (
            <div className="wordle__reveal" aria-label={t('luck.revealed')}>
              <span className="wordle__reveal-label">{t('luck.revealed')}</span>
              <div className="wordle__reveal-row">
                {Array.from({ length: len }).map((_, i) => (
                  <span
                    key={i}
                    className={`wordle__tile wordle__tile--hint${revealed.has(i) ? ' wordle__tile--revealed' : ''}`}
                  >
                    {revealed.has(i) ? word[i] : '·'}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="wordle" onClick={refocus}>
            {Array.from({ length: tries }).map((_, r) => {
              const isLuckPhantom = r < lostByLuck
              const guessIdx = r - lostByLuck
              const row = guessIdx >= 0 ? rows[guessIdx] : undefined
              const typing = !done && guessIdx === rows.length
              return (
                <div className={`wordle__row${isLuckPhantom ? ' wordle__row--burned' : ''}`} key={r}>
                  {Array.from({ length: len }).map((_, i) => {
                    if (isLuckPhantom) {
                      return (
                        <span className="wordle__tile wordle__tile--burned" key={i}>
                          ✗
                        </span>
                      )
                    }
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
            {t('modal.decrypt.footer', { n: Math.max(0, remaining) })}
          </div>
        </div>
      </div>
    </div>
  )
}
