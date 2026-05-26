// Web Audio synthesized SFX. No assets, no downloads.
// Each play function takes an optional profile (per-theme overrides
// from theme.sounds.{keystroke,beep,whoosh}).

let _ctx = null
let _master = null
let _volume = 0.4
let _muted = false

function ensure() {
  if (_ctx) return _ctx
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    _ctx = new Ctx()
    _master = _ctx.createGain()
    _master.gain.value = _muted ? 0 : _volume
    _master.connect(_ctx.destination)
  } catch {
    return null
  }
  return _ctx
}

function unsuspend(c) {
  if (c.state === 'suspended') c.resume()
}

export function setVolume(v) {
  _volume = Math.max(0, Math.min(1, v))
  if (_master) _master.gain.value = _muted ? 0 : _volume
}

export function setMuted(m) {
  _muted = !!m
  if (_master) _master.gain.value = _muted ? 0 : _volume
}

export function getVolume() {
  return _volume
}
export function isMuted() {
  return _muted
}

// Short typewriter click — fired on each printable keypress.
export function playKeystroke(profile = {}) {
  const c = ensure()
  if (!c || _muted) return
  unsuspend(c)
  const dur = profile.duration ?? 0.012
  const freq = profile.freq ?? 1400
  const type = profile.type ?? 'square'
  const gain = profile.gain ?? 0.06

  const now = c.currentTime
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq + (Math.random() - 0.5) * 220
  g.gain.setValueAtTime(gain, now)
  g.gain.exponentialRampToValueAtTime(0.0005, now + dur)
  osc.connect(g).connect(_master)
  osc.start(now)
  osc.stop(now + dur)
}

// Confirmation/denial beep — fired on err and ok lines.
export function playBeep(profile = {}, kind = 'ok') {
  const c = ensure()
  if (!c || _muted) return
  unsuspend(c)
  const dur = profile.duration ?? (kind === 'err' ? 0.12 : 0.06)
  const baseFreq = profile.freq ?? (kind === 'err' ? 220 : 880)
  const type = profile.type ?? 'sine'
  const gain = profile.gain ?? 0.15

  const now = c.currentTime
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = baseFreq
  g.gain.setValueAtTime(gain, now)
  g.gain.exponentialRampToValueAtTime(0.0005, now + dur)
  osc.connect(g).connect(_master)
  osc.start(now)
  osc.stop(now + dur)
}

// Boot whoosh — fired on theme change / reboot.
export function playWhoosh(profile = {}) {
  const c = ensure()
  if (!c || _muted) return
  unsuspend(c)
  const dur = profile.duration ?? 0.7
  const fStart = profile.freqStart ?? 80
  const fEnd = profile.freqEnd ?? 1400
  const gain = profile.gain ?? 0.18

  const now = c.currentTime
  // White-noise buffer
  const bufferSize = Math.max(1, Math.floor(c.sampleRate * dur))
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const noise = c.createBufferSource()
  noise.buffer = buffer

  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 6
  filter.frequency.setValueAtTime(fStart, now)
  filter.frequency.exponentialRampToValueAtTime(fEnd, now + dur)

  const g = c.createGain()
  g.gain.setValueAtTime(gain, now)
  g.gain.exponentialRampToValueAtTime(0.0005, now + dur)

  noise.connect(filter).connect(g).connect(_master)
  noise.start(now)
  noise.stop(now + dur + 0.05)
}
