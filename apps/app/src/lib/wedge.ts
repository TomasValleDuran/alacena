/**
 * Tells a USB "keyboard wedge" barcode reader apart from a person typing in
 * the same field. Readers type a whole code in a few milliseconds; most send
 * Enter at the end (the field submits on Enter by itself), some don't — for
 * those, a finished burst should submit on its own.
 *
 * Feed it every change of the field's text. A *run* is the characters added
 * by consecutive changes no more than `burstGapMs` apart (the first change of
 * a run may come after any pause). A run auto-submits when all of these hold:
 *
 *  1. it began on an empty field, so it is the whole text (never a mix of
 *     something typed by hand plus a scan);
 *  2. it is at least `minChars` long and only digits (retail codes are);
 *  3. the field then stays quiet for `idleMs`.
 *
 * People type far slower than 80 ms per key, so every keystroke starts a new
 * run and nothing typed by hand ever auto-submits; it waits for Enter.
 * Deleting or editing (anything but appending) drops the run.
 *
 * Paste: one change that adds a whole code into an empty field is a run of
 * that length, so pasting a numeric code auto-submits after `idleMs` — the
 * same as pasting and pressing Enter. Pasting text with letters or spaces,
 * or into a field that already has text, never does.
 *
 * Enter (or any explicit submit) must call `reset()`, so a reader that sends
 * Enter is submitted once, by the Enter.
 */
export type WedgeConfig = {
  burstGapMs: number
  minChars: number
  idleMs: number
}

export const DEFAULT_WEDGE: WedgeConfig = { burstGapMs: 80, minChars: 6, idleMs: 120 }

/** Result of `idle()`: submit this code, call again in `wait` ms, or nothing to do. */
export type WedgeCheck = { submit: string } | { wait: number } | null

export function createWedgeDetector(cfg: WedgeConfig = DEFAULT_WEDGE) {
  let text = ''
  /** the current run: field length when it began, and when its last character came */
  let run: { start: number; last: number } | null = null

  return {
    config: cfg,

    /**
     * The field's text changed to `value` at `now`. Returns in how many ms to
     * call `idle()`, or null when the current text can't auto-submit.
     */
    change(value: string, now: number): number | null {
      const appended = value.length > text.length && value.startsWith(text)
      if (!appended) {
        run = null
      } else if (run && now - run.last <= cfg.burstGapMs) {
        run.last = now
      } else {
        run = { start: text.length, last: now }
      }
      text = value
      return run && run.start === 0 ? cfg.idleMs : null
    },

    /** The field has been quiet for a while (a timer fired). */
    idle(now: number): WedgeCheck {
      if (!run || run.start !== 0) return null
      const quiet = now - run.last
      if (quiet < cfg.idleMs) return { wait: cfg.idleMs - quiet }
      const code = text
      run = null
      if (code.length < cfg.minChars || !/^\d+$/.test(code)) return null
      text = ''
      return { submit: code }
    },

    /** Enter was pressed / the field was submitted or cleared by the caller. */
    reset() {
      text = ''
      run = null
    },
  }
}

export type WedgeDetector = ReturnType<typeof createWedgeDetector>
