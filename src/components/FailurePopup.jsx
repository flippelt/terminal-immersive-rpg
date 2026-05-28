import { useEffect, useRef } from 'react'
import { makeT } from '../i18n/ui.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'

// Quick acknowledge-and-move-on dialog for failed crack/unlock/decrypt
// attempts. Modal so the player can't miss the message, but dismissible by X,
// Esc, OK, or backdrop click. The important contract: any side effects tied
// to the failure (e.g. trace time penalty, history-line push) must wait for
// onClose so the player isn't punished while still reading the message.
export default function FailurePopup({
  title,
  message,
  hint,
  t = makeT('en'),
  onClose
}) {
  useEscapeKey(onClose)
  const okRef = useRef(null)
  useEffect(() => {
    okRef.current?.focus()
  }, [])

  const headerTitle = title ?? t('failure.title')

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal failure-popup"
        role="alertdialog"
        aria-modal="true"
        aria-label={headerTitle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <span>{headerTitle}</span>
          <button
            className="failure-popup__close"
            type="button"
            onClick={onClose}
            aria-label={t('viewer.close')}
            title={t('viewer.close')}
          >
            ✕
          </button>
        </div>
        {message && <div className="failure-popup__msg">{message}</div>}
        {hint && <div className="failure-popup__hint">{hint}</div>}
        <div className="failure-popup__actions">
          <button
            ref={okRef}
            className="failure-popup__ok"
            type="button"
            onClick={onClose}
          >
            {t('failure.ok')}
          </button>
        </div>
      </div>
    </div>
  )
}
