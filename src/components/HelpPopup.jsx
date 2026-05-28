import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { makeT } from '../i18n/ui.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { useIsMobile } from '../hooks/useIsMobile.js'

// Cheat-sheet popup the `help` command opens. On desktop it's a free-floating
// window: the player can drag it by the header, resize it from the bottom-
// right corner, and keep typing commands at the prompt behind it. On mobile
// drag + resize don't fit a phone screen, so it falls back to a centered
// modal with a backdrop.
//
// The rows shown are derived from `help.lines` (already translated by the i18n
// layer) plus the active theme's `extraHelp` lines. Anywhere the current
// scenario has aliased a canonical command (`auspex` → `check`, `audit` →
// `check`, etc.) we surface those aliases under the row, so the cheat sheet
// teaches the scenario's verbs instead of just the defaults.

const DESKTOP_DEFAULTS = { w: 480, h: 420 }
const MIN_SIZE = { w: 320, h: 200 }

function parseHelpLine(line) {
  if (!line) return null
  const trimmed = line.trim()
  if (!trimmed) return null
  const parts = trimmed.split(/\s{2,}/)
  if (parts.length < 2) return { kind: 'section', text: trimmed }
  const sigPart = parts[0]
  const desc = parts.slice(1).join(' ').trim()
  const cmdMatch = sigPart.match(/^(\S+)/)
  const cmd = cmdMatch ? cmdMatch[1] : sigPart
  const sig = sigPart.slice(cmd.length).trim()
  return { kind: 'row', cmd, sig, desc }
}

