import OutputLine from './OutputLine.jsx'
import { renderFileContent } from '../engine/commands.js'
import { makeT } from '../i18n/ui.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'

// Cinematic file reader: `cat` opens an unlocked file in this CRT popup
// instead of dumping it inline. Content (text, markdown, CRT-filtered
// images) is rendered via the shared renderFileContent so it matches the
// inline look. The body scrolls when the file is long; close with the ×
// button, Esc, or by clicking the backdrop.
export default function FileViewer({ path, node, t = makeT('en'), onClose }) {
  useEscapeKey(onClose)

  const lines = renderFileContent(path, node)

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal modal--file"
        role="dialog"
        aria-modal="true"
        aria-label={path}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header file__header">
          <span className="file__name">{path}</span>
          <button
            className="file__close"
            onClick={onClose}
            aria-label={t('viewer.close')}
            title={t('viewer.close')}
          >
            ✕
          </button>
        </div>
        <div className="file__body">
          {lines.map((line, i) => (
            <OutputLine key={i} line={{ ...line, instant: true }} animate={false} />
          ))}
        </div>
        <div className="modal__footer">{t('viewer.hint')}</div>
      </div>
    </div>
  )
}
