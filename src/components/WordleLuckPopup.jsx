import { useEffect, useRef, useState } from 'react'
import { makeT } from '../i18n/ui.js'
import { rollLuck } from '../engine/wordle.js'

const RESULT_HOLD_MS = 1700

// "Feelin' Lucky? ;)" — a one-shot d20 the player can roll before their first
// wordle guess. Stacks above the wordle modal (DecryptGame mounts it as a
// sibling). The popup goes through two states:
//
//   1. Prompt — number input (1–20). Enter submits.
//   2. Result — smiley + outcome message, held briefly, then `onCommit` is
//      called with the resolved effect so DecryptGame can apply it (lose
//      attempts or reveal letters) and unmount us.
//
// The luck popup itself does NOT cancel the game on Escape — it just lets
// the player skip via the wordle (typing a guess auto-closes us). Esc still
// reaches the wordle's own onKeyDown when focus shifts there. Closing this
// component is always driven by DecryptGame.
export default function WordleLuckPopup({ t = makeT('en'), onCommit }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Once a roll resolves, freeze the popup on the result for a beat so the
  // player gets a moment to see the smiley, then hand control back.
  useEffect(() => {
    if (!result) return undefined
    const id = setTimeout(() => commitRef.current?.(result), RESULT_HOLD_MS)
    return () => clearTimeout(id)
  }, [result])

  const submit = () => {
    const n = parseInt(value, 10)
    const effect = rollLuck(n)
    if (!effect) {
      setError(true)
      return
    }
    setError(false)
    setResult(effect)
  }

  const onChange = (e) => {
    setError(false)
    // Strip anything that isn't a digit, then clamp to 2 characters (max 20).
    setValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))
  }

  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  if (result) {
    const messageKey =
      result.kind === 'lose'
        ? result.n === 2 ? 'luck.crit_fail' : 'luck.fail'
        : `luck.reveal${result.n}`
    return (
      <div
        className={`wordle-luck wordle-luck--result wordle-luck--${result.tone}`}
        role="status"
        aria-live="polite"
      >
        <div className="wordle-luck__smiley">{result.smiley}</div>
        <div className="wordle-luck__message">{t(messageKey)}</div>
        <div className="wordle-luck__roll">d20: {result.roll}</div>
      </div>
    )
  }

  return (
    <div
      className="wordle-luck"
      role="dialog"
      aria-label={t('luck.title')}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="wordle-luck__title">{t('luck.title')}</div>
      <div className="wordle-luck__body">
        <span className="wordle-luck__label">{t('luck.label')}</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          className={`wordle-luck__input${error ? ' wordle-luck__input--error' : ''}`}
          value={value}
          onChange={onChange}
          onKeyDown={onKey}
          autoComplete="off"
          aria-label={t('luck.label')}
          aria-invalid={error || undefined}
        />
      </div>
      <div className="wordle-luck__hint">
        {error ? t('luck.invalid') : t('luck.hint')}
      </div>
    </div>
  )
}
