/**
 * Turns the native scanner's firehose (a callback for every frame a code is
 * visible, and for anything that flashes through the frame) into deliberate
 * scans:
 *
 *  1. confirm  — a code must be read in `confirmHits` consecutive frames (no gap
 *                over `frameGapMs`). Codes glimpsed while moving the phone
 *                across a shelf never reach that.
 *  2. cooldown — after a scan, everything is ignored for `cooldownMs`, so the
 *                result can be read and the next product brought in.
 *  3. re-arm   — the same code counts again only after it has been out of view
 *                for `rearmMs`. A product left on the counter in view doesn't
 *                keep adding itself. (Several of the same item: use ×N.)
 */
export type ScanGateConfig = {
  confirmHits: number
  frameGapMs: number
  cooldownMs: number
  rearmMs: number
}

export const DEFAULT_GATE: ScanGateConfig = {
  confirmHits: 3,
  frameGapMs: 250,
  cooldownMs: 1200,
  rearmMs: 1500,
}

export function createScanGate(cfg: ScanGateConfig = DEFAULT_GATE) {
  let candidate: { code: string; hits: number; last: number } | null = null
  let lockedUntil = 0
  /** accepted codes → last time they were seen; present = disarmed */
  const disarmed = new Map<string, number>()

  return {
    /** Feed every sighting; returns true exactly when it should count as a scan. */
    see(code: string, now: number): boolean {
      const prev = disarmed.get(code)
      if (prev != null) {
        if (now - prev < cfg.rearmMs) {
          disarmed.set(code, now) // still (or again) in view: stay disarmed
          return false
        }
        disarmed.delete(code) // was gone long enough: a fresh scan
      }

      if (now < lockedUntil) return false

      if (candidate && candidate.code === code && now - candidate.last <= cfg.frameGapMs) {
        candidate.hits += 1
        candidate.last = now
      } else {
        candidate = { code, hits: 1, last: now }
      }
      if (candidate.hits < cfg.confirmHits) return false

      candidate = null
      lockedUntil = now + cfg.cooldownMs
      disarmed.set(code, now)
      return true
    },

    /** e.g. leaving the tab: forget everything. */
    reset() {
      candidate = null
      lockedUntil = 0
      disarmed.clear()
    },
  }
}

/* ---------------------------------------------------------- aim region */

export type Rect = { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number }

/**
 * Center of a detected code in the camera view's coordinates (dp/pt).
 * Uses cornerPoints: on Android, expo-camera maps only those to view space
 * (`bounds` stays in camera-image space); on iOS both are mapped. `null` when
 * the platform didn't report a position.
 */
export function codeCenter(r: { cornerPoints?: Point[]; bounds?: { origin: Point; size: { width: number; height: number } } }): Point | null {
  const pts = r.cornerPoints ?? []
  if (pts.length > 0) {
    return {
      x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
      y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
    }
  }
  if (process.env.EXPO_OS === 'ios' && r.bounds && r.bounds.size.width > 0) {
    return { x: r.bounds.origin.x + r.bounds.size.width / 2, y: r.bounds.origin.y + r.bounds.size.height / 2 }
  }
  return null
}

/** Is the code aimed at the frame? Unknown position → yes (never drop a real scan). */
export function isAimed(center: Point | null, frame: Rect | null, margin = 16): boolean {
  if (!center || !frame) return true
  return (
    center.x >= frame.x - margin &&
    center.x <= frame.x + frame.width + margin &&
    center.y >= frame.y - margin &&
    center.y <= frame.y + frame.height + margin
  )
}
