import { Pressable, Text, View } from 'react-native'

import { feedback } from '@/lib/feedback'
import { HIT, radius, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

import { Icon } from './icon'

type Props = {
  value: number
  onChange: (next: number) => void
  min?: number
  /** "+" is disabled at this value */
  max?: number
  /** label for screen readers, e.g. "Cantidad de Yerba Playadito" */
  label: string
  size?: 'compact' | 'large'
  /** when set, "−" at `min` becomes a trash button that calls this */
  onRemove?: () => void
  /** tint the number (low/out stock) */
  tone?: 'default' | 'warn' | 'danger'
  /** how the number is drawn, e.g. (n) => `×${n}`; screen readers still get the plain number */
  format?: (value: number) => string
  /** min width of the number, for formats wider than a plain number (default 28 compact, 64 large) */
  valueWidth?: number
}

/**
 * − value +. Each button is a full 48pt hit target even when the glyph well
 * is drawn smaller in compact rows. Exposed to VoiceOver/TalkBack as one
 * adjustable control (swipe up/down) rather than three loose elements.
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  label,
  size = 'compact',
  onRemove,
  tone = 'default',
  format = String,
  valueWidth,
}: Props) {
  const { c } = useTheme()
  const large = size === 'large'
  const well = large ? 48 : 34
  const atMin = value <= min
  const atMax = value >= max
  const showTrash = atMin && onRemove != null
  const numberColor = tone === 'danger' ? c.danger : tone === 'warn' ? c.warn : c.text

  function step(delta: number) {
    if (delta < 0 && showTrash) {
      feedback.tick()
      onRemove!()
      return
    }
    const next = Math.min(max, Math.max(min, value + delta))
    if (next === value) return
    feedback.tick()
    onChange(next)
  }

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: String(value) }}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') step(1)
        if (e.nativeEvent.actionName === 'decrement') step(-1)
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      <StepButton
        icon={showTrash ? 'trash' : 'remove'}
        well={well}
        disabled={atMin && !showTrash}
        onPress={() => step(-1)}
        danger={showTrash}
      />
      <Text
        style={[
          large ? t.largeNumber : { ...t.headline, fontVariant: ['tabular-nums'] },
          { minWidth: valueWidth ?? (large ? 64 : 28), textAlign: 'center', color: numberColor },
        ]}
      >
        {format(value)}
      </Text>
      <StepButton icon="add" well={well} disabled={atMax} onPress={() => step(1)} />
    </View>
  )
}

function StepButton({
  icon,
  well,
  disabled,
  danger,
  onPress,
}: {
  icon: 'add' | 'remove' | 'trash'
  well: number
  disabled?: boolean
  danger?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  const pad = Math.max(0, (HIT - well) / 2)
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={pad}
      importantForAccessibility="no"
      style={({ pressed }) => ({
        width: well,
        height: well,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: danger ? c.dangerSoft : pressed ? c.separator : c.fill,
        opacity: disabled ? 0.4 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Icon name={icon} size={well >= 44 ? 22 : 17} color={danger ? c.danger : c.text} />
    </Pressable>
  )
}
