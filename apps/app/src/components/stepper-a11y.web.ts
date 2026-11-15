import type { ViewProps } from 'react-native'

import type { StepKind } from './stepper-a11y'

/**
 * Web: a labelled group with two named buttons and the number as a polite
 * live region, so the new value is read after each press. Increment and
 * decrement actions have no web equivalent; the buttons are the way in.
 */
const NAMES: Record<StepKind, string> = { minus: 'Menos', plus: 'Más', remove: 'Quitar' }

export function stepperGroupProps(label: string): ViewProps {
  return { role: 'group', 'aria-label': label }
}

export function stepButtonProps(kind: StepKind, label: string) {
  return { role: 'button' as const, 'aria-label': `${NAMES[kind]}, ${label}` }
}

export function stepValueProps() {
  return { 'aria-live': 'polite' as const }
}
