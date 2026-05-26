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

// Continuous low CRT hum (off by default). Routed through _master so the
// volume slider / mute affect it. Two sine partials + a slow LFO wobble.
let _hum = null
export function startHum(profile = {}) {
  const c = ensure()
  if (!c || _hum) return
  unsuspend(c)
  const base = profile.freq ?? 60
  const gain = profile.gain ?? 0.04
  const osc1 = c.createOscillator()
  osc1.type = 'sine'
  osc1.frequency.value = base
  const osc2 = c.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.value = base * 2
  const g = c.createGain()
  g.gain.value = gain
  const lfo = c.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 0.2
  const lfoGain = c.createGain()
  lfoGain.gain.value = gain * 0.35
  lfo.connect(lfoGain).connect(g.gain)
  osc1.connect(g)
  osc2.connect(g)
  g.connect(_master)
  osc1.start()
  osc2.start()
  lfo.start()
  _hum = { osc1, osc2, lfo }
}
export function stopHum() {
  if (!_hum) return
  for (const node of Object.values(_hum)) {
    try {
      node.stop()
    } catch {
      // already stopped
    }
  }
  _hum = null
}
export function isHumOn() {
  return !!_hum
}

// Keystroke — fired on each printable keypress. Default is a percussive
// noise click (mechanical-keyboard feel). Set `kind: 'tone'` for the old
// retro beep.
export function playKeystroke(profile = {}) {
  const c = ensure()
  if (!c || _muted) return
  unsuspend(c)
  if ((profile.kind ?? 'click') === 'tone') return keystrokeTone(c, profile)
  return keystrokeClick(c, profile)
}

// Filtered white-noise burst with a fast decay — a key "tick".
function keystrokeClick(c, profile) {
  const now = c.currentTime
  const dur = profile.duration ?? 0.02
  const gain = profile.gain ?? 0.09
  const cutoff = (profile.cutoff ?? 2200) + (Math.random() - 0.5) * 500
  const lowThump = profile.thump ?? 0.4 // 0..1 — body of the press

  const n = Math.max(1, Math.floor(c.sampleRate * dur))
  const buffer = c.createBuffer(1, n, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < n; i++) {
    const env = 1 - i / n
    data[i] = (Math.random() * 2 - 1) * env * env // sharp attack, fast decay
  }
  const src = c.createBufferSource()
  src.buffer = buffer

  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = cutoff

  const g = c.createGain()
  g.gain.setValueAtTime(gain, now)
  g.gain.exponentialRampToValueAtTime(0.0004, now + dur)

  src.connect(hp).connect(g).connect(_master)
  src.start(now)
  src.stop(now + dur + 0.01)

  // Subtle low "thump" gives the key some body.
  if (lowThump > 0) {
    const osc = c.createOscillator()
    const tg = c.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140 + Math.random() * 40, now)
    osc.frequency.exponentialRampToValueAtTime(70, now + dur)
    tg.gain.setValueAtTime(gain * 0.6 * lowThump, now)
    tg.gain.exponentialRampToValueAtTime(0.0004, now + dur)
    osc.connect(tg).connect(_master)
    osc.start(now)
    osc.stop(now + dur + 0.01)
  }
}

// Legacy retro beep (kind: 'tone').
function keystrokeTone(c, profile) {
  const now = c.currentTime
  const dur = profile.duration ?? 0.012
  const freq = profile.freq ?? 1400
  const type = profile.type ?? 'square'
  const gain = profile.gain ?? 0.06

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
// Two layers: a swept-bandpass noise (texture) and an optional tonal
// rise (`tone` 0..1) that gives a "powering up" feel. With tone: 0 it's
// pure noise — identical to the original behavior.
export function playWhoosh(profile = {}) {
  const c = ensure()
  if (!c || _muted) return
  unsuspend(c)
  const dur = profile.duration ?? 0.6
  const fStart = profile.freqStart ?? 140
  const fEnd = profile.freqEnd ?? 1800
  const gain = profile.gain ?? 0.2
  const tone = profile.tone ?? 0.5
  const q = profile.q ?? 6
  const now = c.currentTime

  // --- noise texture layer ---
  const bufferSize = Math.max(1, Math.floor(c.sampleRate * dur))
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const noise = c.createBufferSource()
  noise.buffer = buffer

  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = q
  filter.frequency.setValueAtTime(fStart, now)
  filter.frequency.exponentialRampToValueAtTime(fEnd, now + dur)

  const ng = c.createGain()
  const noiseGain = tone > 0 ? gain * 0.55 : gain
  ng.gain.setValueAtTime(noiseGain, now)
  ng.gain.exponentialRampToValueAtTime(0.0005, now + dur)

  noise.connect(filter).connect(ng).connect(_master)
  noise.start(now)
  noise.stop(now + dur + 0.05)

  // --- tonal rise layer ---
  if (tone > 0) {
    const osc = c.createOscillator()
    osc.type = profile.type ?? 'triangle'
    osc.frequency.setValueAtTime(fStart, now)
    osc.frequency.exponentialRampToValueAtTime(fEnd, now + dur * 0.85)
    const og = c.createGain()
    og.gain.setValueAtTime(0.0005, now)
    og.gain.exponentialRampToValueAtTime(gain * tone, now + dur * 0.22)
    og.gain.exponentialRampToValueAtTime(0.0005, now + dur)
    osc.connect(og).connect(_master)
    osc.start(now)
    osc.stop(now + dur + 0.05)
  }
}
