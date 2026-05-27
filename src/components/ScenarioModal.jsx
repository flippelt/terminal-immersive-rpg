import { useEffect, useRef, useState } from 'react'

// GM dialog to paste a custom scenario bundle (JSON) and load it without
// editing the repo. `onSubmit(text)` returns an error string to show
// inline (keeping the dialog open) or null/undefined on success.
export default function ScenarioModal({ onSubmit, onCancel }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const submit = () => {
    const err = onSubmit(value)
    if (err) setError(err)
  }

  const onKey = (e) => {
    // Ctrl/Cmd+Enter submits; plain Enter inserts a newline (it's a textarea).
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div
        className="modal modal--scenario"
        role="dialog"
        aria-modal="true"
        aria-label="Load custom scenario"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">LOAD CUSTOM SCENARIO</div>
        <div className="modal__body">
          <span className="modal__label">paste scenario bundle (JSON):</span>
          <textarea
            ref={ref}
            className="modal__input modal__textarea"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={onKey}
            spellCheck={false}
            autoComplete="off"
            rows={10}
            aria-label="scenario bundle JSON"
          />
          {error && <span className="modal__footer--reject">{error}</span>}
        </div>
        <div className="modal__footer">ctrl+enter to load · esc to cancel</div>
      </div>
    </div>
  )
}
