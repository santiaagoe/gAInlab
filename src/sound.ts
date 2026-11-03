/**
 * The beep at the end of a rest. iPhone only lets a page play sound if audio was started by a tap,
 * so `unlockAudio` is called when the user marks a set, and the later beep reuses that context.
 */

let audio: AudioContext | null = null

function context(): AudioContext | null {
  try {
    audio ??= new AudioContext()
    return audio
  } catch {
    return null
  }
}

/** Call from a tap. Starts the audio context and plays a silent sound so iOS allows the beep later. */
export function unlockAudio() {
  const ctx = context()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') void ctx.resume()
    const buffer = ctx.createBuffer(1, 1, 22_050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    // No audio: the visual cue is enough.
  }
}

/** Two short beeps and a vibration where the phone supports it (Android; iPhone does not allow vibration from the web). */
export function restOverAlert() {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // Ignore.
  }
  const ctx = context()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') void ctx.resume()
    for (const offset of [0, 0.25]) {
      const at = ctx.currentTime + offset
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.2)
    }
  } catch {
    // Audio not available: the visual cue is enough.
  }
}
