import { codeCenter, createScanGate, isAimed } from './scan-gate'

const cfg = { confirmHits: 3, frameGapMs: 250, cooldownMs: 1200, rearmMs: 1500 }

/** Feed `code` at each time; returns the times where it counted as a scan. */
function feed(gate: ReturnType<typeof createScanGate>, code: string, times: number[]) {
  return times.filter((t) => gate.see(code, t))
}

describe('confirm', () => {
  it('counts on the third consecutive frame, not before', () => {
    const g = createScanGate(cfg)
    expect(g.see('A', 0)).toBe(false)
    expect(g.see('A', 100)).toBe(false)
    expect(g.see('A', 200)).toBe(true)
  })

  it('restarts when a gap between frames is longer than frameGapMs', () => {
    const g = createScanGate(cfg)
    expect(feed(g, 'A', [0, 100, 400, 500])).toEqual([]) // 400 starts over
    expect(g.see('A', 600)).toBe(true)
  })

  it('restarts when a different code interrupts', () => {
    const g = createScanGate(cfg)
    expect(feed(g, 'A', [0, 100])).toEqual([])
    g.see('B', 150)
    expect(g.see('A', 200)).toBe(false)
    expect(feed(g, 'A', [250, 300])).toEqual([300])
  })

  it('a code glimpsed once while sweeping the phone never counts', () => {
    const g = createScanGate(cfg)
    expect(['A', 'B', 'C', 'D'].map((c, i) => g.see(c, i * 100))).toEqual([false, false, false, false])
  })
})

describe('cooldown', () => {
  it('ignores every code for cooldownMs after a scan', () => {
    const g = createScanGate(cfg)
    expect(feed(g, 'A', [0, 100, 200])).toEqual([200])
    // 200 + 1200 = 1400
    expect(feed(g, 'B', [300, 400, 500, 1300, 1399])).toEqual([])
    expect(feed(g, 'B', [1400, 1500, 1600])).toEqual([1600])
  })
})

describe('re-arm', () => {
  it('does not repeat while the same code stays in view', () => {
    const g = createScanGate(cfg)
    const times = Array.from({ length: 60 }, (_, i) => i * 100) // 6 s of continuous frames
    expect(feed(g, 'A', times)).toEqual([200])
  })

  it('counts the same code again once it has been out of view for rearmMs', () => {
    const g = createScanGate(cfg)
    expect(feed(g, 'A', [0, 100, 200])).toEqual([200])
    expect(feed(g, 'A', [2000, 2100, 2200])).toEqual([2200])
  })

  it('stays disarmed if the code reappears before rearmMs', () => {
    const g = createScanGate(cfg)
    feed(g, 'A', [0, 100, 200])
    expect(feed(g, 'A', [1500, 1600, 1700])).toEqual([]) // seen again 1300 ms after the scan
  })

  it('a different code is unaffected by the first one being disarmed', () => {
    const g = createScanGate(cfg)
    feed(g, 'A', [0, 100, 200])
    expect(feed(g, 'B', [1400, 1500, 1600])).toEqual([1600])
  })

  it('reset forgets everything', () => {
    const g = createScanGate(cfg)
    feed(g, 'A', [0, 100, 200])
    g.reset()
    expect(feed(g, 'A', [300, 400, 500])).toEqual([500])
  })
})

describe('aim region', () => {
  const frame = { x: 100, y: 200, width: 200, height: 100 }

  it('codeCenter averages the corner points', () => {
    const c = codeCenter({
      cornerPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 4 },
        { x: 0, y: 4 },
      ],
    })
    expect(c).toEqual({ x: 5, y: 2 })
  })

  // jest-expo's default project is iOS (babel inlines process.env.EXPO_OS), so the
  // bounds fallback is exercised here; the Android branch (null) is not testable in this project.
  it('codeCenter falls back to bounds on iOS', () => {
    const bounds = { origin: { x: 10, y: 20 }, size: { width: 100, height: 40 } }
    expect(codeCenter({ bounds })).toEqual({ x: 60, y: 40 })
    expect(codeCenter({ bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } } })).toBeNull()
  })

  it('codeCenter is null with no position info', () => {
    expect(codeCenter({})).toBeNull()
  })

  it('isAimed accepts points inside the frame or within the margin', () => {
    expect(isAimed({ x: 200, y: 250 }, frame)).toBe(true)
    expect(isAimed({ x: 85, y: 250 }, frame)).toBe(true) // 15 left of frame, margin 16
    expect(isAimed({ x: 316, y: 316 }, frame)).toBe(true) // exactly on the margin edge
  })

  it('isAimed rejects points outside the margin', () => {
    expect(isAimed({ x: 83, y: 250 }, frame)).toBe(false)
    expect(isAimed({ x: 200, y: 317 }, frame)).toBe(false)
    expect(isAimed({ x: 200, y: 250 }, frame, 0)).toBe(true)
    expect(isAimed({ x: 99, y: 250 }, frame, 0)).toBe(false)
  })

  it('never drops a scan when position or frame is unknown', () => {
    expect(isAimed(null, frame)).toBe(true)
    expect(isAimed({ x: 9999, y: 9999 }, null)).toBe(true)
  })
})
