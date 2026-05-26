import { useEffect, useState } from 'react'
import { setMuted } from '../audio/sfx.js'

const LS_KEY = 'tirpg.muted'

export default function AudioToggle() {
  const [muted, setLocalMuted] = useState(
    () => localStorage.getItem(LS_KEY) === 'true'
  )

  useEffect(() => {
    setMuted(muted)
    localStorage.setItem(LS_KEY, String(muted))
  }, [muted])

  return (
    <button
      className="audio-toggle"
      onClick={() => setLocalMuted((m) => !m)}
      title={muted ? 'audio is off — click to enable' : 'audio is on — click to mute'}
      aria-label={muted ? 'unmute audio' : 'mute audio'}
    >
      {muted ? '── audio off' : '♪♪ audio on'}
    </button>
  )
}
