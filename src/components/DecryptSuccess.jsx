import { useEffect, useRef, useState } from 'react'
import { playBeep, playKeystroke } from '../audio/sfx.js'
import { makeT } from '../i18n/ui.js'

// Decrypt minigame win cinematic, three beats:
//   1. "ACCESS GRANTED" blinks twice
//   2. a second panel auto-types the recovered key
//   3. onComplete fires (Terminal then opens the file-viewer popup)
// Honors reduced motion by skipping straight to the end.
export default function DecryptSuccess({ keyText = '', t = makeT('en'), onComplete }) {
  const [stage, setStage] = useState('granted') // 'granted' | 'key'
  const [typed, setTyped] = useState('')
  const doneRef = useRef(onComplete)
  doneRef.current = onComplete
  const key = String(keyText).toUpperCase()

  // Beat 1 -> 2: hold on ACCESS GRANTED through two blinks, then advance.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      doneRef.current?.()
      return
    }
    playBeep({ freq: 880, duration: 0.12 }, 'ok')
    const t1 = setTimeout(() => playBeep({ freq: 1320, duration: 0.12 }, 'ok'), 420)
    const t2 = setTimeout(() => setStage('key'), 1400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  // Beat 2: type the key one character at a time, then finish.
  useEffect(() => {
    if (stage !== 'key') return
    let i = 0
    const id = setInterval(() => {
      i += 1
      setTyped(key.slice(0, i))
      playKeystroke()
      if (i >= key.length) {
        clearInterval(id)
        setTimeout(() => doneRef.current?.(), 850)
      }
    }, 130)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  return (
    <div className="modal-overlay decrypt-success" role="alertdialog" aria-label={t('decrypt.granted')}>
      {stage === 'granted' ? (
        <div className="decrypt-success__granted">{t('decrypt.granted')}</div>
      ) : (
        <div className="decrypt-success__key">
          <div className="decrypt-success__label">{t('decrypt.keyrecovered')}</div>
          <div className="decrypt-success__code">
            {typed}
            <span className="decrypt-success__caret" />
          </div>
        </div>
      )}
    </div>
  )
}
