import { useEffect, useRef, useState } from 'react'
import { playKeystroke } from '../audio/sfx.js'

// Terminal-style prompt:
// - A hidden <input> captures keystrokes (focusable but invisible).
// - The visible text is rendered by us, so the cursor can be a true
//   inline block at the caret position — moves with typing AND with
//   ArrowLeft/Right within the line.
export default function Prompt({ sigil, cwd, onSubmit, history, sounds }) {
  const [value, setValue] = useState('')
  const [caret, setCaret] = useState(0)
  const [histIdx, setHistIdx] = useState(history.length)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setHistIdx(history.length)
  }, [history.length])

  const syncCaret = () => {
    const el = inputRef.current
    if (!el) return
    setCaret(el.selectionStart ?? el.value.length)
  }

  const setBoth = (v, c = v.length) => {
    setValue(v)
    setCaret(c)
    // Keep the hidden input's selection in sync so ArrowLeft/Right
    // from the next keypress works from the right spot.
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (el) el.setSelectionRange(c, c)
    })
  }

  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSubmit(value)
      setBoth('', 0)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (histIdx > 0) {
        const next = histIdx - 1
        const v = history[next] ?? ''
        setHistIdx(next)
        setBoth(v)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx < history.length - 1) {
        const next = histIdx + 1
        const v = history[next] ?? ''
        setHistIdx(next)
        setBoth(v)
      } else {
        setHistIdx(history.length)
        setBoth('', 0)
      }
      return
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      onSubmit('clear')
    }
  }

  const onChange = (e) => {
    if (e.target.value.length > value.length) {
      playKeystroke(sounds?.keystroke)
    }
    setValue(e.target.value)
    setCaret(e.target.selectionStart ?? e.target.value.length)
  }

  const before = value.slice(0, caret)
  const atChar = value.slice(caret, caret + 1) || ' ' // nbsp when caret at end
  const after = value.slice(caret + 1)

  return (
    <div className="prompt-line" onClick={() => inputRef.current?.focus()}>
      <span className="prompt-line__sigil">
        {sigil} {cwd === '/' ? '/' : cwd}{' '}
        <span style={{ opacity: 0.7 }}>&gt;</span>
      </span>
      <span className="prompt-line__text">
        {before}
        <span className="cursor cursor--inline">{atChar}</span>
        {after}
      </span>
      <input
        ref={inputRef}
        className="prompt-line__capture"
        value={value}
        onChange={onChange}
        onKeyDown={onKey}
        onKeyUp={syncCaret}
        onSelect={syncCaret}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="terminal input"
      />
    </div>
  )
}
