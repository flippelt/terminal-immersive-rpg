import { useEffect, useRef } from 'react'

// Shared window-level Escape listener. Several popups (FileViewer, IceAlert,
// HelpPopup, FailurePopup) install one of these; pre-extraction the same
// effect lived inline in each component.
export function useEscapeKey(onEscape, enabled = true) {
  const cbRef = useRef(onEscape)
  cbRef.current = onEscape
  useEffect(() => {
    if (!enabled) return undefined
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cbRef.current?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled])
}