// Invert { aliasName: canonicalName } -> { canonicalName: [aliasName, ...] }
function aliasesByCanonical(aliases) {
  const out = {}
  for (const [name, canonical] of Object.entries(aliases ?? {})) {
    if (!out[canonical]) out[canonical] = []
    out[canonical].push(name)
  }
  return out
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

export default function HelpPopup({
  theme,
  t = makeT('en'),
  onClose
}) {
  const isMobile = useIsMobile()
  useEscapeKey(onClose)

  const aliasMap = useMemo(() => aliasesByCanonical(theme?.aliases), [theme?.aliases])

  const rows = useMemo(() => {
    const lines = t('help.lines')
    if (!Array.isArray(lines)) return []
    return lines.map(parseHelpLine).filter(Boolean)
  }, [t])

  const extra = useMemo(() => {
    if (!Array.isArray(theme?.extraHelp)) return []
    return theme.extraHelp
  }, [theme?.extraHelp])

  // Position/size are only meaningful on desktop; on mobile we ignore them.
  const [pos, setPos] = useState(null)
  const [size, setSize] = useState(DESKTOP_DEFAULTS)
  const dragRef = useRef(null) // { startX, startY, originX, originY }
  const resizeRef = useRef(null) // { startX, startY, originW, originH }
  const containerRef = useRef(null)

  // Compute an initial position once the popup mounts on desktop. We anchor
  // near the top-right of the CRT so the prompt area at the bottom stays
  // visible and the popup doesn't cover the most-recent output.
  useEffect(() => {
    if (isMobile) return
    if (pos) return
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const x = Math.max(40, vw - DESKTOP_DEFAULTS.w - 80)
    const y = Math.max(40, Math.floor(vh * 0.1))
    setPos({ x, y })
  }, [isMobile, pos])

  const onHeaderPointerDown = useCallback(
    (e) => {
      if (isMobile) return
      if (e.button !== undefined && e.button !== 0) return
      // The close button lives inside the header for layout; if the pointer
      // landed on it (or any future control inside the header), don't start
      // a drag — otherwise setPointerCapture below would swallow the click.
      if (e.target.closest?.('.help-popup__close')) return
      const cur = pos ?? { x: 0, y: 0 }
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: cur.x,
        originY: cur.y
      }
      e.currentTarget.setPointerCapture?.(e.pointerId)
      e.preventDefault()
    },
    [isMobile, pos]
  )

  const onHeaderPointerMove = useCallback(
    (e) => {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      const vw = window.innerWidth
      const vh = window.innerHeight
      // Keep at least 24px of the header visible so the player can always
      // grab it back if they dragged it off-screen.
      const x = clamp(d.originX + dx, -size.w + 80, vw - 24)
      const y = clamp(d.originY + dy, 0, vh - 40)
      setPos({ x, y })
    },
    [size.w]
  )

  const endHeaderDrag = useCallback((e) => {
    dragRef.current = null
    e.currentTarget?.releasePointerCapture?.(e.pointerId)
  }, [])

  const onResizePointerDown = useCallback(
    (e) => {
      if (isMobile) return
      if (e.button !== undefined && e.button !== 0) return
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originW: size.w,
        originH: size.h
      }
      e.currentTarget.setPointerCapture?.(e.pointerId)
      e.preventDefault()
      e.stopPropagation()
    },
    [isMobile, size.w, size.h]
  )

  const onResizePointerMove = useCallback((e) => {
    const r = resizeRef.current
    if (!r) return
    const dx = e.clientX - r.startX
    const dy = e.clientY - r.startY
    const vw = window.innerWidth
    const vh = window.innerHeight
    setSize({
      w: clamp(r.originW + dx, MIN_SIZE.w, vw - 80),
      h: clamp(r.originH + dy, MIN_SIZE.h, vh - 80)
    })
  }, [])

  const endResize = useCallback((e) => {
    resizeRef.current = null
    e.currentTarget?.releasePointerCapture?.(e.pointerId)
  }, [])

  // Style: on desktop, absolute position + explicit size. On mobile the CSS
  // class pins the popup centered.
  const desktopStyle = !isMobile && pos ? {
    left: pos.x,
    top: pos.y,
    width: size.w,
    height: size.h
  } : undefined

  const className = `help-popup${isMobile ? ' help-popup--mobile' : ''}`
  const titleText = t('help.title') ?? 'COMMANDS'

  const body = (
    <div
      ref={containerRef}
      className={className}
      style={desktopStyle}
      role="dialog"
      aria-modal={isMobile ? 'true' : 'false'}
      aria-label={titleText}
    >
      <div
        className="help-popup__header"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <span className="help-popup__title">{titleText}</span>
        <button
          className="help-popup__close"
          type="button"
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={t('viewer.close')}
          title={t('viewer.close')}
        >
          ✕
        </button>
      </div>
      <div className="help-popup__body">
        {rows.map((row, i) => {
          if (row.kind === 'section') {
            return (
              <div key={i} className="help-popup__section">{row.text}</div>
            )
          }
          const aliases = aliasMap[row.cmd] ?? []
          const cmdDisplay = row.sig ? `${row.cmd} ${row.sig}` : row.cmd
          return (
            <div key={i} className="help-popup__row">
              <span className="help-popup__cmd">{cmdDisplay}</span>
              <span className="help-popup__desc">{row.desc}</span>
              {aliases.length > 0 && (
                <span className="help-popup__aliases">
                  {t('help.aliases', { list: aliases.join(', ') })}
                </span>
              )}
            </div>
          )
        })}
        {extra.length > 0 && (
          <>
            <div className="help-popup__section">{t('help.extra')}</div>
            {extra.map((line, i) => (
              <div key={`extra-${i}`} className="help-popup__extra">{line}</div>
            ))}
          </>
        )}
      </div>
      <div className="help-popup__footer">
        {t(isMobile ? 'help.footer.mobile' : 'help.footer.desktop')}
      </div>
      {!isMobile && (
        <div
          className="help-popup__resize"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          aria-hidden="true"
        />
      )}
    </div>
  )

  if (isMobile) {
    return (
      <div className="help-popup--mobile-backdrop" role="presentation" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}>{body}</div>
      </div>
    )
  }
  return body
}
