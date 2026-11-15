import type { AccessibilityActionEvent, ViewProps } from 'react-native'

/**
 * Accessibility props of the Stepper, per platform (`stepper-a11y.web.ts` is
 * the web side). Native: ONE adjustable element with increment/decrement
 * actions and the buttons hidden from the screen reader. React Native Web
 * would turn that into role="slider" holding two unnamed focusable divs.
 */
export type StepKind = 'minus' | 'plus' | 'remove'

export function stepperGroupProps(label: string, value: number, step: (delta: number) => void): ViewProps {
  return {
    accessible: true,
    accessibilityRole: 'adjustable',
    accessibilityLabel: label,
    accessibilityValue: { text: String(value) },
    accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
    onAccessibilityAction: (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === 'increment') step(1)
      if (e.nativeEvent.actionName === 'decrement') step(-1)
    },
  }
}

export function stepButtonProps(_kind: StepKind, _label: string) {
  return { importantForAccessibility: 'no' as const }
}

/** The number: nothing extra on native (the group already carries the value). */
export function stepValueProps() {
  return {}
}
