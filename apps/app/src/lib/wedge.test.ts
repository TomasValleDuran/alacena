import { createWedgeDetector, type WedgeDetector } from './wedge'

const cfg = { burstGapMs: 80, minChars: 6, idleMs: 120 }
const CODE = '7790070410122'

/**
 * Drives a detector the way the screen does: one change per keystroke `gapMs`
 * apart (starting at `t0`, appending to `prefix`), with a fake clock and the
 * idle timer the screen would run. Returns the codes it auto-submitted and the
 * time of the last keystroke.
 */
function typeInto(
  w: WedgeDetector,
  chars: string,
  { gapMs, t0 = 0, prefix = '' }: { gapMs: number; t0?: number; prefix?: string },
) {
  let value = prefix
  let t = t0
  let timerAt: number | null = null
  const submitted: string[] = []
  const runTimerUpTo = (until: number) => {
    while (timerAt != null && timerAt <= until) {
      const r = w.idle(timerAt)
      const at: number = timerAt
      timerAt = null
      if (r && 'wait' in r) timerAt = at + r.wait
      else if (r) {
        submitted.push(r.submit)
        value = '' // the screen clears the field
      }
    }
  }
  for (const ch of chars) {
    runTimerUpTo(t - 1)
    value += ch
    const delay = w.change(value, t)
    timerAt = delay == null ? null : t + delay
    t += gapMs
  }
  const last = t - gapMs
  return {
    submitted,
    last,
    value: () => value,
    /** let the clock run to `until`, firing the idle timer if due */
    advance(until: number) {
      runTimerUpTo(until)
      return submitted
    },
  }
}

describe('reader bursts', () => {
  it('a burst without Enter auto-submits once, after idleMs of quiet', () => {
    const w = createWedgeDetector(cfg)
    const run = typeInto(w, CODE, { gapMs: 5 })
    expect(run.advance(run.last + 119)).toEqual([])
    expect(run.advance(run.last + 120)).toEqual([CODE])
    expect(run.advance(run.last + 10_000)).toEqual([CODE])
  })

  it('a burst followed by Enter is submitted by the Enter only', () => {
    const w = createWedgeDetector(cfg)
    const run = typeInto(w, CODE, { gapMs: 5 })
    // Enter right after the last digit: the screen submits and resets
    w.reset()
    expect(run.advance(run.last + 10_000)).toEqual([])
    expect(w.idle(run.last + 10_000)).toBeNull()
  })

  it('two bursts back to back submit twice', () => {
    const w = createWedgeDetector(cfg)
    const first = typeInto(w, CODE, { gapMs: 5 })
    expect(first.advance(first.last + 150)).toEqual([CODE])
    w.change('', first.last + 150) // the screen cleared the field
    const second = typeInto(w, '5901234123457', { gapMs: 4, t0: first.last + 400 })
    expect(second.advance(second.last + 200)).toEqual(['5901234123457'])
  })

  it('a burst shorter than minChars does not auto-submit', () => {
    const w = createWedgeDetector(cfg)
    const run = typeInto(w, '12345', { gapMs: 5 })
    expect(run.advance(run.last + 1_000)).toEqual([])
  })

  it('exactly minChars is enough', () => {
    const w = createWedgeDetector(cfg)
    const run = typeInto(w, '123456', { gapMs: 79 })
    expect(run.advance(run.last + 120)).toEqual(['123456'])
  })

  it('a timer that fires early is told to wait the rest', () => {
    const w = createWedgeDetector(cfg)
    const run = typeInto(w, CODE, { gapMs: 5 })
    expect(w.idle(run.last + 100)).toEqual({ wait: 20 })
    expect(w.idle(run.last + 120)).toEqual({ submit: CODE })
  })

  it('a burst appended to text typed by hand never auto-submits', () => {
    const w = createWedgeDetector(cfg)
    const hand = typeInto(w, '12', { gapMs: 300 })
    const burst = typeInto(w, CODE, { gapMs: 5, t0: hand.last + 500, prefix: '12' })
    expect(burst.advance(burst.last + 1_000)).toEqual([])
  })

  it('non-digit bursts never auto-submit', () => {
    const w = createWedgeDetector(cfg)
    const run = typeInto(w, 'MANUAL-123', { gapMs: 5 })
    expect(run.advance(run.last + 1_000)).toEqual([])
  })
})

describe('people typing', () => {
  it('slow typing (200 ms per key) never auto-submits', () => {
    const w = createWedgeDetector(cfg)
    const run = typeInto(w, CODE, { gapMs: 200 })
    expect(run.submitted).toEqual([])
    expect(run.advance(run.last + 60_000)).toEqual([])
  })

  it('typing just over burstGapMs per key, then a long pause, never auto-submits', () => {
    const w = createWedgeDetector(cfg)
    const run = typeInto(w, CODE, { gapMs: 81 })
    expect(run.advance(run.last + 60_000)).toEqual([])
  })

  it('typing, a pause, then more typing never auto-submits', () => {
    const w = createWedgeDetector(cfg)
    const a = typeInto(w, '779007', { gapMs: 150 })
    expect(a.advance(a.last + 2_000)).toEqual([])
    const b = typeInto(w, '0410122', { gapMs: 150, t0: a.last + 2_000, prefix: '779007' })
    expect(b.advance(b.last + 2_000)).toEqual([])
  })

  it('deleting drops the run', () => {
    const w = createWedgeDetector(cfg)
    const run = typeInto(w, CODE, { gapMs: 5 })
    w.change(CODE.slice(0, -1), run.last + 5) // backspace
    expect(w.idle(run.last + 1_000)).toBeNull()
  })
})

describe('paste', () => {
  it('pasting a numeric code into an empty field auto-submits after idleMs', () => {
    const w = createWedgeDetector(cfg)
    expect(w.change(CODE, 1_000)).toBe(120)
    expect(w.idle(1_120)).toEqual({ submit: CODE })
  })

  it('pasting into a field that already has text does not', () => {
    const w = createWedgeDetector(cfg)
    w.change('7', 0)
    expect(w.change(`7${CODE}`, 1_000)).toBeNull()
    expect(w.idle(5_000)).toBeNull()
  })

  it('pasting text with spaces or letters does not', () => {
    const w = createWedgeDetector(cfg)
    w.change('leche entera', 0)
    expect(w.idle(1_000)).toBeNull()
  })
})
