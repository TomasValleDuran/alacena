/**
 * Web: no haptics engine, and a USB scan station is used eyes on the product,
 * so outcomes get a short, quiet tone (a different pitch each) plus a buzz
 * where the browser can vibrate. Browsers only allow audio after a user
 * gesture, so the AudioContext is made on the first key/pointer press — a
 * reader's keystrokes count. Without audio it stays silent; it never throws.
 */
let ctx: AudioContext | null = null

function unlock() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {}
}
if (typeof window !== 'undefined') {
  for (const type of ['keydown', 'pointerdown']) window.addEventListener(type, unlock, { capture: true, passive: true })
}

/** `notes`: [frequency Hz, start s] pairs, each 70 ms long. */
function play(notes: [number, number][], buzz: number[]) {
  try {
    navigator.vibrate?.(buzz)
    if (ctx?.state !== 'running') return
    for (const [freq, start] of notes) {
      const t = ctx.currentTime + start
      const osc = new OscillatorNode(ctx, { frequency: freq })
      const gain = new GainNode(ctx, { gain: 0 })
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.06, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.08)
    }
  } catch {}
}

export const feedback = {
  success: () => play([[1046, 0]], [30]),
  warning: () => play([[659, 0], [659, 0.12]], [30, 60, 30]),
  error: () => play([[220, 0], [196, 0.09]], [80, 50, 80]),
  detect: () => {},
  tick: () => {},
}
