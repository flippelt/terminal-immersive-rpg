import { useEffect, useRef, useState } from 'react'
import { playBeep } from '../audio/sfx.js'

// Big centered self-destruct popup: a ticking countdown with an OVERRIDE
// code area. The correct (GM-defined) code aborts; reaching 0 detonates.
export default function SelfDestructModal({ config, onAbort, onDetonate }) {
  const from = Math.max(1, config.from ?? 10)
  const interval = Math.max(200, config.interval ?? 800)
  const override = config.override
  const [n, setN] = useState(from)
  const [value, setValue] = useState('')
  const [rejected, setRejected] = useState(false)
  const inputRef = useRef(null)
  const detRef = useRef(onDetonate)
  detRef.current = onDetonate

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    let cur = from
    playBeep({ freq: 1000, duration: 0.1 }, 'err')
    const id = setInterval(() => {
      cur -= 1
      setN(cur)
      if (cur <= 0) {
        clearInterval(id)
        detRef.current?.()
        return
      }
      playBeep({ freq: 1000, duration: 0.1 }, 'err')
    }, interval)
    return () => clearInterval(id)
  }, [from, interval])

  const submit = () => {
    if (override && value === override) {
      onAbort()
    } else {
      setRejected(true)
      setValue('')
      setTimeout(() => setRejected(false), 1400)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="modal-overlay modal-overlay--alarm" role="presentation">
      <div className="modal modal--destruct" role="dialog" aria-label="self destruct">
        <div className="modal__header modal__header--alarm">
          {config.armed ?? 'SELF-DESTRUCT SEQUENCE ARMED'}
        </div>
        <div className="destruct__count">
          {config.label ?? 'DETONATION IN'} {n}
        </div>
        {override && (
          <div className="destruct__override">
            <span className="modal__label">OVERRIDE CODE:</span>
            <input
              ref={inputRef}
              type="password"
              className="modal__input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKey}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="override code"
            />
          </div>
        )}
        <div className={`modal__footer${rejected ? ' modal__footer--reject' : ''}`}>
          {rejected
            ? '✕ OVERRIDE REJECTED'
            : override
              ? 'enter the override code to abort'
              : 'no override available'}
        </div>
      </div>
    </div>
  )
}
