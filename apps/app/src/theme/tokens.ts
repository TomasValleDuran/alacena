/**
 * Alacena design tokens.
 *
 * Warm off-white "shelf paper" neutrals with a single pine-green accent.
 * Amber means "running low", red means "out" — they're never decoration.
 * Every text/surface pairing is ≥ 4.5:1 (checked for both schemes).
 */

export const palette = {
  light: {
    bg: '#F6F5F0',
    surface: '#FFFFFF',
    fill: '#ECEAE2', // pressed rows, stepper wells, inputs
    separator: '#DCD9CE',
    text: '#1B1E19',
    text2: '#5B6155',
    accent: '#2E6A3D',
    onAccent: '#FFFFFF',
    accentSoft: '#E1EEE3',
    warn: '#8A5300',
    warnSoft: '#FAEBD2',
    danger: '#B3261E',
    dangerSoft: '#F9DEDC',
  },
  dark: {
    bg: '#10120F',
    surface: '#1A1D18',
    fill: '#262A23',
    separator: '#30352D',
    text: '#ECEFE7',
    text2: '#A4AB9C',
    accent: '#8CCB99',
    onAccent: '#0E2215',
    accentSoft: '#1E3324',
    warn: '#F0B45A',
    warnSoft: '#3A2A10',
    danger: '#F2B8B5',
    dangerSoft: '#3E1816',
  },
} as const

export type Palette = { [K in keyof (typeof palette)['light']]: string }

/** Camera overlay colors — fixed, the preview is always dark-ish. */
export const overlay = {
  scrim: 'rgba(8, 10, 7, 0.62)',
  glass: 'rgba(20, 24, 18, 0.72)',
  glassPressed: 'rgba(40, 46, 36, 0.86)',
  text: '#FFFFFF',
  text2: 'rgba(255, 255, 255, 0.72)',
  accent: '#8CCB99',
  onAccent: '#0E2215',
  warn: '#F0B45A',
  danger: '#F2B8B5',
} as const

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

/** Rule: rows/inputs 12, cards & sheets 16, primary buttons & chips are capsules. */
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const

export const type = {
  largeNumber: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { fontSize: 22, fontWeight: '700' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17, fontWeight: '400' },
  callout: { fontSize: 15, fontWeight: '400' },
  subhead: { fontSize: 15, fontWeight: '600' },
  footnote: { fontSize: 13, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '600' },
} as const

/** Minimum hit area for anything tappable (iOS 44pt / Android 48dp). */
export const HIT = 48
